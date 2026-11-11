import * as THREE from 'three';
import { renderer } from './core.js';
import { texConcrete, texMetal, texCrate } from './textures.js';
import { buildLobbyWeaponMesh, buildShowcaseWeaponMesh, disposeHierarchyGeometries } from './weapon.js';
import { applyAttachmentsToModel } from './attachment-visuals.js';
import { cloneAttachments } from './attachments.js';

export const lobbyScene = new THREE.Scene();
lobbyScene.background = new THREE.Color(0x060911);
lobbyScene.fog = new THREE.FogExp2(0x060911, 0.038);

export const lobbyCamera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 80);
lobbyCamera.position.set(0.12, 1.38, 3.1);
lobbyScene.add(lobbyCamera);

addEventListener('resize', () => {
  lobbyCamera.aspect = innerWidth / innerHeight;
  lobbyCamera.updateProjectionMatrix();
  recomputeShowcaseFraming(false);
  if (currentLobbyView === 'loadout') {
    applyShowcaseCameraTargets(showcaseState.zoom);
    lobbyCamera.position.copy(targetCam);
    curLook.copy(targetLook);
    lobbyCamera.lookAt(curLook);
  }
});

const floorTex = texConcrete.clone();
floorTex.repeat.set(5, 5);
const matFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.2 });

const wallTex = texMetal.clone();
wallTex.repeat.set(3, 3);
const matWall = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x22262c, roughness: 0.72, metalness: 0.48 });
const matBeam = new THREE.MeshStandardMaterial({ color: 0x17191e, roughness: 0.6, metalness: 0.68 });
const matPillar = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.7, metalness: 0.4 });
const matHazard = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.78, metalness: 0.1 });

const matCrateLobby = new THREE.MeshStandardMaterial({ map: texCrate, roughness: 0.85 });
const matContainerLobby = new THREE.MeshStandardMaterial({ map: texMetal, color: 0x2b3844, roughness: 0.65, metalness: 0.4 });
const matBarrelLobby = new THREE.MeshStandardMaterial({ map: texMetal, color: 0x3d4435, roughness: 0.6, metalness: 0.5 });

const matUniform = new THREE.MeshStandardMaterial({ color: 0x38424f, roughness: 0.75 });
const matVest = new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.8, metalness: 0.2 });
const matArmor = new THREE.MeshStandardMaterial({ color: 0x454e5a, roughness: 0.65, metalness: 0.35 });
const matHelmet = new THREE.MeshStandardMaterial({ color: 0x353d47, roughness: 0.6, metalness: 0.3 });
const matVisor = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.2, metalness: 0.8, emissive: 0xff3b1a, emissiveIntensity: 1.6 });
const matSkin = new THREE.MeshStandardMaterial({ color: 0x282c32, roughness: 0.9 });
const matGloves = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.8 });
const matBoots = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.7, metalness: 0.2 });
const matGun = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.5, metalness: 0.75 });
const matGunMetal = new THREE.MeshStandardMaterial({ color: 0x424750, roughness: 0.45, metalness: 0.65 });

lobbyScene.add(new THREE.HemisphereLight(0x28384f, 0x07090e, 0.65));

const keyLight = new THREE.DirectionalLight(0xe2eaf6, 1.85);
keyLight.position.set(2.2, 4.0, 3.0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 12;
keyLight.shadow.camera.left = -3;
keyLight.shadow.camera.right = 3;
keyLight.shadow.camera.top = 3;
keyLight.shadow.camera.bottom = -1;
keyLight.shadow.bias = -0.001;
lobbyScene.add(keyLight);

const fillLight = new THREE.PointLight(0xa0aec0, 1.5, 7, 2);
fillLight.position.set(1.0, 1.6, 2.0);
lobbyScene.add(fillLight);

const rimLight = new THREE.PointLight(0x38bdf8, 4.2, 7, 2);
rimLight.position.set(0.4, 2.1, -1.4);
lobbyScene.add(rimLight);

const warmLight = new THREE.PointLight(0xf59e0b, 1.4, 6, 2);
warmLight.position.set(3.4, 1.1, -1.6);
lobbyScene.add(warmLight);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), matFloor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
lobbyScene.add(floor);

