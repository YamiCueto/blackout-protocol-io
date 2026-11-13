import * as THREE from 'three';
import { ATTACHMENT_SLOT_KEYS } from './attachments.js';

const attDark = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.42, metalness: 0.78 });
const attPolymer = new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.72, metalness: 0.24 });
const attSteel = new THREE.MeshStandardMaterial({ color: 0x525a66, roughness: 0.32, metalness: 0.86 });
const attSuppressorBody = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.56, metalness: 0.62 });
const attAccent = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55, metalness: 0.2 });
const attLensGlass = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.1,
  metalness: 0.25,
  transparent: true,
  opacity: 0.22,
  side: THREE.DoubleSide,
  depthWrite: false
});
const attRedReticle = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const attHoloReticle = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide });

const SHARED_RETICLE_DOT_GEO = new THREE.SphereGeometry(0.0014, 6, 6);
SHARED_RETICLE_DOT_GEO.userData.shared = true;

export const SHARED_ATTACHMENT_GEOMETRIES = [SHARED_RETICLE_DOT_GEO];

export const WEAPON_ATTACHMENT_ANCHORS = {
  mk7: {
    optic: { pos: [0, 0.075, -0.06], rot: [0, 0, 0], scale: 1.0, hides: ['optic_default', 'sight_front'], adsYOffset: -0.015, adsYOffsetRedDot: -0.015, adsYOffsetHolo: -0.018 },
    muzzle: { pos: [0, 0.012, -0.735], rot: [0, 0, 0], scale: 1.0, hides: ['muzzle_default'] },
    magazine: { pos: [0, -0.14, -0.04], rot: [0.18, 0, 0], scale: 1.0, hides: ['magazine_default'] },
    underbarrel: { pos: [0, -0.08, -0.33], rot: [0, 0, 0], scale: 1.0, hides: [] },
    stock: { pos: [0, -0.01, 0.19], rot: [0, 0, 0], scale: 1.0, hides: ['stock_default'] }
  },
  vector9: {
    optic: { pos: [0, 0.078, -0.05], rot: [0, 0, 0], scale: 0.92, hides: ['optic_default'], adsYOffset: -0.005, adsYOffsetRedDot: -0.005, adsYOffsetHolo: -0.0078 },
    muzzle: { pos: [0, 0.018, -0.47], rot: [0, 0, 0], scale: 0.94, hides: [] },
    magazine: { pos: [0, -0.22, -0.16], rot: [-0.12, 0, 0], scale: 0.92, hides: ['magazine_default'] },
    underbarrel: { pos: [0, -0.021, -0.27], rot: [0, 0, 0], scale: 0.9, hides: [] },
    stock: { pos: [0, 0.01, 0.11], rot: [0, 0, 0], scale: 0.92, hides: ['stock_default'] }
  },
  m870: {
    optic: { pos: [0, 0.0625, -0.04], rot: [0, 0, 0], scale: 0.95, hides: [], adsYOffset: -0.01425, adsYOffsetRedDot: -0.01425, adsYOffsetHolo: -0.0171 },
    muzzle: { pos: [0, 0.038, -0.8], rot: [0, 0, 0], scale: 1.05, hides: [] },
    stock: { pos: [0, -0.015, 0.22], rot: [0, 0, 0], scale: 1.0, hides: ['stock_default'] }
  },
  p12: {
    optic: { pos: [0, 0.0475, 0.0], rot: [0, 0, 0], scale: 0.68, hides: ['optic_default'], adsYOffset: -0.0065, adsYOffsetRedDot: -0.0065, adsYOffsetHolo: -0.0065 },
    muzzle: { pos: [0, 0.015, -0.29], rot: [0, 0, 0], scale: 0.72, hides: [] },
    magazine: { pos: [0, -0.155, 0.055], rot: [-0.28, 0, 0], scale: 0.72, hides: [] }
  }
};

export const MUZZLE_Z_EXTEND = {
  muzzle_compensator: 0.088,
  muzzle_suppressor: 0.195
};

export function disposeNonSharedGeometries(root) {
  if (!root) return 0;
  const geometries = new Set();
  root.traverse(o => {
    if (o.isMesh && o.geometry && !o.geometry.userData?.shared) {
      geometries.add(o.geometry);
    }
  });
  for (const g of geometries) g.dispose();
  return geometries.size;
}

function addPart(group, geo, mat, pos, rot = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  group.add(m);
  return m;
}

function buildOpticRedDot() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.032, 0.014, 0.056), attDark, [0, 0.007, 0]);
  addPart(g, new THREE.BoxGeometry(0.005, 0.024, 0.032), attSteel, [-0.014, 0.025, 0]);
  addPart(g, new THREE.BoxGeometry(0.005, 0.024, 0.032), attSteel, [0.014, 0.025, 0]);
  addPart(g, new THREE.BoxGeometry(0.032, 0.005, 0.032), attDark, [0, 0.038, 0]);
  addPart(g, new THREE.BoxGeometry(0.016, 0.008, 0.012), attPolymer, [0.017, 0.018, 0.006]);
  addPart(g, new THREE.PlaneGeometry(0.023, 0.019), attLensGlass, [0, 0.025, -0.004]);
  const dot = new THREE.Mesh(SHARED_RETICLE_DOT_GEO, attRedReticle);
  dot.position.set(0, 0.025, -0.002);
  g.add(dot);
  return g;
}

