import * as THREE from 'three';
import { settings } from './settings.js';

const _shoulderL = new THREE.Vector3();
const _shoulderR = new THREE.Vector3();
const _basePos = new THREE.Vector3();
const _targetVec = new THREE.Vector3();
const _flexBias = new THREE.Vector3();
const _flexPerp = new THREE.Vector3();
const _upperDir = new THREE.Vector3();
const _elbowWorld = new THREE.Vector3();
const _foreVec = new THREE.Vector3();
const _foreDir = new THREE.Vector3();
const _vHandL = new THREE.Vector3();
const _vHandR = new THREE.Vector3();

const shoulderCapGeo = new THREE.SphereGeometry(0.044, 8, 8);
const armUpperGeo = new THREE.CylinderGeometry(0.040, 0.046, 0.26, 8);
const elbowJointGeo = new THREE.SphereGeometry(0.038, 8, 8);
const elbowPadGeo = new THREE.BoxGeometry(0.062, 0.052, 0.034);
const armForeGeo = new THREE.CylinderGeometry(0.034, 0.040, 0.25, 8);
const wristCuffGeo = new THREE.CylinderGeometry(0.038, 0.036, 0.045, 8);
const wristBandGeo = new THREE.BoxGeometry(0.062, 0.022, 0.058);
const watchCaseGeo = new THREE.BoxGeometry(0.032, 0.014, 0.032);
const watchScreenGeo = new THREE.PlaneGeometry(0.022, 0.022);

const palmGeo = new THREE.BoxGeometry(0.052, 0.056, 0.024);
const palmPadGeo = new THREE.BoxGeometry(0.040, 0.026, 0.008);
const knucklePlateGeo = new THREE.BoxGeometry(0.052, 0.018, 0.016);

const fingerProxGeo = new THREE.BoxGeometry(0.013, 0.028, 0.014);
const fingerDistGeo = new THREE.BoxGeometry(0.012, 0.022, 0.013);
const thumbProxGeo = new THREE.BoxGeometry(0.014, 0.026, 0.015);
const thumbDistGeo = new THREE.BoxGeometry(0.013, 0.020, 0.014);

const matUniform = new THREE.MeshStandardMaterial({ color: 0x363e48, roughness: 0.85, metalness: 0.05, emissive: 0x121720, emissiveIntensity: 0.45 });
const matGlove = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.75, metalness: 0.15, emissive: 0x0e1115, emissiveIntensity: 0.40 });
const matGlovePad = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.90, metalness: 0.05, emissive: 0x090b0e, emissiveIntensity: 0.35 });
const matArmor = new THREE.MeshStandardMaterial({ color: 0x2c323a, roughness: 0.45, metalness: 0.55, emissive: 0x14181f, emissiveIntensity: 0.45 });
const matWatch = new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: 0.35, metalness: 0.70, emissive: 0x0d1014, emissiveIntensity: 0.40 });
const matScreen = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