const stripe1 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 14), matHazard);
stripe1.rotation.x = -Math.PI / 2;
stripe1.rotation.z = Math.PI / 2;
stripe1.position.set(0, 0.005, 1.4);
stripe1.receiveShadow = true;
lobbyScene.add(stripe1);

const backWall = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 0.4), matWall);
backWall.position.set(0, 4, -4.5);
backWall.receiveShadow = true;
lobbyScene.add(backWall);

const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 20), matWall);
sideWall.position.set(-6.5, 4, 0);
sideWall.receiveShadow = true;
lobbyScene.add(sideWall);

for (let x = -5.5; x <= 5.5; x += 3.6) {
  const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, 8, 0.45), matPillar);
  col.position.set(x, 4, -4.2);
  col.castShadow = true;
  col.receiveShadow = true;
  lobbyScene.add(col);
}

const beamMain = new THREE.Mesh(new THREE.BoxGeometry(24, 0.55, 0.55), matBeam);
beamMain.position.set(0, 5.2, -1.5);
beamMain.castShadow = true;
lobbyScene.add(beamMain);

const beamCross1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 12), matBeam);
beamCross1.position.set(-2.5, 5.0, 0);
beamCross1.castShadow = true;
lobbyScene.add(beamCross1);

const beamCross2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 12), matBeam);
beamCross2.position.set(2.5, 5.0, 0);
beamCross2.castShadow = true;
lobbyScene.add(beamCross2);

const container = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 2.4), matContainerLobby);
container.position.set(-3.8, 1.3, -2.8);
container.rotation.y = 0.16;
container.castShadow = true;
container.receiveShadow = true;
lobbyScene.add(container);

function addCrate(x, y, z, ry, s = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 1.1 * s, 1.1 * s), matCrateLobby);
  m.position.set(x, y + 0.55 * s, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  lobbyScene.add(m);
  return m;
}

addCrate(3.2, 0, -1.5, -0.22);
addCrate(4.1, 0, -1.8, 0.15);
addCrate(3.5, 1.1, -1.6, 0.08);
addCrate(2.4, 0, -2.5, 0.45, 0.85);

const barrelGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.25, 14);
for (const [bx, bz] of [[-1.6, -2.6], [-1.0, -2.8], [-1.3, -2.0]]) {
  const b = new THREE.Mesh(barrelGeo, matBarrelLobby);
  b.position.set(bx, 0.625, bz);
  b.castShadow = true;
  b.receiveShadow = true;
  lobbyScene.add(b);
}

const operator = new THREE.Group();
operator.position.set(1.15, 0, -0.05);
operator.rotation.y = -0.38;
lobbyScene.add(operator);

const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.32), matBoots);
lBoot.position.set(-0.16, 0.11, 0.04);
lBoot.castShadow = true;
operator.add(lBoot);

const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.32), matBoots);
rBoot.position.set(0.18, 0.11, -0.06);
rBoot.castShadow = true;
operator.add(rBoot);

const lShin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.45, 0.18), matUniform);
lShin.position.set(-0.16, 0.42, 0.02);
lShin.castShadow = true;
operator.add(lShin);

const rShin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.45, 0.18), matUniform);
rShin.position.set(0.18, 0.42, -0.05);
rShin.castShadow = true;
operator.add(rShin);

const lKnee = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.07), matArmor);
lKnee.position.set(-0.16, 0.46, 0.12);
lKnee.castShadow = true;
operator.add(lKnee);

const rKnee = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.07), matArmor);
rKnee.position.set(0.18, 0.46, 0.05);
rKnee.castShadow = true;
operator.add(rKnee);

const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.22), matUniform);
lThigh.position.set(-0.15, 0.82, 0.01);
lThigh.castShadow = true;
operator.add(lThigh);

const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.22), matUniform);
rThigh.position.set(0.17, 0.82, -0.04);
rThigh.castShadow = true;
operator.add(rThigh);

const holster = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), matVest);
holster.position.set(0.29, 0.84, -0.03);
holster.castShadow = true;
operator.add(holster);

