import * as THREE from 'three';

import { car, state, P } from './config.js';
import { S, getGroundY } from './world.js';

// ---------- pool leve de skidmarks (marcas de pneu no asfalto)
const SKID_MAX = 720;
const skidGeo = new THREE.PlaneGeometry(0.32, 1.0);
skidGeo.rotateX(-Math.PI / 2);

const skidMat = new THREE.MeshBasicMaterial({
  color: 0x090a0c,
  transparent: true,
  opacity: 0.44,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});

const skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, SKID_MAX);
skidMesh.frustumCulled = false;
skidMesh.userData.noAO = true;
S.add(skidMesh);

// ---------- pool leve de partículas 3D (fumaça de pneu e poeira off-road)
const PART_MAX = 220;
const partGeo = new THREE.IcosahedronGeometry(0.34, 1);
const partMat = new THREE.MeshLambertMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.48,
  depthWrite: false
});

const partMesh = new THREE.InstancedMesh(partGeo, partMat, PART_MAX);
partMesh.frustumCulled = false;
partMesh.userData.noAO = true;
S.add(partMesh);

const partData = Array.from({ length: PART_MAX }, () => ({
  active: false,
  x: 0,
  y: -999,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  life: 0.7,
  baseScale: 0.6,
  maxScale: 2.2
}));

// Helpers reutilizáveis (Zero GC no loop)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

let skidHead = 0;
let partHead = 0;
let lastSkidX = 0;
let lastSkidZ = 0;
let hasLastSkid = false;
let emitAcc = 0;

// Inicializa matrizes fora de tela
for (let i = 0; i < SKID_MAX; i++) {
  _dummy.position.set(0, -999, 0);
  _dummy.scale.set(0, 0, 0);
  _dummy.updateMatrix();
  skidMesh.setMatrixAt(i, _dummy.matrix);
}
skidMesh.instanceMatrix.needsUpdate = true;

for (let i = 0; i < PART_MAX; i++) {
  _dummy.position.set(0, -999, 0);
  _dummy.scale.set(0, 0, 0);
  _dummy.updateMatrix();
  partMesh.setMatrixAt(i, _dummy.matrix);
  partMesh.setColorAt(i, _color.setHex(0xe8ecf0));
}
partMesh.instanceMatrix.needsUpdate = true;
if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

function emitSkidPair(wx, wz, yaw, velYaw, segLen, strength) {
  const c = car();
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);

  const rearDist = c.L * 0.33;
  const trackHalf = c.W / 2 - 0.16;
  const ax = wx - fx * rearDist;
  const az = wz - fz * rearDist;
  const widthScale = 0.72 + strength * 0.45;
  const lengthScale = Math.max(0.85, segLen * 1.18);

  for (let side = -1; side <= 1; side += 2) {
    const px = ax + rx * trackHalf * side;
    const pz = az + rz * trackHalf * side;
    const py = getGroundY(px, pz) + 0.008;

    _dummy.position.set(px, py, pz);
    _dummy.rotation.set(0, velYaw, 0);
    _dummy.scale.set(widthScale, 1, lengthScale);
    _dummy.updateMatrix();
    skidMesh.setMatrixAt(skidHead, _dummy.matrix);
    skidHead = (skidHead + 1) % SKID_MAX;
  }
  skidMesh.instanceMatrix.needsUpdate = true;
}

function spawnParticle(x, y, z, vx, vy, vz, hexColor, baseScale, maxScale, life) {
  const p = partData[partHead];
  p.active = true;
  p.x = x;
  p.y = y;
  p.z = z;
  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.age = 0;
  p.life = life;
  p.baseScale = baseScale;
  p.maxScale = maxScale;

  partMesh.setColorAt(partHead, _color.setHex(hexColor));
  partHead = (partHead + 1) % PART_MAX;
  if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
}

export function resetFx() {
  hasLastSkid = false;
  emitAcc = 0;
  skidHead = 0;
  for (let i = 0; i < SKID_MAX; i++) {
    _dummy.position.set(0, -999, 0);
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    skidMesh.setMatrixAt(i, _dummy.matrix);
  }
  skidMesh.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < PART_MAX; i++) {
    partData[i].active = false;
    _dummy.position.set(0, -999, 0);
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    partMesh.setMatrixAt(i, _dummy.matrix);
  }
  partMesh.instanceMatrix.needsUpdate = true;
}