function buildHandMesh(isLeft) {
  const grp = new THREE.Group();

  const palm = new THREE.Mesh(palmGeo, matGlove);
  palm.position.set(0, 0.028, 0);
  palm.castShadow = true;
  grp.add(palm);

  const palmPad = new THREE.Mesh(palmPadGeo, matGlovePad);
  palmPad.position.set(0, 0.022, -0.0125);
  palmPad.castShadow = true;
  grp.add(palmPad);

  const knucklePlate = new THREE.Mesh(knucklePlateGeo, matArmor);
  knucklePlate.position.set(0, 0.045, 0.012);
  knucklePlate.castShadow = true;
  grp.add(knucklePlate);

  const fingerSpacing = 0.0115;
  const startX = isLeft ? -0.017 : 0.017;
  const stepX = isLeft ? fingerSpacing : -fingerSpacing;

  for (let i = 0; i < 4; i++) {
    const fGrp = new THREE.Group();
    fGrp.position.set(startX + i * stepX, 0.054, 0.002);

    const fProx = new THREE.Mesh(fingerProxGeo, matGlove);
    fProx.position.set(0, 0.014, 0);
    fProx.castShadow = true;
    fGrp.add(fProx);

    const fDistGrp = new THREE.Group();
    fDistGrp.position.set(0, 0.028, 0);
    const fDist = new THREE.Mesh(fingerDistGeo, matGlovePad);
    fDist.position.set(0, 0.011, 0);
    fDist.castShadow = true;
    fDistGrp.add(fDist);
    fGrp.add(fDistGrp);

    if (isLeft) {
      fGrp.rotation.x = 0.65;
      fDistGrp.rotation.x = 0.85;
      fDistGrp.rotation.z = -0.05 * (i - 1.5);
    } else {
      if (i === 0) {
        fGrp.rotation.x = 0.35;
        fGrp.rotation.z = 0.12;
        fDistGrp.rotation.x = 0.28;
      } else {
        fGrp.rotation.x = 1.05;
        fDistGrp.rotation.x = 1.15;
        fDistGrp.rotation.z = 0.04 * (i - 2);
      }
    }
    grp.add(fGrp);
  }

  const thumbGrp = new THREE.Group();
  thumbGrp.position.set(isLeft ? 0.026 : -0.026, 0.016, 0.006);
  if (isLeft) {
    thumbGrp.rotation.set(0.25, 0.20, -0.55);
  } else {
    thumbGrp.rotation.set(0.35, -0.30, 0.70);
  }

  const tProx = new THREE.Mesh(thumbProxGeo, matGlove);
  tProx.position.set(0, 0.013, 0);
  tProx.castShadow = true;
  thumbGrp.add(tProx);

  const tDistGrp = new THREE.Group();
  tDistGrp.position.set(0, 0.026, 0);
  const tDist = new THREE.Mesh(thumbDistGeo, matGlovePad);
  tDist.position.set(0, 0.010, 0);
  tDist.castShadow = true;
  tDistGrp.add(tDist);
  tDistGrp.rotation.x = 0.55;
  thumbGrp.add(tDistGrp);

  grp.add(thumbGrp);

  return grp;
}

function buildArmHierarchy(isLeft) {
  const root = new THREE.Group();
  root.name = isLeft ? 'leftArmRoot' : 'rightArmRoot';

  const shoulderCap = new THREE.Mesh(shoulderCapGeo, matUniform);
  shoulderCap.castShadow = true;
  root.add(shoulderCap);

  const upper = new THREE.Mesh(armUpperGeo, matUniform);
  upper.castShadow = true;
  root.add(upper);

  const elbow = new THREE.Group();
  elbow.name = isLeft ? 'leftElbow' : 'rightElbow';
  root.add(elbow);

  const elbowJoint = new THREE.Mesh(elbowJointGeo, matUniform);
  elbowJoint.castShadow = true;
  elbow.add(elbowJoint);

  const elbowPad = new THREE.Mesh(elbowPadGeo, matArmor);
  elbowPad.position.set(isLeft ? -0.015 : 0.015, 0, 0.020);
  elbowPad.castShadow = true;
  elbow.add(elbowPad);

  const fore = new THREE.Mesh(armForeGeo, matUniform);
  fore.castShadow = true;
  elbow.add(fore);

  const wrist = new THREE.Mesh(wristBandGeo, matGlove);
  wrist.name = isLeft ? 'leftWrist' : 'rightWrist';
  wrist.castShadow = true;
  elbow.add(wrist);

  const wristCuff = new THREE.Mesh(wristCuffGeo, matUniform);
  wristCuff.position.set(0, -0.015, 0);
  wristCuff.castShadow = true;
  wrist.add(wristCuff);

  if (isLeft) {
    const watchCase = new THREE.Mesh(watchCaseGeo, matWatch);
    watchCase.position.set(0, 0.005, 0.025);
    watchCase.castShadow = true;
    wrist.add(watchCase);

    const watchScreen = new THREE.Mesh(watchScreenGeo, matScreen);
    watchScreen.position.set(0, 0.005, 0.033);
    watchScreen.rotation.y = 0;
    wrist.add(watchScreen);
  }

  const hand = buildHandMesh(isLeft);
  hand.name = isLeft ? 'leftHand' : 'rightHand';
  elbow.add(hand);

  return { root, upper, elbow, fore, wrist, hand };
}

export const armsRig = {
  group: new THREE.Group(),
  left: buildArmHierarchy(true),
  right: buildArmHierarchy(false),
  activeWeaponId: 'mk7'
};