function buildOpticHolo() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.036, 0.013, 0.072), attDark, [0, 0.0065, 0]);
  addPart(g, new THREE.BoxGeometry(0.034, 0.024, 0.024), attPolymer, [0, 0.024, -0.023]);
  addPart(g, new THREE.BoxGeometry(0.006, 0.03, 0.052), attDark, [-0.016, 0.028, 0.004]);
  addPart(g, new THREE.BoxGeometry(0.006, 0.03, 0.052), attDark, [0.016, 0.028, 0.004]);
  addPart(g, new THREE.BoxGeometry(0.038, 0.007, 0.054), attSteel, [0, 0.044, 0.004]);
  addPart(g, new THREE.BoxGeometry(0.036, 0.005, 0.042), attPolymer, [0, 0.015, 0.01]);
  addPart(g, new THREE.PlaneGeometry(0.026, 0.022), attLensGlass, [0, 0.028, 0.008]);
  addPart(g, new THREE.RingGeometry(0.0045, 0.0058, 16), attHoloReticle, [0, 0.028, 0.01]);
  const dot = new THREE.Mesh(SHARED_RETICLE_DOT_GEO, attHoloReticle);
  dot.position.set(0, 0.028, 0.01);
  g.add(dot);
  return g;
}

function buildMuzzleCompensator() {
  const g = new THREE.Group();
  addPart(g, new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), attSteel, [0, 0, -0.01], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.BoxGeometry(0.042, 0.034, 0.068), attDark, [0, 0, -0.052]);
  addPart(g, new THREE.BoxGeometry(0.045, 0.01, 0.012), attSteel, [0, 0.012, -0.036]);
  addPart(g, new THREE.BoxGeometry(0.045, 0.01, 0.012), attSteel, [0, 0.012, -0.062]);
  addPart(g, new THREE.CylinderGeometry(0.021, 0.021, 0.01, 12), attSteel, [0, 0, -0.088], [Math.PI / 2, 0, 0]);
  return g;
}

function buildMuzzleSuppressor() {
  const g = new THREE.Group();
  addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 0.024, 14), attSteel, [0, 0, -0.012], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.0265, 0.0265, 0.018, 14), attSteel, [0, 0, -0.035], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 0.16, 16), attSuppressorBody, [0, 0, -0.11], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.026, 0.026, 0.014, 14), attDark, [0, 0, -0.184], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.016, 0.016, 0.008, 12), attPolymer, [0, 0, -0.193], [Math.PI / 2, 0, 0]);
  return g;
}

function buildMagazineExtended() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.048, 0.16, 0.095), attDark, [0, -0.01, 0]);
  addPart(g, new THREE.BoxGeometry(0.052, 0.145, 0.098), attPolymer, [0, -0.138, -0.012], [0.14, 0, 0]);
  addPart(g, new THREE.BoxGeometry(0.058, 0.024, 0.106), attSteel, [0, -0.208, -0.022], [0.14, 0, 0]);
  return g;
}

function buildMagazineFast() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.048, 0.195, 0.094), attDark, [0, 0, 0]);
  addPart(g, new THREE.BoxGeometry(0.054, 0.028, 0.102), attPolymer, [0, -0.055, 0]);
  addPart(g, new THREE.BoxGeometry(0.056, 0.022, 0.106), attAccent, [0, -0.102, 0]);
  addPart(g, new THREE.TorusGeometry(0.02, 0.006, 8, 14), attAccent, [0, -0.125, 0.01], [0, Math.PI / 2, 0]);
  return g;
}

function buildUnderbarrelVertical() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.042, 0.018, 0.058), attSteel, [0, -0.009, 0]);
  addPart(g, new THREE.CylinderGeometry(0.017, 0.019, 0.112, 12), attPolymer, [0, -0.072, 0]);
  addPart(g, new THREE.CylinderGeometry(0.021, 0.02, 0.014, 12), attDark, [0, -0.13, 0]);
  return g;
}

function buildUnderbarrelAngled() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.04, 0.016, 0.115), attSteel, [0, -0.008, 0]);
  addPart(g, new THREE.BoxGeometry(0.036, 0.036, 0.088), attPolymer, [0, -0.026, -0.008], [-0.36, 0, 0]);
  addPart(g, new THREE.BoxGeometry(0.038, 0.042, 0.026), attDark, [0, -0.024, 0.042]);
  return g;
}