export function updateFx(dt) {
  const c = car();
  const kmh = Math.abs(P.spd) * 3.6;

  // 1. Skidmarks no asfalto quando P.sq > 0.35
  if (state.mode == 'drive' && !P.offroad && P.sq > 0.35 && kmh > 6) {
    if (!hasLastSkid) {
      lastSkidX = P.x;
      lastSkidZ = P.z;
      hasLastSkid = true;
    } else {
      const dx = P.x - lastSkidX;
      const dz = P.z - lastSkidZ;
      const dist = Math.hypot(dx, dz);
      if (dist >= 0.72) {
        const velYaw = Math.atan2(-dx, -dz);
        emitSkidPair(P.x, P.z, P.yaw, velYaw, Math.min(dist, 2.5), P.sq);
        lastSkidX = P.x;
        lastSkidZ = P.z;
      }
    }
  } else {
    hasLastSkid = false;
  }

  // 2. Emissão de partículas 3D (fumaça de pneu no asfalto / poeira ocre off-road)
  if (state.mode == 'drive') {
    const emitSmoke = !P.offroad && P.sq > 0.3 && kmh > 6;
    const emitDust = P.offroad && kmh > 15;

    if (emitSmoke || emitDust) {
      emitAcc += dt;
      const interval = emitSmoke ? 0.022 : 0.028;
      const rx = Math.cos(P.yaw);
      const rz = -Math.sin(P.yaw);
      const fx = -Math.sin(P.yaw);
      const fz = -Math.cos(P.yaw);
      const trackHalf = c.W / 2 - 0.16;
      const rearDist = c.L * 0.33;
      const frontDist = c.L * 0.33;
      const baseY = getGroundY(P.x, P.z) + 0.19;

      while (emitAcc >= interval) {
        emitAcc -= interval;
        for (let side = -1; side <= 1; side += 2) {
          const wx = P.x - fx * rearDist + rx * trackHalf * side + (Math.random() - 0.5) * 0.22;
          const wz = P.z - fz * rearDist + rz * trackHalf * side + (Math.random() - 0.5) * 0.22;

          if (emitSmoke) {
            const shade = Math.random() < 0.5 ? 0xeef2f6 : 0xd5dbe2;
            spawnParticle(
              wx,
              baseY,
              wz,
              P.vx * 0.15 + (Math.random() - 0.5) * 1.4,
              0.7 + Math.random() * 0.9,
              P.vz * 0.15 + (Math.random() - 0.5) * 1.4,
              shade,
              0.55 + P.sq * 0.35,
              1.9 + P.sq * 1.1,
              0.55 + Math.random() * 0.3
            );
          }

          if (emitDust) {
            const dustCol = Math.random() < 0.5 ? 0xb48a57 : 0x8f6b41;
            spawnParticle(
              wx,
              baseY - 0.06,
              wz,
              P.vx * 0.2 + (Math.random() - 0.5) * 2.2,
              0.9 + Math.random() * 1.2,
              P.vz * 0.2 + (Math.random() - 0.5) * 2.2,
              dustCol,
              0.65,
              2.35,
              0.65 + Math.random() * 0.35
            );

            // Poeira adicional leve nas rodas dianteiras quando off-road em velocidade
            if (Math.random() < 0.45) {
              const fwx = P.x + fx * frontDist + rx * trackHalf * side;
              const fwz = P.z + fz * frontDist + rz * trackHalf * side;
              spawnParticle(
                fwx,
                baseY - 0.08,
                fwz,
                P.vx * 0.15 + (Math.random() - 0.5) * 1.8,
                0.6 + Math.random() * 0.8,
                P.vz * 0.15 + (Math.random() - 0.5) * 1.8,
                0xa57c4c,
                0.45,
                1.6,
                0.5 + Math.random() * 0.25
              );
            }
          }
        }
      }
    } else {
      emitAcc = 0;
    }
  }

  // 3. Atualização das partículas ativas
  let anyUpdated = false;
  for (let i = 0; i < PART_MAX; i++) {
    const p = partData[i];
    if (!p.active) continue;
    anyUpdated = true;
    p.age += dt;
    if (p.age >= p.life) {
      p.active = false;
      _dummy.position.set(0, -999, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      partMesh.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    const t = p.age / p.life;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vx *= Math.exp(-2.2 * dt);
    p.vz *= Math.exp(-2.2 * dt);
    p.vy = Math.max(0.15, p.vy - 0.35 * dt);

    // Expande rapidamente e desaparece suavemente no fim da vida
    const grow = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5);
    const fadeOut = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    const sc = (p.baseScale + (p.maxScale - p.baseScale) * grow) * Math.max(0.01, fadeOut);

    _dummy.position.set(p.x, p.y, p.z);
    _dummy.rotation.set(p.age * 1.4, p.age * 1.1, 0);
    _dummy.scale.setScalar(sc);
    _dummy.updateMatrix();
    partMesh.setMatrixAt(i, _dummy.matrix);
  }

  if (anyUpdated) {
    partMesh.instanceMatrix.needsUpdate = true;
  }
}