armsRig.group.name = 'armsRigGroup';
armsRig.group.add(armsRig.left.root);
armsRig.group.add(armsRig.right.root);

export const WEAPON_ARM_ANCHORS = {
  mk7: {
    right: { pos: [0.012, -0.088, 0.085], rot: [-0.25, 0.04, -0.04] },
    left:  { pos: [-0.018, -0.038, -0.240], rot: [0.32, 0.16, 0.25] }
  },
  vector9: {
    right: { pos: [0.012, -0.088, 0.060], rot: [-0.28, 0.04, -0.04] },
    left:  { pos: [-0.016, -0.045, -0.150], rot: [0.35, 0.20, 0.30] }
  },
  m870: {
    right: { pos: [0.012, -0.085, 0.145], rot: [-0.28, 0.04, -0.04] },
    left:  { pos: [-0.016, -0.045, -0.420], rot: [0.25, 0.12, 0.25] }
  },
  p12: {
    right: { pos: [0.008, -0.078, 0.045], rot: [-0.28, 0.03, -0.03] },
    left:  { pos: [-0.016, -0.082, 0.045], rot: [-0.20, 0.25, 0.15] }
  },
  ak12: {
    right: { pos: [0.012, -0.088, 0.085], rot: [-0.28, 0.04, -0.04] },
    left:  { pos: [-0.018, -0.036, -0.260], rot: [0.32, 0.16, 0.25] }
  },
  mp5k: {
    right: { pos: [0.012, -0.082, 0.050], rot: [-0.26, 0.04, -0.04] },
    left:  { pos: [0.000, -0.072, -0.180], rot: [0.15, 0.08, 0.10] }
  },
  mk48: {
    right: { pos: [0.012, -0.096, 0.120], rot: [-0.28, 0.04, -0.04] },
    left:  { pos: [-0.020, -0.052, -0.320], rot: [0.30, 0.15, 0.25] }
  },
  awm338: {
    right: { pos: [0.012, -0.065, 0.220], rot: [-0.32, 0.04, -0.04] },
    left:  { pos: [-0.018, -0.052, -0.190], rot: [0.28, 0.12, 0.22] }
  },
  knife: {
    right: { pos: [0.006, -0.026, 0.020], rot: [-0.18, 0.04, -0.08] },
    left:  { pos: [-0.140, -0.160, 0.160], rot: [0.25, 0.35, 0.15] }
  }
};

const CATEGORY_RECOIL_PROFILE = {
  ASSAULT: { kickZ: 0.028, pitch: 0.048, yaw: 0.012, recovery: 14.0 },
  SMG:     { kickZ: 0.018, pitch: 0.030, yaw: 0.008, recovery: 18.0 },
  SHOTGUN: { kickZ: 0.068, pitch: 0.115, yaw: 0.022, recovery: 11.0 },
  SNIPER:  { kickZ: 0.085, pitch: 0.145, yaw: 0.032, recovery: 9.0 },
  LMG:     { kickZ: 0.034, pitch: 0.058, yaw: 0.018, recovery: 13.0 },
  PISTOL:  { kickZ: 0.024, pitch: 0.068, yaw: 0.014, recovery: 16.0 },
  MELEE:   { kickZ: 0.005, pitch: 0.010, yaw: 0.005, recovery: 15.0 }
};

const animState = {
  swayX: 0,
  swayY: 0,
  swayVelX: 0,
  swayVelY: 0,
  recoilZ: 0,
  recoilPitch: 0,
  recoilYaw: 0,
  recoilRoll: 0,
  slideKick: 0,
  boltKick: 0,
  mouseAccumX: 0,
  mouseAccumY: 0,
  lastAction: 'idle',
  inspectT: 0
};

export function recordMouseDelta(dx, dy) {
  animState.mouseAccumX += dx;
  animState.mouseAccumY += dy;
}