const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.18), matGun);
pistol.position.set(0.3, 0.92, -0.01);
pistol.rotation.x = -0.2;
pistol.castShadow = true;
operator.add(pistol);

const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.26), matUniform);
pelvis.position.set(0.01, 1.05, -0.01);
pelvis.castShadow = true;
operator.add(pelvis);

const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.29), matVest);
belt.position.set(0.01, 1.13, -0.01);
belt.castShadow = true;
operator.add(belt);

const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), matArmor);
buckle.position.set(0.01, 1.13, 0.14);
operator.add(buckle);

const spineGroup = new THREE.Group();
spineGroup.position.set(0.01, 1.15, -0.01);
operator.add(spineGroup);

const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.25), matUniform);
abdomen.position.set(0, 0.12, 0);
abdomen.castShadow = true;
spineGroup.add(abdomen);

const chestGroup = new THREE.Group();
chestGroup.position.set(0, 0.24, 0);
spineGroup.add(chestGroup);

const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.28), matVest);
chest.position.set(0, 0.19, 0);
chest.castShadow = true;
chestGroup.add(chest);

const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.08), matArmor);
plateFront.position.set(0, 0.19, 0.16);
plateFront.castShadow = true;
chestGroup.add(plateFront);

const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.06), matArmor);
plateBack.position.set(0, 0.19, -0.15);
plateBack.castShadow = true;
chestGroup.add(plateBack);

for (let px = -0.12; px <= 0.12; px += 0.12) {
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.15, 0.07), matVest);
  pouch.position.set(px, 0.12, 0.21);
  pouch.castShadow = true;
  chestGroup.add(pouch);
}

const radio = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), matVest);
radio.position.set(-0.24, 0.24, 0.08);
radio.castShadow = true;
chestGroup.add(radio);

const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), matGunMetal);
antenna.position.set(-0.25, 0.44, 0.08);
chestGroup.add(antenna);

const headGroup = new THREE.Group();
headGroup.position.set(0, 0.44, 0);
chestGroup.add(headGroup);

const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 10), matSkin);
neck.position.set(0, 0.04, 0);
neck.castShadow = true;
headGroup.add(neck);

const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.25, 0.23), matSkin);
head.position.set(0, 0.16, 0.02);
head.castShadow = true;
headGroup.add(head);

const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.31), matHelmet);
helmet.position.set(0, 0.24, 0.02);
helmet.castShadow = true;
headGroup.add(helmet);

const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), matArmor);
nvgMount.position.set(0, 0.24, 0.18);
headGroup.add(nvgMount);

const visor = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.08, 0.06), matVisor);
visor.position.set(0, 0.17, 0.14);
headGroup.add(visor);

const lShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.18), matArmor);
lShoulder.position.set(-0.31, 0.3, 0);
lShoulder.castShadow = true;
chestGroup.add(lShoulder);

const rShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.18), matArmor);
rShoulder.position.set(0.31, 0.3, 0);
rShoulder.castShadow = true;
chestGroup.add(rShoulder);

const lArmUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.16), matUniform);
lArmUpper.position.set(-0.31, 0.1, 0.04);
lArmUpper.rotation.x = -0.35;
lArmUpper.rotation.z = 0.12;
lArmUpper.castShadow = true;
chestGroup.add(lArmUpper);

const rArmUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.16), matUniform);
rArmUpper.position.set(0.31, 0.1, 0.03);
rArmUpper.rotation.x = -0.42;
rArmUpper.rotation.z = -0.15;
rArmUpper.castShadow = true;
chestGroup.add(rArmUpper);

const lArmFore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), matUniform);
lArmFore.position.set(-0.25, -0.06, 0.22);
lArmFore.rotation.x = -1.1;
lArmFore.rotation.y = 0.45;
lArmFore.castShadow = true;
chestGroup.add(lArmFore);

const rArmFore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), matUniform);
rArmFore.position.set(0.23, -0.04, 0.2);
rArmFore.rotation.x = -1.0;
rArmFore.rotation.y = -0.4;
rArmFore.castShadow = true;
chestGroup.add(rArmFore);

