import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'google-chrome';
}

const CHROME = findChrome();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain' };

export function serve(root = ROOT) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(root, p);
    if (!f.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, {
        'content-type': MIME[path.extname(f)] || 'application/octet-stream',
        'cache-control': 'no-store, no-cache, must-revalidate'
      });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

export async function launch(url, { port = 9333, extra = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,720',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required', ...extra, 'about:blank',
  ], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled') logs.push({ t: 'console.' + m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
    else if (m.method === 'Runtime.exceptionThrown') logs.push({ t: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
    else if (m.method === 'Log.entryAdded') logs.push({ t: 'log.' + m.params.entry.level, text: m.params.entry.text + ' ' + (m.params.entry.url || '') });
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const click = async (selector) => {
    const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,vis:getComputedStyle(e).display!=='none'}})()`);
    if (!box || !box.vis) throw new Error('no clickable: ' + selector);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  };
  const key = async (code, k = code, type = 'keyDown') => send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: 0 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const close = async () => { try { await send('Browser.close'); } catch {} try { ws.close(); } catch {} proc.kill(); await sleep(500); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  const navigate = async (u) => { await send('Page.navigate', { url: u }); };
  return { send, evaluate, click, key, sleep, close, logs, navigate };
}