export function triggerFireImpulse(weaponId, category = 'ASSAULT') {
  const prof = CATEGORY_RECOIL_PROFILE[category] || CATEGORY_RECOIL_PROFILE.ASSAULT;
  animState.recoilZ = Math.min(0.12, animState.recoilZ + prof.kickZ);
  animState.recoilPitch = Math.min(0.24, animState.recoilPitch + prof.pitch);
  animState.recoilYaw += (Math.random() - 0.5) * prof.yaw;
  animState.recoilRoll += (Math.random() - 0.5) * (prof.yaw * 0.8);

  if (weaponId === 'p12') {
    animState.slideKick = 0.038;
  } else if (weaponId === 'vector9') {
    animState.boltKick = 0.026;
  }
}

export function resetViewModelState() {
  animState.swayX = 0;
  animState.swayY = 0;
  animState.swayVelX = 0;
  animState.swayVelY = 0;
  animState.recoilZ = 0;
  animState.recoilPitch = 0;
  animState.recoilYaw = 0;
  animState.recoilRoll = 0;
  animState.slideKick = 0;
  animState.boltKick = 0;
  animState.mouseAccumX = 0;
  animState.mouseAccumY = 0;
  animState.lastAction = 'idle';
  animState.inspectT = 0;
}

export function resetWeaponRigParts(weaponModel) {
  if (!weaponModel || !weaponModel.userData || !weaponModel.userData.rigParts || !weaponModel.userData.rigRest) return;
  const parts = weaponModel.userData.rigParts;
  const rests = weaponModel.userData.rigRest;
  for (const k in parts) {
    const p = parts[k];
    const r = rests[k];
    if (p && r) {
      if (r.pos) p.position.copy(r.pos);
      if (r.rot) p.rotation.copy(r.rot);
      if (typeof r.visible === 'boolean') p.visible = r.visible;
    }
  }
}

const ARM_LEN_UPPER = 0.26;
const ARM_LEN_FORE = 0.25;
const _upAxis = new THREE.Vector3(0, 1, 0);