const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.12), matGloves);
lGlove.position.set(-0.16, -0.15, 0.38);
lGlove.rotation.x = -0.9;
lGlove.rotation.y = 0.4;
lGlove.castShadow = true;
chestGroup.add(lGlove);

const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.12), matGloves);
rGlove.position.set(0.12, -0.14, 0.33);
rGlove.rotation.x = -0.9;
rGlove.rotation.y = -0.4;
rGlove.castShadow = true;
chestGroup.add(rGlove);

const weaponGroup = new THREE.Group();
weaponGroup.position.set(0.04, -0.02, 0.36);
weaponGroup.rotation.set(-0.45, 0.32, -0.38);
chestGroup.add(weaponGroup);
weaponGroup.add(buildLobbyWeaponMesh('mk7'));

let currentLobbyWeaponId = 'mk7';
let currentLobbyAttKey = '';

export function getLobbyWeaponId() {
  return currentLobbyWeaponId;
}

export function setLobbyWeapon(weaponId, attachments = null) {
  const cleanAtt = cloneAttachments(attachments);
  const attKey = JSON.stringify(cleanAtt);
  if (currentLobbyWeaponId === weaponId && currentLobbyAttKey === attKey && weaponGroup.children.length > 0) return;
  currentLobbyWeaponId = weaponId;
  currentLobbyAttKey = attKey;
  while (weaponGroup.children.length > 0) {
    const child = weaponGroup.children[0];
    weaponGroup.remove(child);
    disposeHierarchyGeometries(child);
  }
  weaponGroup.add(buildLobbyWeaponMesh(weaponId, cleanAtt));
}

const SHOWCASE_ORIGIN = new THREE.Vector3(-0.15, 1.48, 0.55);
const DEFAULT_SHOWCASE_YAW = -0.34;
const DEFAULT_SHOWCASE_PITCH = 0.08;
const SHOWCASE_VIEW_DIR = new THREE.Vector3(0.06, -0.09, -0.994).normalize();
const SHOWCASE_UP = new THREE.Vector3(0, 1, 0);
const SHOWCASE_RIGHT = new THREE.Vector3().crossVectors(SHOWCASE_VIEW_DIR, SHOWCASE_UP).normalize();
const SHOWCASE_CAM_UP = new THREE.Vector3().crossVectors(SHOWCASE_RIGHT, SHOWCASE_VIEW_DIR).normalize();

const SHOWCASE_SPANS = {
  p12: 0.72,
  knife: 0.68,
  vector9: 1.15,
  mp5k: 1.08,
  mk7: 1.42,
  ak12: 1.44,
  m870: 1.48,
  mk48: 1.50,
  awm338: 1.54
};

const showcaseRoot = new THREE.Group();
showcaseRoot.position.copy(SHOWCASE_ORIGIN);
showcaseRoot.visible = false;
lobbyScene.add(showcaseRoot);

const showcasePivot = new THREE.Group();
showcasePivot.rotation.order = 'XYZ';
showcasePivot.rotation.set(DEFAULT_SHOWCASE_PITCH, DEFAULT_SHOWCASE_YAW, 0);
showcaseRoot.add(showcasePivot);

const showcaseHolder = new THREE.Group();
showcasePivot.add(showcaseHolder);

const showcaseLights = new THREE.Group();
showcaseLights.visible = false;
lobbyScene.add(showcaseLights);

const studioTarget = new THREE.Object3D();
studioTarget.position.copy(SHOWCASE_ORIGIN);
showcaseLights.add(studioTarget);

const studioKey = new THREE.DirectionalLight(0xf8fafc, 3.35);
studioKey.position.set(-0.4, 2.2, 3.8);
studioKey.target = studioTarget;
showcaseLights.add(studioKey);

const studioBackBounce = new THREE.DirectionalLight(0xcbd5e1, 2.35);
studioBackBounce.position.set(1.1, -0.45, -2.8);
studioBackBounce.target = studioTarget;
showcaseLights.add(studioBackBounce);