function buildStockLight() {
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(0.046, 0.058, 0.036), attSteel, [0, 0.005, 0.018]);
  addPart(g, new THREE.BoxGeometry(0.018, 0.018, 0.21), attDark, [0, 0.025, 0.125]);
  addPart(g, new THREE.BoxGeometry(0.014, 0.014, 0.195), attSteel, [0, -0.022, 0.118], [-0.22, 0, 0]);
  addPart(g, new THREE.BoxGeometry(0.036, 0.098, 0.024), attPolymer, [0, -0.012, 0.232]);
  return g;
}

function buildStockTactical() {
  const g = new THREE.Group();
  addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12), attSteel, [0, 0.015, 0.11], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.BoxGeometry(0.058, 0.086, 0.21), attDark, [0, -0.016, 0.155]);
  addPart(g, new THREE.BoxGeometry(0.064, 0.03, 0.135), attPolymer, [0, 0.034, 0.145]);
  addPart(g, new THREE.BoxGeometry(0.062, 0.13, 0.028), attPolymer, [0, -0.024, 0.265]);
  return g;
}

const VISUAL_BUILDERS = {
  optic_reddot: buildOpticRedDot,
  optic_holo: buildOpticHolo,
  muzzle_compensator: buildMuzzleCompensator,
  muzzle_suppressor: buildMuzzleSuppressor,
  magazine_extended: buildMagazineExtended,
  magazine_fast: buildMagazineFast,
  underbarrel_vertical: buildUnderbarrelVertical,
  underbarrel_angled: buildUnderbarrelAngled,
  stock_light: buildStockLight,
  stock_tactical: buildStockTactical
};

export function buildAttachmentMesh(attachmentId) {
  const builder = VISUAL_BUILDERS[attachmentId];
  if (!builder) return null;
  const grp = builder();
  grp.userData.attachmentId = attachmentId;
  return grp;
}

function ensureSlotContainer(modelRoot, slot, anchor) {
  if (!modelRoot.userData.attachmentContainers) {
    modelRoot.userData.attachmentContainers = {};
  }
  let container = modelRoot.userData.attachmentContainers[slot];
  if (!container) {
    container = new THREE.Group();
    container.name = `att_slot_${slot}`;
    modelRoot.add(container);
    modelRoot.userData.attachmentContainers[slot] = container;
  }
  container.position.set(anchor.pos[0], anchor.pos[1], anchor.pos[2]);
  container.rotation.set(anchor.rot[0], anchor.rot[1], anchor.rot[2]);
  const sc = anchor.scale || 1;
  container.scale.setScalar(sc);
  return container;
}

export function applyAttachmentsToModel(modelRoot, weaponId, attachmentMap = null, options = {}) {
  const anchors = WEAPON_ATTACHMENT_ANCHORS[weaponId] || {};
  const map = attachmentMap || {};
  if (!modelRoot.userData.appliedAttachments) {
    modelRoot.userData.appliedAttachments = {};
  }

  const hiddenRoles = new Set();
  let adsYOffset = 0;
  let muzzlePosOverride = null;

  for (const slot of ATTACHMENT_SLOT_KEYS) {
    const anchor = anchors[slot];
    const targetId = anchor ? (map[slot] || null) : null;
    const prevId = modelRoot.userData.appliedAttachments[slot] || null;

    if (targetId && anchor && Array.isArray(anchor.hides)) {
      for (const role of anchor.hides) hiddenRoles.add(role);
    }

    if (targetId === 'optic_reddot') {
      if (anchor && Number.isFinite(anchor.adsYOffsetRedDot ?? anchor.adsYOffset)) {
        adsYOffset = anchor.adsYOffsetRedDot ?? anchor.adsYOffset;
      }
    } else if (targetId === 'optic_holo') {
      if (anchor && Number.isFinite(anchor.adsYOffsetHolo ?? anchor.adsYOffset)) {
        adsYOffset = anchor.adsYOffsetHolo ?? anchor.adsYOffset;
      }
    }

    if (slot === 'muzzle' && targetId && anchor && MUZZLE_Z_EXTEND[targetId]) {
      const ext = MUZZLE_Z_EXTEND[targetId] * (anchor.scale || 1);
      muzzlePosOverride = [anchor.pos[0], anchor.pos[1], anchor.pos[2] - ext];
    }

    if (prevId === targetId && !options.forceRebuild) {
      continue;
    }

    if (modelRoot.userData.attachmentContainers?.[slot]) {
      const container = modelRoot.userData.attachmentContainers[slot];
      while (container.children.length > 0) {
        const ch = container.children[0];
        container.remove(ch);
        disposeNonSharedGeometries(ch);
      }
    }

    if (targetId && anchor) {
      const container = ensureSlotContainer(modelRoot, slot, anchor);
      const attMesh = buildAttachmentMesh(targetId);
      if (attMesh) container.add(attMesh);
    }

    modelRoot.userData.appliedAttachments[slot] = targetId;
  }

  const roleRoot = options.roleRoot || modelRoot;
  roleRoot.traverse(o => {
    const role = o.userData?.partRole;
    if (role) {
      o.visible = !hiddenRoles.has(role);
    }
  });

  return {
    adsYOffset,
    muzzlePosOverride
  };
}