function solveArmChain(arm, shoulderPos, handPos, handRot, isLeft) {
  const { root, upper, elbow, fore, wrist, hand } = arm;
  root.position.copy(shoulderPos);

  const targetVec = _targetVec.subVectors(handPos, shoulderPos);
  const totalMax = ARM_LEN_UPPER + ARM_LEN_FORE - 0.002;
  const dist = Math.max(0.08, Math.min(targetVec.length(), totalMax));
  const targetDir = targetVec.normalize();

  const cosA = Math.max(-1, Math.min(1, (ARM_LEN_UPPER * ARM_LEN_UPPER + dist * dist - ARM_LEN_FORE * ARM_LEN_FORE) / (2 * ARM_LEN_UPPER * dist)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  const flexBias = isLeft ? _flexBias.set(-0.65, -0.60, 0.15) : _flexBias.set(0.65, -0.60, 0.15);
  const proj = targetDir.dot(flexBias);
  const flexPerp = _flexPerp.copy(flexBias).addScaledVector(targetDir, -proj).normalize();

  const upperDir = _upperDir.copy(targetDir).multiplyScalar(cosA).addScaledVector(flexPerp, sinA).normalize();
  const elbowWorld = _elbowWorld.copy(shoulderPos).addScaledVector(upperDir, ARM_LEN_UPPER);
  const foreVec = _foreVec.subVectors(handPos, elbowWorld);
  const foreDir = _foreDir.copy(foreVec).normalize();

  upper.position.copy(upperDir).multiplyScalar(ARM_LEN_UPPER * 0.5);
  upper.quaternion.setFromUnitVectors(_upAxis, upperDir);

  elbow.position.copy(upperDir).multiplyScalar(ARM_LEN_UPPER);
  elbow.quaternion.identity();

  fore.position.copy(foreDir).multiplyScalar(ARM_LEN_FORE * 0.5);
  fore.quaternion.setFromUnitVectors(_upAxis, foreDir);

  wrist.position.copy(foreDir).multiplyScalar(ARM_LEN_FORE * 0.94);
  wrist.quaternion.setFromUnitVectors(_upAxis, foreDir);

  hand.position.copy(foreVec);
  hand.rotation.set(handRot[0], handRot[1], handRot[2]);
}

export function updateViewModel(params) {
  const {
    dt,
    gunGroup,
    weapon,
    weaponMesh,
    combatSession,
    adsAmount,
    adsDown,
    sprint,
    moving,
    bobT,
    baseHip,
    baseAds
  } = params;

  const wpnId = weapon.id;
  armsRig.activeWeaponId = wpnId;

  const motionScale = settings.reducedMotion ? 0.20 : 1.0;
  const targetSwayX = (-animState.mouseAccumX * 0.0006) * motionScale;
  const targetSwayY = (-animState.mouseAccumY * 0.0006) * motionScale;
  animState.mouseAccumX = 0;
  animState.mouseAccumY = 0;

  const swaySpeed = Math.min(1, dt * 18);
  animState.swayX += (targetSwayX - animState.swayX) * swaySpeed;
  animState.swayY += (targetSwayY - animState.swayY) * swaySpeed;

  const recoilRecov = dt * 14.0;
  animState.recoilZ = Math.max(0, animState.recoilZ - recoilRecov * 0.12);
  animState.recoilPitch = Math.max(0, animState.recoilPitch - recoilRecov * 0.28);
  animState.recoilYaw += (0 - animState.recoilYaw) * Math.min(1, dt * 16);
  animState.recoilRoll += (0 - animState.recoilRoll) * Math.min(1, dt * 16);
  animState.slideKick = Math.max(0, animState.slideKick - dt * 0.25);
  animState.boltKick = Math.max(0, animState.boltKick - dt * 0.35);

  const basePos = _basePos.lerpVectors(baseHip, baseAds, adsAmount);
  const adsDamp = 1.0 - adsAmount * 0.88;

  const bobScale = motionScale * adsDamp;
  const bobY = Math.sin(bobT * 2) * 0.007 * bobScale;
  const bobX = Math.cos(bobT) * 0.005 * bobScale;
  const breathY = Math.sin(bobT * 0.6) * 0.0015 * motionScale * adsDamp;

  let sprintPosX = 0;
  let sprintPosY = 0;
  let sprintRotX = 0;
  let sprintRotY = 0;
  let sprintRotZ = 0;
  if (sprint && moving && !adsDown) {
    sprintPosX = 0.035 * motionScale;
    sprintPosY = -0.045 * motionScale;
    sprintRotX = -0.35 * motionScale;
    sprintRotY = 0.40 * motionScale;
    sprintRotZ = 0.30 * motionScale;
  }

  const anchors = WEAPON_ARM_ANCHORS[wpnId] || WEAPON_ARM_ANCHORS.mk7;
  const rightBase = anchors.right;
  const leftBase = anchors.left;

  const targetRightPos = _vHandR.set(rightBase.pos[0], rightBase.pos[1], rightBase.pos[2]);
  const targetLeftPos = _vHandL.set(leftBase.pos[0], leftBase.pos[1], leftBase.pos[2]);
  const targetRightRot = [...rightBase.rot];
  const targetLeftRot = [...leftBase.rot];

  const parts = weaponMesh?.userData?.rigParts;
  const rests = weaponMesh?.userData?.rigRest;

  let actPosX = 0;
  let actPosY = 0;
  let actPosZ = 0;
  let actRotX = 0;
  let actRotY = 0;
  let actRotZ = 0;

  if (combatSession.switching) {
    animState.lastAction = 'switching';
    const totalSw = combatSession.switchDuration || 0.35;
    const rem = Math.max(0, combatSession.switchTimer);
    const swT = 1.0 - rem / totalSw;
    const dip = Math.sin(swT * Math.PI);
    actPosY -= dip * 0.22;
    actRotX -= dip * 0.65;
    actRotZ += dip * 0.25;

    targetRightPos.y -= dip * 0.12;
    targetLeftPos.y -= dip * 0.15;
  } else if (weapon.fireMode === 'melee' && weapon.meleeStage && weapon.meleeStage !== 'idle') {
    animState.lastAction = 'melee';
    if (weapon.meleeStage === 'windup') {
      const t = Math.min(1, (weapon.meleeT || 0) / 0.08);
      actPosX -= t * 0.08;
      actPosY += t * 0.05;
      actRotY -= t * 0.45;
      actRotZ -= t * 0.30;
      targetRightPos.set(0.04, -0.02, 0.05);
      targetLeftPos.set(-0.16, -0.18, 0.20);
    } else if (weapon.meleeStage === 'strike') {
      const t = Math.min(1, (weapon.meleeT || 0) / 0.12);
      actPosX = -0.08 + t * 0.18;
      actPosY = 0.05 - t * 0.10;
      actPosZ = -t * 0.15;
      actRotY = -0.45 + t * 0.95;
      actRotX = -t * 0.35;
      actRotZ = -0.30 + t * 0.55;
      targetRightPos.set(0.06 - t * 0.08, -0.04 - t * 0.04, -0.05);
    } else if (weapon.meleeStage === 'recovery') {
      const t = Math.min(1, (weapon.meleeT || 0) / 0.25);
      actPosX = 0.10 * (1 - t);
      actPosY = -0.05 * (1 - t);
      actPosZ = -0.15 * (1 - t);
      actRotY = 0.50 * (1 - t);
      actRotX = -0.35 * (1 - t);
      actRotZ = 0.25 * (1 - t);
    }
  } else if (weapon.fireMode === 'bolt' && weapon.boltCycling) {
    animState.lastAction = 'boltCycling';
    const totalD = weapon.boltDuration || 0.85;
    const bt = Math.min(1, (weapon.boltT || 0) / totalD);
    const dip = Math.sin(bt * Math.PI);

    actPosY -= dip * 0.04;
    actRotZ += dip * 0.12;
    actRotX -= dip * 0.08;

    const bolt = parts?.boltAssembly || parts?.bolt;
    const casing = parts?.casing;

    if (bt < 0.24) {
      const t = bt / 0.24;
      if (bolt) bolt.rotation.z = (rests?.boltAssembly?.rot?.z || 0) + t * 0.95;
      targetRightPos.set(
        rightBase.pos[0] + (0.065 - rightBase.pos[0]) * t,
        rightBase.pos[1] + (0.035 - rightBase.pos[1]) * t,
        rightBase.pos[2] + (0.050 - rightBase.pos[2]) * t
      );
      targetRightRot[2] += t * 0.40;
    } else if (bt < 0.52) {
      const t = (bt - 0.24) / 0.28;
      const stroke = t * 0.085;
      if (bolt) {
        bolt.rotation.z = (rests?.boltAssembly?.rot?.z ?? 0) + 0.95;
        bolt.position.z = (rests?.boltAssembly?.pos?.z ?? 0) + stroke;
      }
      if (casing) {
        casing.visible = true;
        casing.position.set(0.045 + t * 0.12, 0.03 + t * 0.06, 0.05 - t * 0.04);
        casing.rotation.z = t * 6.0;
      }
      targetRightPos.set(0.065, 0.035, 0.050 + stroke);
      targetRightRot[2] += 0.40;
    } else if (bt < 0.80) {
      const t = (bt - 0.52) / 0.28;
      const stroke = (1 - t) * 0.085;
      if (bolt) {
        bolt.rotation.z = (rests?.boltAssembly?.rot?.z ?? 0) + 0.95;
        bolt.position.z = (rests?.boltAssembly?.pos?.z ?? 0) + stroke;
      }
      if (casing) casing.visible = false;
      targetRightPos.set(0.065, 0.035, 0.050 + stroke);
      targetRightRot[2] += 0.40 * (1 - t);
    } else {
      const t = (bt - 0.80) / 0.20;
      if (bolt) {
        bolt.rotation.z = (rests?.boltAssembly?.rot?.z ?? 0) + (1 - t) * 0.95;
        bolt.position.z = rests?.boltAssembly?.pos?.z ?? 0;
      }
      if (casing) casing.visible = false;
      targetRightPos.set(
        0.065 + (rightBase.pos[0] - 0.065) * t,
        0.035 + (rightBase.pos[1] - 0.035) * t,
        0.050 + (rightBase.pos[2] - 0.050) * t
      );
    }
  } else if (weapon.reloading) {
    animState.lastAction = 'reloading';
    if (weapon.reloadType === 'shell') {
      actPosY -= 0.06;
      actRotX = -0.22 + Math.sin(weapon.reloadT * 6) * 0.04;
      actRotZ = 0.18;

      const pump = parts?.pump;
      const shell = parts?.shell;

      if (weapon.reloadStage === 'start') {
        targetLeftPos.y -= 0.14;
        targetLeftPos.z += 0.08;
        if (shell) shell.visible = false;
      } else if (weapon.reloadStage === 'shell') {
        const sr = weapon.shellReload || { shell: 0.48 };
        const st = Math.min(1, weapon.reloadT / (sr.shell || 0.48));
        targetLeftPos.set(-0.015, -0.16 + st * 0.10, -0.12 - st * 0.12);
        if (shell) {
          shell.visible = true;
          shell.position.set(0, -0.06 + st * 0.04, -0.15 - st * 0.08);
        }
      } else if (weapon.reloadStage === 'end') {
        if (shell) shell.visible = false;
        const sr = weapon.shellReload || { end: 0.35 };
        const et = Math.min(1, weapon.reloadT / (sr.end || 0.35));
        const pumpStroke = Math.sin(et * Math.PI) * 0.075;
        if (pump) pump.position.z = (rests?.pump?.pos?.z || -0.42) + pumpStroke;
        targetLeftPos.z = leftBase.pos[2] + pumpStroke;
      }
    } else {
      const t = Math.min(1, weapon.reloadT / (weapon.reloadTime || 1.7));
      actPosY -= Math.sin(t * Math.PI) * 0.14;
      actRotX = -Math.sin(t * Math.PI) * 0.35;
      actRotZ = Math.sin(t * Math.PI) * 0.15;

      const mag = parts?.mag;
      const topCover = parts?.topCover;
      const ammoBox = parts?.ammoBox;
      const ammoBelt = parts?.ammoBelt;
      const chHandle = parts?.chargingHandle || parts?.boltHandle;
      const slide = parts?.slide;

      if (wpnId === 'mk48') {
        if (t < 0.28) {
          const kt = t / 0.28;
          if (topCover) topCover.rotation.x = (rests?.topCover?.rot?.x || 0) + kt * 0.85;
          targetLeftPos.set(-0.02, leftBase.pos[1] + kt * 0.06, leftBase.pos[2] + kt * 0.15);
        } else if (t < 0.65) {
          const kt = (t - 0.28) / 0.37;
          if (topCover) topCover.rotation.x = (rests?.topCover?.rot?.x || 0) + 0.85;
          if (ammoBox) ammoBox.position.y = (rests?.ammoBox?.pos?.y || -0.13) - Math.sin(kt * Math.PI) * 0.18;
          if (ammoBelt) ammoBelt.visible = kt > 0.5;
          targetLeftPos.set(0.04 + Math.sin(kt * Math.PI) * 0.06, -0.16 + Math.sin(kt * Math.PI) * 0.06, -0.12);
        } else if (t < 0.82) {
          const kt = (t - 0.65) / 0.17;
          if (topCover) topCover.rotation.x = (rests?.topCover?.rot?.x || 0) + (1 - kt) * 0.85;
          targetLeftPos.set(leftBase.pos[0], leftBase.pos[1] + 0.06 * (1 - kt), leftBase.pos[2]);
        } else {
          const kt = (t - 0.82) / 0.18;
          const stroke = Math.sin(kt * Math.PI) * 0.065;
          if (chHandle) chHandle.position.z = (rests?.chargingHandle?.pos?.z || 0.05) + stroke;
          targetLeftPos.set(-0.04, -0.02, (rests?.chargingHandle?.pos?.z || 0.05) + stroke);
        }
      } else {
        if (t < 0.40) {
          const kt = t / 0.40;
          if (mag) mag.position.y = (rests?.mag?.pos?.y || -0.14) - kt * 0.18;
          targetLeftPos.set(leftBase.pos[0], leftBase.pos[1] - kt * 0.18, leftBase.pos[2] + kt * 0.06);
        } else if (t < 0.72) {
          const kt = (t - 0.40) / 0.32;
          if (mag) mag.position.y = (rests?.mag?.pos?.y || -0.14) - (1 - kt) * 0.18;
          targetLeftPos.set(leftBase.pos[0], leftBase.pos[1] - (1 - kt) * 0.18, leftBase.pos[2] + (1 - kt) * 0.06);
        } else {
          if (mag) mag.position.y = rests?.mag?.pos?.y || -0.14;
          const kt = (t - 0.72) / 0.28;
          if (weapon.reloadWasEmpty) {
            if (wpnId === 'p12') {
              if (slide) slide.position.z = (rests?.slide?.pos?.z || -0.05) + (1 - kt) * 0.038;
              targetLeftPos.set(0.015, 0.012, -0.020);
            } else if (wpnId === 'mp5k') {
              const slap = Math.sin(kt * Math.PI) * 0.04;
              if (chHandle) chHandle.position.y = (rests?.chargingHandle?.pos?.y || 0.048) - slap;
              targetLeftPos.set(0.02, 0.03 - slap, -0.22);
            } else if (chHandle) {
              const pull = Math.sin(kt * Math.PI) * 0.06;
              chHandle.position.z = (rests?.[chHandle.userData.rigPart]?.pos?.z || 0) + pull;
              targetLeftPos.set(-0.03, 0.02, (rests?.[chHandle.userData.rigPart]?.pos?.z || 0) + pull);
            }
          }
        }
      }
    }
  } else {
    animState.lastAction = 'idle';
    if (wpnId === 'p12' && parts?.slide && rests?.slide) {
      const lockOffset = (weapon.ammo === 0) ? 0.035 : 0;
      parts.slide.position.z = rests.slide.pos.z + animState.slideKick + lockOffset;
    } else if (wpnId === 'vector9' && parts?.bolt && rests?.bolt) {
      parts.bolt.position.z = rests.bolt.pos.z + animState.boltKick;
    } else if (wpnId === 'awm338') {
      if (parts?.boltAssembly && rests?.boltAssembly) {
        parts.boltAssembly.rotation.z = rests.boltAssembly.rot.z;
        parts.boltAssembly.position.z = rests.boltAssembly.pos.z;
      }
      if (parts?.casing) parts.casing.visible = false;
    } else if (wpnId === 'm870' && parts?.pump && rests?.pump) {
      parts.pump.position.z = rests.pump.pos.z;
      if (parts?.shell) parts.shell.visible = false;
    } else if (wpnId === 'mk48') {
      if (parts?.topCover && rests?.topCover) parts.topCover.rotation.x = rests.topCover.rot.x;
      if (parts?.ammoBox && rests?.ammoBox) parts.ammoBox.position.y = rests.ammoBox.pos.y;
      if (parts?.chargingHandle && rests?.chargingHandle) parts.chargingHandle.position.z = rests.chargingHandle.pos.z;
    } else if (parts?.mag && rests?.mag) {
      parts.mag.position.y = rests.mag.pos.y;
      if (parts?.chargingHandle && rests?.chargingHandle) parts.chargingHandle.position.z = rests.chargingHandle.pos.z;
      if (parts?.boltHandle && rests?.boltHandle) parts.boltHandle.position.z = rests.boltHandle.pos.z;
    }
  }

  const finalPosX = basePos.x + bobX + sprintPosX + animState.swayX + actPosX;
  const finalPosY = basePos.y + bobY + breathY + sprintPosY + animState.swayY + actPosY;
  const finalPosZ = basePos.z + animState.recoilZ * adsDamp + actPosZ;

  const finalRotX = actRotX + animState.recoilPitch * adsDamp + animState.swayY * 1.8;
  const finalRotY = sprintRotY + actRotY + animState.recoilYaw + animState.swayX * 1.8;
  const finalRotZ = sprintRotZ + actRotZ + animState.recoilRoll + animState.swayX * 2.2 + Math.cos(bobT) * 0.005 * motionScale;

  gunGroup.position.set(finalPosX, finalPosY, finalPosZ);
  gunGroup.rotation.set(finalRotX, finalRotY, finalRotZ, 'YXZ');

  const shoulderR = _shoulderR.set(0.20, -0.24 - adsAmount * 0.04, 0.28 + adsAmount * 0.04);
  const shoulderL = _shoulderL.set(-0.20, -0.24 - adsAmount * 0.04, 0.28 + adsAmount * 0.04);

  solveArmChain(armsRig.right, shoulderR, targetRightPos, targetRightRot, false);
  solveArmChain(armsRig.left, shoulderL, targetLeftPos, targetLeftRot, true);
}

export function getViewModelState() {
  return {
    ...animState,
    armsVisible: armsRig.group.visible,
    activeWeaponId: armsRig.activeWeaponId
  };
}