const studioRim = new THREE.PointLight(0x38bdf8, 9.5, 6.5, 2);
studioRim.position.set(-0.15, 2.45, -0.85);
showcaseLights.add(studioRim);

const showcaseState = {
  weaponId: 'mk7',
  status: 'UNLOCKED',
  implementation: 'IMPLEMENTED',
  attachments: cloneAttachments(null),
  attachmentsKey: '',
  scale: 1,
  halfW: 0.72,
  halfH: 0.24,
  halfD: 0.14,
  yaw: DEFAULT_SHOWCASE_YAW,
  pitch: DEFAULT_SHOWCASE_PITCH,
  targetYaw: DEFAULT_SHOWCASE_YAW,
  targetPitch: DEFAULT_SHOWCASE_PITCH,
  zoom: 2.35,
  targetZoom: 2.35,
  baseZoom: 2.35,
  minZoom: 1.25,
  maxZoom: 3.60,
  ndcX: 0.35,
  ndcY: -0.05
};

function getShowcaseViewportMetrics() {
  const w = Math.max(320, window.innerWidth || 1280);
  const h = Math.max(240, window.innerHeight || 720);
  const headerEl = typeof document !== 'undefined' ? document.getElementById('lobby-header') : null;
  const panelEl = typeof document !== 'undefined' ? document.querySelector('.loadout-panel') : null;
  const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
  const panelRect = panelEl ? panelEl.getBoundingClientRect() : null;

  const headerBottom = (headerRect && headerRect.height > 0) ? headerRect.bottom : (w <= 768 ? 54 : 64);
  let panelRight = 0;
  if (w > 768) {
    panelRight = (panelRect && panelRect.width > 0) ? panelRect.right : (w <= 1024 ? 404 : 504);
  }

  const padX = Math.max(24, Math.min(54, w * 0.03));
  const padTop = w <= 768 ? 40 : (w <= 1024 ? 86 : 74);
  const padBottom = w <= 768 ? 48 : (w <= 1024 ? 124 : 112);

  const left = Math.min(w - 160, panelRight + padX);
  const right = Math.max(left + 120, w - padX);
  const top = headerBottom + padTop;
  const bottom = Math.max(top + 120, h - padBottom);

  const stageCenterX = (left + right) * 0.5;
  const stageCenterY = (top + bottom) * 0.5;
  const freeW = right - left;
  const freeH = bottom - top;

  return {
    w,
    h,
    aspect: w / h,
    freeW,
    freeH,
    freeWFrac: freeW / w,
    freeHFrac: freeH / h,
    ndcX: (stageCenterX / w) * 2 - 1,
    ndcY: 1 - (stageCenterY / h) * 2
  };
}

export function recomputeShowcaseFraming(resetZoom = false) {
  const m = getShowcaseViewportMetrics();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(lobbyCamera.fov * 0.5));
  const cosYaw = Math.cos(DEFAULT_SHOWCASE_YAW);
  const sinYaw = Math.sin(Math.abs(DEFAULT_SHOWCASE_YAW));
  const spanX = Math.max(
    showcaseState.halfW * cosYaw + showcaseState.halfD * sinYaw,
    showcaseState.halfW * 0.92,
    showcaseState.halfD
  );
  const spanY = Math.max(showcaseState.halfH, 0.22);
  const nearDepth = showcaseState.halfW * sinYaw + showcaseState.halfD * cosYaw;

  const dX = nearDepth + spanX / (0.68 * tanHalf * m.aspect * m.freeWFrac);
  const dY = nearDepth + spanY / (0.60 * tanHalf * m.freeHFrac);
  const baseDist = Math.max(1.75, dX, dY);

  const prevBase = showcaseState.baseZoom || baseDist;
  const ratio = prevBase > 0 ? baseDist / prevBase : 1;

  showcaseState.baseZoom = baseDist;
  showcaseState.minZoom = Math.max(0.95, baseDist * 0.55);
  showcaseState.maxZoom = baseDist * 1.55;
  showcaseState.ndcX = m.ndcX;
  showcaseState.ndcY = m.ndcY;

  if (resetZoom) {
    showcaseState.targetZoom = baseDist;
  } else {
    showcaseState.targetZoom = Math.max(showcaseState.minZoom, Math.min(showcaseState.maxZoom, showcaseState.targetZoom * ratio));
    showcaseState.zoom = Math.max(showcaseState.minZoom, Math.min(showcaseState.maxZoom, showcaseState.zoom * ratio));
  }
}

function updateShowcaseLights(meta = {}) {
  const status = meta.status || 'UNLOCKED';
  const impl = meta.implementation || 'IMPLEMENTED';
  if (impl === 'PLANNED') {
    studioKey.intensity = 2.75;
    studioRim.color.setHex(0x0ea5e9);
    studioRim.intensity = 10.0;
  } else if (status === 'LOCKED') {
    studioKey.intensity = 2.65;
    studioRim.color.setHex(0xef4444);
    studioRim.intensity = 9.0;
  } else {
    studioKey.intensity = 3.35;
    studioRim.color.setHex(0x38bdf8);
    studioRim.intensity = 9.5;
  }
}

function updateShowcaseBoundsFromWrapper(wrapper) {
  const prevPitch = showcasePivot.rotation.x;
  const prevYaw = showcasePivot.rotation.y;
  const prevRootX = showcaseRoot.position.x;
  const prevRootY = showcaseRoot.position.y;
  const prevRootZ = showcaseRoot.position.z;
  showcasePivot.rotation.set(0, 0, 0);
  showcaseRoot.position.set(0, 0, 0);
  showcaseRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrapper);
  showcasePivot.rotation.set(prevPitch, prevYaw, 0);
  showcaseRoot.position.set(prevRootX, prevRootY, prevRootZ);
  showcaseRoot.updateMatrixWorld(true);
  if (!box.isEmpty()) {
    showcaseState.halfW = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
    showcaseState.halfH = Math.max(Math.abs(box.min.y), Math.abs(box.max.y));
    showcaseState.halfD = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
  }
}

export function setShowcaseWeapon(weaponId, options = {}) {
  const id = weaponId || 'mk7';
  const status = options.status || 'UNLOCKED';
  const impl = options.implementation || 'IMPLEMENTED';
  const cleanAtt = impl === 'IMPLEMENTED' ? cloneAttachments(options.attachments) : cloneAttachments(null);
  const attKey = JSON.stringify(cleanAtt);

  if (
    showcaseHolder.children.length > 0 &&
    showcaseState.weaponId === id &&
    showcaseState.status === status &&
    showcaseState.implementation === impl
  ) {
    updateShowcaseLights(options);
    if (showcaseState.attachmentsKey === attKey) return;
    const wrapper = showcaseHolder.children[0];
    const model = wrapper?.userData?.showcaseModel;
    if (model && impl === 'IMPLEMENTED') {
      applyAttachmentsToModel(model, id, cleanAtt);
      showcaseState.attachments = cleanAtt;
      showcaseState.attachmentsKey = attKey;
      updateShowcaseBoundsFromWrapper(wrapper);
      recomputeShowcaseFraming(false);
      return;
    }
  }

  while (showcaseHolder.children.length > 0) {
    const child = showcaseHolder.children[0];
    showcaseHolder.remove(child);
    disposeHierarchyGeometries(child);
  }

  showcaseState.weaponId = id;
  showcaseState.status = status;
  showcaseState.implementation = impl;
  showcaseState.attachments = cleanAtt;
  showcaseState.attachmentsKey = attKey;

  const baseMesh = buildShowcaseWeaponMesh(id, { ...options, attachments: null });
  baseMesh.updateMatrixWorld(true);
  const baseBox = new THREE.Box3().setFromObject(baseMesh);
  const baseSize = baseBox.getSize(new THREE.Vector3());
  const baseCenter = baseBox.getCenter(new THREE.Vector3());
  const maxDim = Math.max(baseSize.x, baseSize.y, baseSize.z, 0.001);
  const targetSpan = SHOWCASE_SPANS[id] || 1.42;
  const scale = targetSpan / maxDim;

  baseMesh.scale.setScalar(scale);
  baseMesh.position.set(-baseCenter.x * scale, -baseCenter.y * scale, -baseCenter.z * scale);
  if (impl === 'IMPLEMENTED' && baseMesh.userData?.showcaseModel) {
    applyAttachmentsToModel(baseMesh.userData.showcaseModel, id, cleanAtt);
  }
  showcaseHolder.add(baseMesh);
  showcaseHolder.updateMatrixWorld(true);

  showcaseState.scale = scale;
  updateShowcaseBoundsFromWrapper(baseMesh);

  updateShowcaseLights(options);
  recomputeShowcaseFraming(true);
}

export function rotateShowcase(deltaYaw, deltaPitch) {
  showcaseState.targetYaw += deltaYaw;
  showcaseState.targetPitch = Math.max(-0.55, Math.min(0.55, showcaseState.targetPitch + deltaPitch));
}

export function zoomShowcase(delta) {
  showcaseState.targetZoom = Math.max(
    showcaseState.minZoom,
    Math.min(showcaseState.maxZoom, showcaseState.targetZoom + delta)
  );
}

export function resetShowcaseView() {
  showcaseState.targetYaw = DEFAULT_SHOWCASE_YAW;
  showcaseState.targetPitch = DEFAULT_SHOWCASE_PITCH;
  recomputeShowcaseFraming(true);
}

export function getShowcaseState() {
  const camOrigin = lobbyCamera.position;
  return {
    weaponId: showcaseState.weaponId,
    status: showcaseState.status,
    implementation: showcaseState.implementation,
    attachments: cloneAttachments(showcaseState.attachments),
    operatorVisible: operator.visible,
    showcaseVisible: showcaseRoot.visible,
    lightsVisible: showcaseLights.visible,
    yaw: showcaseState.yaw,
    pitch: showcaseState.pitch,
    targetYaw: showcaseState.targetYaw,
    targetPitch: showcaseState.targetPitch,
    zoom: showcaseState.zoom,
    targetZoom: showcaseState.targetZoom,
    baseZoom: showcaseState.baseZoom,
    minZoom: showcaseState.minZoom,
    maxZoom: showcaseState.maxZoom,
    scale: showcaseState.scale,
    halfW: showcaseState.halfW,
    halfH: showcaseState.halfH,
    cameraPos: [camOrigin.x, camOrigin.y, camOrigin.z]
  };
}

function isHierarchyVisible(obj) {
  let cur = obj;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

function projectObjectScreenBounds(root) {
  root.updateMatrixWorld(true);
  lobbyCamera.updateMatrixWorld(true);
  lobbyCamera.updateProjectionMatrix();
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasMesh = false;
  const p = new THREE.Vector3();
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !isHierarchyVisible(obj)) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const b = obj.geometry.boundingBox;
    if (!b || b.isEmpty()) return;
    hasMesh = true;
    for (let ix = 0; ix < 2; ix++) {
      const bx = ix === 0 ? b.min.x : b.max.x;
      for (let iy = 0; iy < 2; iy++) {
        const by = iy === 0 ? b.min.y : b.max.y;
        for (let iz = 0; iz < 2; iz++) {
          const bz = iz === 0 ? b.min.z : b.max.z;
          p.set(bx, by, bz).applyMatrix4(obj.matrixWorld).project(lobbyCamera);
          const sx = (p.x * 0.5 + 0.5) * w;
          const sy = (-p.y * 0.5 + 0.5) * h;
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }
      }
    }
  });
  if (!hasMesh) return null;
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) * 0.5, cy: (minY + maxY) * 0.5 };
}

export function getShowcaseScreenBounds() {
  if (showcaseHolder.children.length === 0) return null;
  return projectObjectScreenBounds(showcaseHolder);
}

export function getOperatorScreenBounds() {
  return projectObjectScreenBounds(operator);
}

let idleTime = 0;
let currentLobbyView = 'play';
const targetLook = new THREE.Vector3(0.68, 1.10, 0);
const curLook = new THREE.Vector3(0.68, 1.10, 0);
const targetCam = new THREE.Vector3(0.12, 1.28, 3.30);

function applyShowcaseCameraTargets(distance) {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(lobbyCamera.fov * 0.5));
  const aspect = lobbyCamera.aspect || (window.innerWidth / Math.max(1, window.innerHeight));
  const offRight = -showcaseState.ndcX * distance * tanHalf * aspect;
  const offUp = -showcaseState.ndcY * distance * tanHalf;
  targetLook.copy(SHOWCASE_ORIGIN)
    .addScaledVector(SHOWCASE_RIGHT, offRight)
    .addScaledVector(SHOWCASE_CAM_UP, offUp);
  targetCam.copy(targetLook).addScaledVector(SHOWCASE_VIEW_DIR, -distance);
}

export function setLobbyView(view) {
  currentLobbyView = view || 'play';
  const isLoadout = currentLobbyView === 'loadout';
  operator.visible = !isLoadout;
  showcaseRoot.visible = isLoadout;
  showcaseLights.visible = isLoadout;

  if (currentLobbyView === 'operator') {
    targetCam.set(0.24, 1.20, 3.30);
    targetLook.set(0.64, 1.08, -0.05);
  } else if (isLoadout) {
    recomputeShowcaseFraming(false);
    applyShowcaseCameraTargets(showcaseState.targetZoom);
  } else {
    targetCam.set(0.12, 1.28, 3.30);
    targetLook.set(0.68, 1.10, 0);
  }
}

export function setOperatorCamo(scheme) {
  if (scheme === 'specops') {
    matUniform.color.setHex(0x20242a);
    matVest.color.setHex(0x16181b);
    matVisor.emissive.setHex(0xff9900);
  } else if (scheme === 'recon') {
    matUniform.color.setHex(0x323e35);
    matVest.color.setHex(0x202822);
    matVisor.emissive.setHex(0x00e5ff);
  } else {
    matUniform.color.setHex(0x38424f);
    matVest.color.setHex(0x252a32);
    matVisor.emissive.setHex(0xff3b1a);
  }
}

export function updateLobby(dt) {
  idleTime += dt;

  if (currentLobbyView === 'loadout') {
    const rotAlpha = Math.min(1, dt * 12);
    showcaseState.yaw += (showcaseState.targetYaw - showcaseState.yaw) * rotAlpha;
    showcaseState.pitch += (showcaseState.targetPitch - showcaseState.pitch) * rotAlpha;
    showcaseState.zoom += (showcaseState.targetZoom - showcaseState.zoom) * Math.min(1, dt * 10);

    showcasePivot.rotation.set(showcaseState.pitch, showcaseState.yaw, 0);
    showcaseHolder.position.y = Math.sin(idleTime * 1.4) * 0.008;

    applyShowcaseCameraTargets(showcaseState.zoom);
    const camAlpha = Math.min(1, dt * 8);
    lobbyCamera.position.lerp(targetCam, camAlpha);
    curLook.lerp(targetLook, camAlpha);
    lobbyCamera.lookAt(curLook);
    return;
  }

  chestGroup.position.y = 0.24 + Math.sin(idleTime * 1.8) * 0.007;
  chestGroup.rotation.x = Math.sin(idleTime * 1.8) * 0.006;
  headGroup.rotation.y = Math.sin(idleTime * 0.5) * 0.04;
  headGroup.rotation.x = Math.cos(idleTime * 0.7) * 0.015;
  weaponGroup.position.y = -0.02 + Math.sin(idleTime * 1.8 + 0.3) * 0.005;

  const swayX = Math.sin(idleTime * 0.35) * 0.035;
  const swayY = Math.cos(idleTime * 0.45) * 0.02;

  lobbyCamera.position.x += (targetCam.x + swayX - lobbyCamera.position.x) * Math.min(1, dt * 6);
  lobbyCamera.position.y += (targetCam.y + swayY - lobbyCamera.position.y) * Math.min(1, dt * 6);
  lobbyCamera.position.z += (targetCam.z - lobbyCamera.position.z) * Math.min(1, dt * 6);

  curLook.lerp(targetLook, Math.min(1, dt * 6));
  lobbyCamera.lookAt(curLook);
}
