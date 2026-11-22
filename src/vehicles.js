/* global THREE */

import { cl, lp, wrap, TY, CARS, car, set, state, P } from './config.js';
import { S, cam, spot, headFill, cx, ry, getGroundY, onEnvChange } from './world.js';

function prepVehTex(tex, srgb = true) {
  if (srgb) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  if (THREE.LinearMipmapLinearFilter) tex.minFilter = THREE.LinearMipmapLinearFilter;
  if (THREE.LinearFilter) tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ---------- textura procedural de alta definição para banda de rodagem dos pneus
function createTireTexture() {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#181b21';
  ctx.fillRect(0, 0, w, h);

  // Sulcos circunferenciais longitudinais
  ctx.fillStyle = '#090a0d';
  [72, 112, 144, 184].forEach(y => ctx.fillRect(0, y, w, 9));

  // Ranhuras diagonais esportivas em V
  ctx.strokeStyle = '#0a0b0f';
  ctx.lineWidth = 6.5;
  for (let x = -64; x < w + 64; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.lineTo(x + 26, 102);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 26, 154);
    ctx.lineTo(x, 234);
    ctx.stroke();
  }

  for (let i = 0; i < 4200; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    const v = 20 + (Math.random() * 14 | 0);
    ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    ctx.fillRect(px, py, 2.5, 2.5);
  }

  const tex = prepVehTex(new THREE.CanvasTexture(c), true);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

// ---------- textura procedural de fibra de carbono trançada
function createCarbonTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14171c';
  ctx.fillRect(0, 0, s, s);
  const cell = 16;
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      const alt = ((x + y) / cell) % 2 === 0;
      const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
      if (alt) {
        g.addColorStop(0, '#1e222a');
        g.addColorStop(0.5, '#2b313c');
        g.addColorStop(1, '#161920');
      } else {
        g.addColorStop(0, '#111419');
        g.addColorStop(0.5, '#1b1f27');
        g.addColorStop(1, '#0e1014');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  const tex = prepVehTex(new THREE.CanvasTexture(c), true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

// ---------- textura procedural de couro/alcântara esportivo do interior
function createLeatherTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f232c';
  ctx.fillRect(0, 0, s, s);
  for (let y = 6; y < s; y += 12) {
    for (let x = 6; x < s; x += 12) {
      ctx.fillStyle = '#13161c';
      ctx.beginPath();
      ctx.arc(x + ((y / 12) % 2) * 6, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 2400; i++) {
    const v = 24 + (Math.random() * 14 | 0);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  const tex = prepVehTex(new THREE.CanvasTexture(c), true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

const tireMap = createTireTexture();
const carbonMap = createCarbonTexture();
const leatherMap = createLeatherTexture();

// ---------- materiais PBR automotivos
export const M = {
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x0a1018,
    metalness: 0.1,
    roughness: 0.04,
    transparent: true,
    opacity: 0.58,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    envMapIntensity: 1.45,
    depthWrite: false
  }),
  engineGlass: new THREE.MeshPhysicalMaterial({
    color: 0x0f151d,
    metalness: 0.12,
    roughness: 0.04,
    transparent: true,
    opacity: 0.52,
    clearcoat: 1.0,
    reflectivity: 1.0,
    envMapIntensity: 1.35,
    depthWrite: false
  }),
  carbon: new THREE.MeshStandardMaterial({ map: carbonMap, color: 0xffffff, metalness: 0.36, roughness: 0.36, envMapIntensity: 0.85 }),
  diffuser: new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.14, roughness: 0.78 }),
  grille: new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.2, roughness: 0.78 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe6ecf4, metalness: 0.95, roughness: 0.10, envMapIntensity: 1.35 }),
  engineAlloy: new THREE.MeshStandardMaterial({ color: 0xbec7d2, metalness: 0.88, roughness: 0.22 }),
  engineRed: new THREE.MeshStandardMaterial({ color: 0xb61818, metalness: 0.45, roughness: 0.30 }),
  engineGold: new THREE.MeshStandardMaterial({ color: 0xc89a3e, metalness: 0.78, roughness: 0.24 }),
  tire: new THREE.MeshStandardMaterial({
    map: tireMap,
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.04,
    envMapIntensity: 0.34
  }),
  tireWall: new THREE.MeshStandardMaterial({ color: 0x171a20, roughness: 0.82, metalness: 0.04 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xd5dce5, metalness: 0.90, roughness: 0.16, envMapIntensity: 1.3 }),
  rimCap: new THREE.MeshStandardMaterial({ color: 0x1f242c, metalness: 0.75, roughness: 0.25 }),
  brakeDisc: new THREE.MeshStandardMaterial({ color: 0x9aa3ae, metalness: 0.86, roughness: 0.28 }),
  caliperRed: new THREE.MeshStandardMaterial({ color: 0xe22020, metalness: 0.42, roughness: 0.24 }),
  caliperYellow: new THREE.MeshStandardMaterial({ color: 0xf4ba08, metalness: 0.42, roughness: 0.24 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x191d24, roughness: 0.70, metalness: 0.1 }),
  seatCloth: new THREE.MeshStandardMaterial({ map: leatherMap, color: 0xffffff, roughness: 0.78, metalness: 0.08 }),
  rollCage: new THREE.MeshStandardMaterial({ color: 0x2f3642, metalness: 0.65, roughness: 0.30 }),
  dashTrim: new THREE.MeshStandardMaterial({ map: leatherMap, color: 0xd0d6e0, roughness: 0.48, metalness: 0.28 }),
  clusterGlow: new THREE.MeshStandardMaterial({ color: 0x0d1b2a, emissive: 0x2ea8ff, emissiveIntensity: 1.45, roughness: 0.25 }),
  screenGlow: new THREE.MeshStandardMaterial({ color: 0x0b1622, emissive: 0x1e6ca8, emissiveIntensity: 1.05, roughness: 0.2 }),
  accentOrange: new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff8a3d, emissiveIntensity: 0.8, roughness: 0.32 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xeef3f8, emissive: 0xd4e2f2, emissiveIntensity: 0.85, roughness: 0.28, metalness: 0.05 }),
  drl: new THREE.MeshStandardMaterial({ color: 0xf4f9ff, emissive: 0xeef6ff, emissiveIntensity: 2.4, roughness: 0.16 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff5dc, emissiveIntensity: 2.0, roughness: 0.12 }),
  tailT: new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff1111, emissiveIntensity: 2.2, roughness: 0.14 })
};

onEnvChange(({ night, lowSun, wet }) => {
  M.drl.emissiveIntensity = night ? 3.8 : (lowSun || wet ? 2.8 : 2.4);
  M.head.emissiveIntensity = night ? 4.8 : (lowSun || wet ? 2.7 : 2.0);
  M.tailT.emissiveIntensity = night ? 3.2 : (lowSun || wet ? 2.6 : 2.2);
});

const cockpitOffset = {
  eyeX: -0.22,
  eyeY: 0.08,
  eyeZ: 0.0,
  lookPitch: -1.45
};

export function setCockpitOffset(cfg = {}) {
  Object.assign(cockpitOffset, cfg);
}

// Geometrias compartilhadas de rodas largas esportivas (aro côncavo 5 raios duplos + pneu ranhurado)
const wheelCache = new Map();
function getWheelGeos(r, width) {
  const key = `${r.toFixed(2)}_${width.toFixed(2)}`;
  if (wheelCache.has(key)) return wheelCache.get(key);

  const halfSide = width * 0.36;
  const tireTread = new THREE.CylinderGeometry(r - 0.005, r - 0.005, width * 0.88, 32, 1, true);
  tireTread.rotateX(Math.PI / 2);

  const tireShoulder = new THREE.TorusGeometry(r - 0.068, 0.072, 12, 32);
  const rimLip = new THREE.TorusGeometry(r * 0.67, 0.022, 10, 30);
  const rimBarrel = new THREE.CylinderGeometry(r * 0.66, r * 0.66, width * 0.72, 26, 1, true);
  rimBarrel.rotateX(Math.PI / 2);
  const rimHub = new THREE.CylinderGeometry(0.065, 0.078, width * 0.42, 16);
  rimHub.rotateX(Math.PI / 2);
  const hubCap = new THREE.CylinderGeometry(0.044, 0.044, 0.024, 16);
  hubCap.rotateX(Math.PI / 2);

  const spokeGeo = new THREE.BoxGeometry(0.017, r * 0.56, 0.024);
  const discGeo = new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.032, 24);
  discGeo.rotateX(Math.PI / 2);

  const geos = { tireTread, tireShoulder, rimLip, rimBarrel, rimHub, hubCap, spokeGeo, discGeo, halfSide };
  wheelCache.set(key, geos);
  return geos;
}

// Sombra de contato de 4 pneus + centro do chassi (y = 0.025)
const contactShadowMat = (() => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#000000';
  x.fillRect(0, 0, 128, 128);

  const cAlpha = document.createElement('canvas');
  cAlpha.width = 128;
  cAlpha.height = 128;
  const xa = cAlpha.getContext('2d');
  xa.fillStyle = '#000000';
  xa.fillRect(0, 0, 128, 128);

  // Sombra suave central do chassi
  const cg = xa.createRadialGradient(64, 64, 12, 64, 64, 58);
  cg.addColorStop(0, 'rgb(215,215,215)');
  cg.addColorStop(0.62, 'rgb(135,135,135)');
  cg.addColorStop(1, 'rgb(0,0,0)');
  xa.fillStyle = cg;
  xa.fillRect(0, 0, 128, 128);

  // 4 manchas escuras sob os pontos de contato dos pneus
  [[26, 26], [102, 26], [26, 102], [102, 102]].forEach(([px, py]) => {
    const wg = xa.createRadialGradient(px, py, 2, px, py, 22);
    wg.addColorStop(0, 'rgba(255,255,255,0.95)');
    wg.addColorStop(1, 'rgba(255,255,255,0)');
    xa.fillStyle = wg;
    xa.fillRect(px - 22, py - 22, 44, 44);
  });

  const mapTex = new THREE.CanvasTexture(c);
  const alphaTex = new THREE.CanvasTexture(cAlpha);
  return new THREE.MeshBasicMaterial({
    map: mapTex,
    alphaMap: alphaTex,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
})();

// ---------- carregador de modelos reais (.glb / .gltf) + texturas e Drag-and-Drop
function enhanceTexture(tex, isColor) {
  if (!tex) return;
  if (isColor) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
}

function upgradeImportedMaterial(mat, nodeName, s, vehicleRefs) {
  if (!mat) return mat;
  if (Array.isArray(mat)) {
    return mat.map(m => upgradeImportedMaterial(m, nodeName, s, vehicleRefs));
  }

  const lname = normalizePartName(nodeName).toLowerCase();
  const mname = normalizePartName(mat.name).toLowerCase();

  if (/(taillight|tail light|tail lamp|rear light|rear lamp|brake light|stop light|lanterna)/.test(lname + ' ' + mname)) {
    return vehicleRefs.tl;
  }

  enhanceTexture(mat.map, true);
  enhanceTexture(mat.emissiveMap, true);
  enhanceTexture(mat.normalMap, false);
  enhanceTexture(mat.roughnessMap, false);
  enhanceTexture(mat.metalnessMap, false);
  enhanceTexture(mat.aoMap, false);

  const isNonPaint = /(glass|window|vidro|tire|tyre|rubber|pneu|chrome|metal|light|lamp|head|rim|wheel|interior|seat|dash|carbon|grille|grill|plate|license)/.test(lname + ' ' + mname);

  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
    mat.envMapIntensity = Math.max(mat.envMapIntensity || 1.0, 1.0);
    if (!isNonPaint && !mat.map && !mat.isMeshPhysicalMaterial) {
      return new THREE.MeshPhysicalMaterial({
        name: mat.name,
        color: mat.color ? mat.color.clone() : new THREE.Color(s.col),
        normalMap: mat.normalMap || null,
        roughnessMap: mat.roughnessMap || null,
        metalnessMap: mat.metalnessMap || null,
        aoMap: mat.aoMap || null,
        metalness: mat.metalness !== undefined ? Math.max(mat.metalness, 0.45) : 0.55,
        roughness: mat.roughness !== undefined ? Math.min(mat.roughness, 0.35) : 0.22,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        transparent: mat.transparent,
        opacity: mat.opacity,
        side: mat.side,
        envMapIntensity: 1.0
      });
    }
    mat.needsUpdate = true;
    return mat;
  }

  return new THREE.MeshStandardMaterial({
    name: mat.name,
    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    map: mat.map || null,
    normalMap: mat.normalMap || null,
    emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
    emissiveMap: mat.emissiveMap || null,
    transparent: mat.transparent,
    opacity: mat.opacity !== undefined ? mat.opacity : 1,
    alphaTest: mat.alphaTest || 0,
    side: mat.side !== undefined ? mat.side : THREE.FrontSide,
    roughness: 0.45,
    metalness: 0.25,
    envMapIntensity: 1.0
  });
}

function normalizePartName(raw = '') {
  return String(raw)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-./]+/g, ' ')
    .trim();
}

const PART_EXCLUDE_RE = /(?:^|\s)(trim|bumper|parachoque|para choque|arch|well|housing|liner|fender|skirt|diffuser|difusor|valance|apron|deflector|splitter|canard|spoiler|wing|aerofolio|grille|grill|grade|mirror|retrovisor|door|porta|hood|bonnet|capo|trunk|boot|roof|teto|glass|window|vidro|windshield|wiper|seat|banco|dash|painel|steering|volante|caliper|pinca|pinça|pad|suspension|arm|strut|shock|spring|coilover|knuckle|wishbone|light|lamp|head|tail|exhaust|muffler|tailpipe|pipe|escape|badge|emblem|logo|plate|placa|interior|cockpit|floor|carpet|console|pedal|shifter|engine|motor|molding|moulding|garnish|surround|bezel|undertray|undercarriage|underbody|shield|reflector|vent|scoop|intake|louvre|louver|mudflap|mudguard|flap|quarter|spare|flywheel)(?:\s|\d|$)/i;
const COMPACT_EXCLUDE_RE = /(bumper|parachoque|steering|wheelarch|wheelwell|caliper|diffuser|spoiler|taillight|headlight|exhaust|fender|mudflap|flywheel)/i;
const BODY_SELF_RE = /(?:^|\s)(body|chassis|chassi|frame|shell|lataria|car|vehicle)(?:\s|\d|$)/i;
const WHEEL_MATCH_RE = /(?:^|\s)(wheel|tire|tyre|rim|roda|pneu)s?(?:fl|fr|rl|rr|lf|rf|lr|\d+)?(?=\s|$)/i;
const GENERIC_GROUP_RE = /^(node|mesh|group|object|geometry|pivot|dummy|null|empty)/i;

function getBdLocalBox(node, bdInv) {
  if (!node.geometry) return null;
  if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
  const gbb = node.geometry.boundingBox;
  if (!gbb || gbb.isEmpty()) return null;

  const m = new THREE.Matrix4().multiplyMatrices(bdInv, node.matrixWorld);
  const out = new THREE.Box3();
  const pt = new THREE.Vector3();
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        pt.set(
          ix ? gbb.max.x : gbb.min.x,
          iy ? gbb.max.y : gbb.min.y,
          iz ? gbb.max.z : gbb.min.z
        ).applyMatrix4(m);
        out.expandByPoint(pt);
      }
    }
  }
  return out;
}

export function isStrictWheelName(nodeName, ancestorNames = []) {
  const normSelf = normalizePartName(nodeName);
  if (PART_EXCLUDE_RE.test(normSelf) || COMPACT_EXCLUDE_RE.test(normSelf) || BODY_SELF_RE.test(normSelf)) {
    return false;
  }

  let matched = WHEEL_MATCH_RE.test(normSelf) && !/^(wheels|tires|tyres|rims|rodas|pneus)$/i.test(normSelf);

  for (let i = 0; i < ancestorNames.length && i < 4; i++) {
    const normAnc = normalizePartName(ancestorNames[i]);
    if (!normAnc) continue;
    if (PART_EXCLUDE_RE.test(normAnc) || COMPACT_EXCLUDE_RE.test(normAnc)) {
      return false;
    }
    if (!matched && WHEEL_MATCH_RE.test(normAnc) && !/^(wheels|tires|tyres|rims|rodas|pneus)$/i.test(normAnc)) {
      matched = true;
    }
    if (BODY_SELF_RE.test(normAnc)) break;
  }

  return matched;
}

export function isWheelCandidateGeometry(bdBox, s) {
  if (!bdBox) return false;
  const bSize = bdBox.getSize(new THREE.Vector3());
  const bCenter = bdBox.getCenter(new THREE.Vector3());
  const aspect = bSize.y > 0.01 ? bSize.x / bSize.y : 0;

  return (
    Math.abs(bCenter.z) > s.W * 0.22 &&
    Math.abs(bCenter.x) > s.L * 0.16 &&
    Math.abs(bCenter.x) < s.L * 0.43 &&
    bdBox.min.y < s.H * 0.28 &&
    bCenter.y > 0.1 &&
    bCenter.y < s.H * 0.58 &&
    bSize.x > 0.22 && bSize.x < s.L * 0.34 &&
    bSize.y > 0.22 && bSize.y < s.H * 0.85 &&
    bSize.z > 0.04 && bSize.z < s.W * 0.36 &&
    aspect > 0.65 && aspect < 1.52
  );
}

function isStrictWheelMesh(node, model) {
  const ancestors = [];
  let p = node.parent;
  while (p && p !== model && ancestors.length < 4) {
    const pName = p.name || '';
    if (pName && !GENERIC_GROUP_RE.test(pName)) {
      ancestors.push(pName);
    }
    p = p.parent;
  }
  return isStrictWheelName(node.name || '', ancestors);
}

function applyGLBToVehicle(model, s, vehicleRefs, objectUrls = [], modelName = '') {
  if (!model) return;

  if (Array.isArray(vehicleRefs.glbPivots)) {
    vehicleRefs.glbPivots.forEach(p => vehicleRefs.bd.remove(p));
  }
  vehicleRefs.glbPivots = [];

  if (vehicleRefs.glbModel) {
    vehicleRefs.bd.remove(vehicleRefs.glbModel);
    vehicleRefs.glbModel = null;
  }
  if (Array.isArray(vehicleRefs.glbObjectUrls)) {
    vehicleRefs.glbObjectUrls.forEach(u => URL.revokeObjectURL(u));
  }
  vehicleRefs.glbObjectUrls = objectUrls;
  vehicleRefs.glbName = modelName || s.n;

  const box0 = new THREE.Box3().setFromObject(model);
  const size0 = box0.getSize(new THREE.Vector3());
  if (size0.z > size0.x * 1.15) {
    model.rotation.y = Math.PI / 2;
  }
  model.updateMatrixWorld(true);

  const box1 = new THREE.Box3().setFromObject(model);
  const size1 = box1.getSize(new THREE.Vector3());
  const center1 = box1.getCenter(new THREE.Vector3());

  const sx = size1.x > 0.01 ? s.L / size1.x : 1;
  const sy = size1.y > 0.01 ? s.H / size1.y : 1;
  const sz = size1.z > 0.01 ? s.W / size1.z : 1;
  const uScale = Math.min(sx, sy * 1.15, sz * 1.15);
  model.scale.setScalar(uScale);
  model.position.set(-center1.x * uScale, -box1.min.y * uScale, -center1.z * uScale);

  vehicleRefs.procGroup.visible = false;
  vehicleRefs.bd.add(model);
  vehicleRefs.glbModel = model;
  vehicleRefs.bd.updateMatrixWorld(true);

  let bdInv = new THREE.Matrix4().copy(vehicleRefs.bd.matrixWorld).invert();
  const candidates = [];

  model.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.material = upgradeImportedMaterial(node.material, node.name, s, vehicleRefs);

    if (!isStrictWheelMesh(node, model)) return;
    const bdBox = getBdLocalBox(node, bdInv);
    if (!isWheelCandidateGeometry(bdBox, s)) return;

    candidates.push({ node, center: bdBox.getCenter(new THREE.Vector3()) });
  });

  const corners = { fl: [], fr: [], rl: [], rr: [] };
  candidates.forEach(c => {
    const key = (c.center.x >= 0 ? 'f' : 'r') + (c.center.z < 0 ? 'l' : 'r');
    corners[key].push(c.node);
  });

  const cornerMinYs = [];
  Object.values(corners).forEach(list => {
    if (!list.length) return;
    const cb = new THREE.Box3();
    list.forEach(m => {
      const bx = getBdLocalBox(m, bdInv);
      if (bx) cb.union(bx);
    });
    if (!cb.isEmpty()) cornerMinYs.push(cb.min.y);
  });
  if (cornerMinYs.length > 0) {
    const minWheelY = Math.min(...cornerMinYs);
    if (Math.abs(minWheelY) > 0.004 && Math.abs(minWheelY) < 0.28) {
      model.position.y -= minWheelY;
      vehicleRefs.bd.updateMatrixWorld(true);
      bdInv = new THREE.Matrix4().copy(vehicleRefs.bd.matrixWorld).invert();
    }
  }

  const glbSpinFront = [];
  const glbSpinRear = [];
  const glbFrontSteer = [];
  const cornerRadii = [];

  Object.entries(corners).forEach(([key, list]) => {
    if (!list.length) return;
    const cornerBox = new THREE.Box3();
    list.forEach(m => {
      const bx = getBdLocalBox(m, bdInv);
      if (bx) cornerBox.union(bx);
    });
    if (cornerBox.isEmpty()) return;

    const cCenter = cornerBox.getCenter(new THREE.Vector3());
    const cSize = cornerBox.getSize(new THREE.Vector3());
    cornerRadii.push(cl(cSize.y * 0.5, 0.24, 0.52));

    const steerPivot = new THREE.Group();
    steerPivot.position.copy(cCenter);
    const spinPivot = new THREE.Group();
    steerPivot.add(spinPivot);
    vehicleRefs.bd.add(steerPivot);
    vehicleRefs.glbPivots.push(steerPivot);
    vehicleRefs.bd.updateMatrixWorld(true);

    list.forEach(m => spinPivot.attach(m));

    if (key.startsWith('f')) {
      glbSpinFront.push(spinPivot);
      glbFrontSteer.push(steerPivot);
    } else {
      glbSpinRear.push(spinPivot);
    }
  });

  if (cornerRadii.length > 0) {
    vehicleRefs.wheelR = cornerRadii.reduce((a, b) => a + b, 0) / cornerRadii.length;
  } else {
    vehicleRefs.wheelR = vehicleRefs.procWheelR;
  }

  const allGlbSpin = [...glbSpinFront, ...glbSpinRear];
  vehicleRefs.spinFront = allGlbSpin.length > 0 ? glbSpinFront : [];
  vehicleRefs.spinRear = allGlbSpin.length > 0 ? glbSpinRear : [];
  vehicleRefs.spin = allGlbSpin;
  vehicleRefs.fr = glbFrontSteer;
}

async function tryAttachRealGLB(s, vehicleRefs) {
  if (!s.modelUrl || typeof THREE.GLTFLoader !== 'function') return;
  try {
    const res = await fetch(s.modelUrl, { method: 'HEAD' });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || ct.includes('text/html')) return;

    const loader = new THREE.GLTFLoader();
    loader.load(
      s.modelUrl,
      gltf => applyGLBToVehicle(gltf.scene, s, vehicleRefs, [], s.modelUrl.split('/').pop()),
      undefined,
      () => {}
    );
  } catch {
    // Fallback procedural permanece ativo
  }
}

function matchCarIndexByFilename(filename) {
  const n = filename.toLowerCase();
  const rules = [
    ['bmw', 'm3', 'g80'],
    ['nissan', 'gt-r', 'gtr', 'r35'],
    ['porsche', '911', '992', 'carrera'],
    ['lamborghini', 'lambo', 'huracan', 'huracán'],
    ['ferrari', '488', 'gtb'],
    ['toyota', 'supra', 'a90'],
    ['ford', 'mustang']
  ];
  return rules.findIndex(keys => keys.some(k => n.includes(k)));
}

function loadTextureFromFile(file, flipY = false, isColor = true) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(
      url,
      tex => {
        tex.flipY = flipY;
        enhanceTexture(tex, isColor);
        resolve({ tex, url });
      },
      undefined,
      err => {
        URL.revokeObjectURL(url);
        reject(err);
      }
    );
  });
}

async function applyExtraTexturesToVehicle(imageFiles, vehicleRefs) {
  if (!imageFiles.length) return 0;
  const isGlbActive = !!vehicleRefs.glbModel;
  const targetRoot = isGlbActive ? vehicleRefs.glbModel : vehicleRefs.procGroup;
  const loadedUrls = [];
  const maps = { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, aoMap: null };

  for (const file of imageFiles) {
    const lname = file.name.toLowerCase();
    const isNormal = /(normal|nrm|norm|bump)/.test(lname);
    const isRough = /(rough|rgh)/.test(lname);
    const isMetal = /(metal|met)/.test(lname);
    const isAo = /(ao|occlusion|ambient)/.test(lname);
    const isColor = !isNormal && !isRough && !isMetal && !isAo;
    try {
      const { tex, url } = await loadTextureFromFile(file, !isGlbActive, isColor);
      loadedUrls.push(url);
      if (isNormal && !maps.normalMap) maps.normalMap = tex;
      else if (isRough && !maps.roughnessMap) maps.roughnessMap = tex;
      else if (isMetal && !maps.metalnessMap) maps.metalnessMap = tex;
      else if (isAo && !maps.aoMap) maps.aoMap = tex;
      else if (!maps.map) maps.map = tex;
    } catch {
      // Ignora textura inválida
    }
  }

  if (!loadedUrls.length) return 0;
  let applied = 0;

  targetRoot.traverse(node => {
    if (!node.isMesh || !node.material) return;
    const lname = (node.name || '').toLowerCase();
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach(mat => {
      if (!mat || mat === vehicleRefs.tl || mat === M.glass || mat === M.tire || mat === M.chrome) return;
      const mname = (mat.name || '').toLowerCase();
      const skip = /(glass|window|vidro|tire|tyre|rubber|pneu|tail|brake|head|drl)/.test(lname + ' ' + mname);
      if (skip) return;
      if (maps.map) {
        mat.map = maps.map;
        mat.color.setHex(0xffffff);
      }
      if (maps.normalMap) mat.normalMap = maps.normalMap;
      if (maps.roughnessMap) mat.roughnessMap = maps.roughnessMap;
      if (maps.metalnessMap) mat.metalnessMap = maps.metalnessMap;
      if (maps.aoMap) mat.aoMap = maps.aoMap;
      mat.needsUpdate = true;
      applied++;
    });
  });

  if (applied > 0) {
    vehicleRefs.extraTexUrls = [...(vehicleRefs.extraTexUrls || []), ...loadedUrls];
  } else {
    loadedUrls.forEach(u => URL.revokeObjectURL(u));
  }
  return applied;
}

function loadSingleModelWithManager(modelFile, companionFiles, carIndex) {
  return new Promise((resolve, reject) => {
    if (typeof THREE.GLTFLoader !== 'function') {
      reject(new Error('GLTFLoader indisponível'));
      return;
    }
    const createdUrls = [];
    const urlMap = new Map();

    const registerFile = f => {
      const blobUrl = URL.createObjectURL(f);
      createdUrls.push(blobUrl);
      const base = f.name.toLowerCase();
      urlMap.set(base, blobUrl);
      if (f.webkitRelativePath) urlMap.set(f.webkitRelativePath.toLowerCase(), blobUrl);
      return blobUrl;
    };

    const modelUrl = registerFile(modelFile);
    companionFiles.forEach(registerFile);

    const manager = new THREE.LoadingManager();
    manager.setURLModifier(reqUrl => {
      if (reqUrl.startsWith('blob:') || reqUrl.startsWith('data:')) return reqUrl;
      const clean = decodeURIComponent(reqUrl).split('?')[0].toLowerCase();
      const base = clean.split('/').pop();
      return urlMap.get(clean) || urlMap.get(base) || reqUrl;
    });

    const loader = new THREE.GLTFLoader(manager);
    loader.load(
      modelUrl,
      gltf => {
        applyGLBToVehicle(gltf.scene, CARS[carIndex], CO[carIndex], createdUrls, modelFile.name);
        resolve(carIndex);
      },
      undefined,
      err => {
        createdUrls.forEach(u => URL.revokeObjectURL(u));
        reject(err || new Error(`Falha ao carregar ${modelFile.name}`));
      }
    );
  });
}

export async function importVehicleFiles(fileList, targetIndex = state.ci) {
  const files = [...(fileList || [])];
  if (!files.length) throw new Error('Nenhum arquivo selecionado');

  const modelFiles = files.filter(f => /\.(glb|gltf)$/i.test(f.name));
  const companionFiles = files.filter(f => /\.(bin|png|jpe?g|webp)$/i.test(f.name));
  const imageFiles = files.filter(f => /\.(png|jpe?g|webp)$/i.test(f.name));

  if (!modelFiles.length) {
    if (!imageFiles.length) throw new Error('Selecione um arquivo .glb/.gltf ou imagens de textura');
    const count = await applyExtraTexturesToVehicle(imageFiles, CO[targetIndex]);
    if (!count) throw new Error('Nenhuma malha compatível para aplicar textura');
    return { loadedCars: [targetIndex], message: `Textura aplicada em ${CARS[targetIndex].b} ${CARS[targetIndex].n}` };
  }

  if (modelFiles.length === 1) {
    const modelFile = modelFiles[0];
    await loadSingleModelWithManager(modelFile, companionFiles, targetIndex);
    if (/\.glb$/i.test(modelFile.name) && imageFiles.length > 0) {
      await applyExtraTexturesToVehicle(imageFiles, CO[targetIndex]);
    }
    return {
      loadedCars: [targetIndex],
      message: `${modelFile.name} carregado em ${CARS[targetIndex].b} ${CARS[targetIndex].n}`
    };
  }

  const loadedCars = [];
  for (const mf of modelFiles) {
    const matchedIdx = matchCarIndexByFilename(mf.name);
    const idx = matchedIdx >= 0 ? matchedIdx : targetIndex;
    await loadSingleModelWithManager(mf, companionFiles, idx);
    loadedCars.push(idx);
  }
  return {
    loadedCars,
    message: `${loadedCars.length} modelo(s) .glb importado(s) na garagem`
  };
}

export async function loadCarGLBFromFile(file) {
  const res = await importVehicleFiles([file], state.ci);
  return res.message;
}

// ---------- Módulo 5: Casco Paramétrico LoftedHull 36x24 (Mid-Engine Exotic vs Front-Engine Coupé/Sedan)
function buildLoftedHullGeo(s, t, gc) {
  const L = s.L;
  const W = s.W;
  const h = s.H - gc;
  const isSuper = s.t == 2;
  const NX = 36;
  const NU = 24;
  const positions = [];
  const uvs = [];
  const indices = [];

  const profileAt = u => {
    const x = lp(-L * 0.5, L * 0.5, u);

    // Afinamento aerodinâmico no nariz (cunha mais agressiva em supercarros centrais) e traseira esculpida
    const nosePow = isSuper ? 1.55 : 1.78;
    const noseAmt = isSuper ? 0.29 : 0.24;
    const noseTaper = u > 0.74 ? Math.pow((u - 0.74) / 0.26, nosePow) * noseAmt : 0;
    const tailTaper = u < 0.13 ? Math.pow((0.13 - u) / 0.13, 1.6) * 0.085 : 0;

    // Cintura lateral esculpida + entradas de ar laterais no supercarro motor central
    const midIntake = isSuper ? -Math.exp(-Math.pow((u - 0.34) / 0.075, 2)) * 0.068 : 0;
    const waist = -Math.sin(cl((u - 0.28) / 0.44, 0, 1) * Math.PI) * 0.028 + midIntake;

    // Caixas de roda alargadas (widebody) pronunciadas sobre os eixos dianteiro e traseiro
    const rearHaunch = Math.exp(-Math.pow((u - 0.18) / 0.092, 2)) * (isSuper ? 0.082 : 0.068);
    const frontHaunch = Math.exp(-Math.pow((u - 0.82) / 0.088, 2)) * 0.052;
    const halfW = W * 0.5 * (1 - noseTaper - tailTaper + waist + rearHaunch + frontHaunch);

    // Difusor traseiro elevado e splitter frontal inferior
    const rearUpsweep = u < 0.14 ? Math.pow((0.14 - u) / 0.14, 1.55) * 0.14 : 0;
    const frontLip = u > 0.89 ? Math.pow((u - 0.89) / 0.11, 1.45) * 0.048 : 0;
    const yBot = gc + rearUpsweep + frontLip;

    // Linha de cintura aerodinâmica
    let yBelt;
    const wbU = 0.5 + t.wb;
    if (u > wbU) {
      const k = (u - wbU) / (1 - wbU);
      const hoodCurve = Math.pow(k, isSuper ? 1.18 : 1.38);
      yBelt = lp(gc + h * (t.hd + 0.08), gc + h * (isSuper ? 0.23 : 0.32), hoodCurve);
    } else if (u > 0.22) {
      const k = (0.22 - u) / (0.22 - wbU);
      yBelt = lp(gc + h * (isSuper ? 0.67 : 0.65), gc + h * (t.hd + 0.08), k);
    } else {
      const k = u / 0.22;
      const ducktail = Math.exp(-Math.pow((u - 0.024) / 0.032, 2)) * 0.048;
      yBelt = lp(gc + h * 0.61, gc + h * (isSuper ? 0.67 : 0.65), Math.pow(k, 0.72)) + ducktail;
    }

    // Power dome no capô dianteiro (Coupé/Sedã) ou deck traseiro rebaixado para janela do motor (Supercarro)
    let crownBoost = Math.sin(cl(u, 0.02, 0.98) * Math.PI) * 0.042;
    let powerDome = 0;
    if (!isSuper && u > wbU + 0.02 && u < 0.95) {
      powerDome = Math.sin(((u - wbU) / (0.95 - wbU)) * Math.PI) * 0.036;
    } else if (isSuper && u > 0.12 && u < 0.36) {
      crownBoost -= Math.sin(((u - 0.12) / 0.24) * Math.PI) * 0.032;
    }
    const sideCrease = Math.sin(cl((u - 0.14) / 0.72, 0, 1) * Math.PI) * 0.026;

    return { x, halfW, yBot, yBelt, crownBoost, powerDome, sideCrease };
  };

  for (let ix = 0; ix <= NX; ix++) {
    const u = ix / NX;
    const p = profileAt(u);
    const yMid = lp(p.yBot, p.yBelt, 0.48);
    const yTop = p.yBelt + p.crownBoost;

    for (let iu = 0; iu <= NU; iu++) {
      const a = (iu / NU) * Math.PI * 2;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      let z;
      let y;

      if (ca >= 0) {
        // Metade superior com tumblehome e power-dome central no capô
        const tSide = Math.pow(Math.abs(sa), 0.78) * Math.sign(sa);
        const tTop = Math.pow(ca, 0.72);
        const tumble = lp(1.0, 0.91, tTop);
        const centerDome = Math.exp(-Math.pow(tSide / 0.35, 2)) * p.powerDome;
        z = tSide * p.halfW * tumble;
        y = lp(yMid, yTop, tTop) + (1 - Math.abs(tSide)) * 0.016 + centerDome;
      } else {
        // Flanco esculpido com vinco lateral aerodinâmico e saia afunilada
        const tSide = Math.pow(Math.abs(sa), 0.72) * Math.sign(sa);
        const tBot = Math.pow(-ca, 0.85);
        const creaseOut = Math.exp(-Math.pow((tBot - 0.26) / 0.18, 2)) * p.sideCrease;
        z = tSide * (p.halfW * lp(1.0, 0.84, tBot) + creaseOut);
        y = lp(yMid, p.yBot, tBot);
      }

      positions.push(p.x, y, z);
      uvs.push(u, iu / NU);
    }
  }

  const ring = NU + 1;
  for (let ix = 0; ix < NX; ix++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = ix * ring + iu;
      const b = a + ring;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const pRear = profileAt(0);
  const rearCenterIdx = positions.length / 3;
  positions.push(pRear.x - 0.04, lp(pRear.yBot, pRear.yBelt, 0.5), 0);
  uvs.push(0, 0.5);
  for (let iu = 0; iu < NU; iu++) {
    indices.push(rearCenterIdx, iu + 1, iu);
  }

  const pFront = profileAt(1);
  const frontCenterIdx = positions.length / 3;
  positions.push(pFront.x + 0.05, lp(pFront.yBot, pFront.yBelt, 0.34), 0);
  uvs.push(1, 0.5);
  const frontBase = NX * ring;
  for (let iu = 0; iu < NU; iu++) {
    indices.push(frontCenterIdx, frontBase + iu, frontBase + iu + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Cabine esculpida com vidro reflexivo translúcido, teto e colunas C fastback/teardrop
function buildLoftedGreenhouse(s, t, gc) {
  const L = s.L;
  const W = s.W;
  const h = s.H - gc;
  const isSuper = s.t == 2;
  const yBase = gc + h * 0.55;
  const yPeak = gc + h * 0.99;

  const xRearGlass = -L * (isSuper ? 0.31 : 0.41);
  const xRoofRear = L * t.rb;
  const xRoofFront = L * t.rf;
  const xWindshieldBot = L * t.wb + 0.16;

  const stations = 22;
  const radialSegs = 16;
  const glassPos = [];
  const glassIdx = [];

  const stationData = v => {
    const x = lp(xRearGlass, xWindshieldBot, v);
    let yTop;
    let wFactor;
    if (x < xRoofRear) {
      const k = cl((x - xRearGlass) / (xRoofRear - xRearGlass), 0, 1);
      yTop = lp(yBase + 0.03, yPeak, Math.pow(k, 0.72));
      wFactor = lp(isSuper ? 0.62 : 0.68, 0.76, k);
    } else if (x <= xRoofFront) {
      const k = (x - xRoofRear) / (xRoofFront - xRoofRear);
      yTop = yPeak + Math.sin(k * Math.PI) * 0.032;
      wFactor = 0.76 - Math.abs(k - 0.5) * 0.02;
    } else {
      const k = cl((xWindshieldBot - x) / (xWindshieldBot - xRoofFront), 0, 1);
      yTop = lp(yBase + 0.01, yPeak, Math.pow(k, 0.78));
      wFactor = lp(0.79, 0.76, k);
    }
    return { x, yTop, halfW: W * 0.5 * wFactor };
  };

  for (let ix = 0; ix <= stations; ix++) {
    const v = ix / stations;
    const st = stationData(v);
    for (let ir = 0; ir <= radialSegs; ir++) {
      const u = (ir / radialSegs) * Math.PI;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const z = Math.sign(cu) * Math.pow(Math.abs(cu), 0.82) * st.halfW;
      const y = lp(yBase - 0.02, st.yTop, Math.pow(su, 0.75));
      glassPos.push(st.x, y, z);
    }
  }

  const ring = radialSegs + 1;
  for (let ix = 0; ix < stations; ix++) {
    for (let ir = 0; ir < radialSegs; ir++) {
      const a = ix * ring + ir;
      const b = a + ring;
      const c = b + 1;
      const d = a + 1;
      glassIdx.push(a, b, d, b, c, d);
    }
  }

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(glassPos, 3));
  glassGeo.setIndex(glassIdx);
  glassGeo.computeVertexNormals();

  const roofPos = [];
  const roofIdx = [];
  const rStations = 10;
  const rSegs = 12;
  for (let ix = 0; ix <= rStations; ix++) {
    const v = ix / rStations;
    const x = lp(xRoofRear - 0.04, xRoofFront + 0.04, v);
    const k = (x - xRoofRear) / (xRoofFront - xRoofRear);
    const crown = yPeak + Math.sin(cl(k, 0, 1) * Math.PI) * 0.036;
    const hw = W * 0.345;
    for (let ir = 0; ir <= rSegs; ir++) {
      const u = (ir / rSegs) * 2 - 1;
      const z = u * hw;
      const y = crown - (u * u) * 0.055;
      roofPos.push(x, y, z);
    }
  }
  const rRing = rSegs + 1;
  for (let ix = 0; ix < rStations; ix++) {
    for (let ir = 0; ir < rSegs; ir++) {
      const a = ix * rRing + ir;
      const b = a + rRing;
      const c = b + 1;
      const d = a + 1;
      roofIdx.push(a, d, b, b, d, c);
    }
  }
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
  roofGeo.setIndex(roofIdx);
  roofGeo.computeVertexNormals();

  const cPillarCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xRoofRear + 0.02, yPeak - 0.03, -W * 0.33),
    new THREE.Vector3(lp(xRoofRear, xRearGlass, 0.5), lp(yPeak, yBase + 0.05, 0.45), -W * 0.335),
    new THREE.Vector3(xRearGlass - 0.04, yBase + 0.02, -W * 0.33)
  ]);
  const cPillarCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xRoofRear + 0.02, yPeak - 0.03, W * 0.33),
    new THREE.Vector3(lp(xRoofRear, xRearGlass, 0.5), lp(yPeak, yBase + 0.05, 0.45), W * 0.335),
    new THREE.Vector3(xRearGlass - 0.04, yBase + 0.02, W * 0.33)
  ]);
  const cPillarGeoL = new THREE.TubeGeometry(cPillarCurveL, 10, 0.052, 8, false);
  const cPillarGeoR = new THREE.TubeGeometry(cPillarCurveR, 10, 0.052, 8, false);

  const aPillarCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xRoofFront - 0.02, yPeak - 0.03, -W * 0.33),
    new THREE.Vector3(xWindshieldBot - 0.02, yBase + 0.01, -W * 0.39)
  ]);
  const aPillarCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xRoofFront - 0.02, yPeak - 0.03, W * 0.33),
    new THREE.Vector3(xWindshieldBot - 0.02, yBase + 0.01, W * 0.39)
  ]);
  const aPillarGeoL = new THREE.TubeGeometry(aPillarCurveL, 8, 0.042, 8, false);
  const aPillarGeoR = new THREE.TubeGeometry(aPillarCurveR, 8, 0.042, 8, false);

  return { glassGeo, roofGeo, cPillarGeoL, cPillarGeoR, aPillarGeoL, aPillarGeoR, yBase, yPeak };
}

// ---------- construtor automotivo paramétrico de alta definição
export function build(s, pl) {
  const m = new THREE.Group();
  const bd = new THREE.Group();
  const procGroup = new THREE.Group();
  const t = TY[s.t];
  const L = s.L;
  const W = s.W;
  const H = s.H;
  const gc = 0.13;
  const h = H - gc;
  const by = gc + h * 0.58;
  const isSuper = s.t == 2;
  const wheelR = isSuper ? 0.35 : 0.34;
  const name = s.n || '';

  const paint = new THREE.MeshPhysicalMaterial({
    color: s.col,
    metalness: 0.58,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
    envMapIntensity: 1.1
  });

  // 1. Casco aerodinâmico paramétrico 36x24
  const hullGeo = buildLoftedHullGeo(s, t, gc);
  const hullMesh = new THREE.Mesh(hullGeo, paint);
  procGroup.add(hullMesh);

  // Splitter frontal em carbono e saias laterais esculpidas
  const splitterGeo = new THREE.CylinderGeometry(W * 0.44, W * 0.47, 0.034, 18);
  splitterGeo.scale(0.56, 1, 1);
  const splitter = new THREE.Mesh(splitterGeo, M.carbon);
  splitter.position.set(L * 0.45, gc + 0.025, 0);
  procGroup.add(splitter);

  [-1, 1].forEach(side => {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, L * 0.52, 8), M.carbon);
    skirt.rotation.z = Math.PI / 2;
    skirt.position.set(0, gc + 0.025, side * (W * 0.465));
    procGroup.add(skirt);

    // Duto de entrada de ar lateral em supercarros motor central
    if (isSuper) {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.32, h * 0.24, 0.08), M.grille);
      scoop.position.set(-L * 0.16, gc + h * 0.42, side * (W * 0.445));
      scoop.rotation.y = side * 0.18;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, h * 0.26, 0.025), M.carbon);
      blade.position.set(-L * 0.18, gc + h * 0.42, side * (W * 0.47));
      procGroup.add(scoop, blade);
    }
  });

  // 2. Cabine com vidro reflexivo translúcido (interior visível de fora!) + teto + colunas
  const gh = buildLoftedGreenhouse(s, t, gc);
  const cab = new THREE.Mesh(gh.glassGeo, M.glass);
  cab.renderOrder = 4;
  const roofMat = name.includes('M3') ? M.carbon : paint;
  const roof = new THREE.Mesh(gh.roofGeo, roofMat);
  const cPillarL = new THREE.Mesh(gh.cPillarGeoL, paint);
  const cPillarR = new THREE.Mesh(gh.cPillarGeoR, paint);
  const aPillarL = new THREE.Mesh(gh.aPillarGeoL, paint);
  const aPillarR = new THREE.Mesh(gh.aPillarGeoR, paint);
  procGroup.add(cab, roof, cPillarL, cPillarR, aPillarL, aPillarR);

  // Retrovisores externos aerodinâmicos
  [-1, 1].forEach(side => {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.12), M.carbon);
    stalk.position.set(L * t.wb + 0.05, gh.yBase + 0.05, side * (W * 0.44));
    const mirCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), paint);
    mirCap.scale.set(1.32, 0.72, 1.15);
    mirCap.position.set(L * t.wb + 0.04, gh.yBase + 0.085, side * (W * 0.5));
    procGroup.add(stalk, mirCap);
  });

  // Cofre traseiro envidraçado ventilado + Bloco V8/V10 detalhado com coletores metálicos (Huracán EVO / 488 GTB)
  if (isSuper) {
    const bayX = -L * 0.25;
    const bayY = gc + h * 0.62;
    const engWell = new THREE.Mesh(new THREE.BoxGeometry(L * 0.24, 0.08, W * 0.46), M.grille);
    engWell.position.set(bayX, bayY - 0.06, 0);

    const engBlock = new THREE.Mesh(new THREE.BoxGeometry(L * 0.17, 0.09, W * 0.18), M.engineAlloy);
    engBlock.position.set(bayX, bayY - 0.02, 0);

    const bankMat = name.includes('488') ? M.engineRed : M.engineGold;
    [-1, 1].forEach(side => {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, 0.045, 0.09), bankMat);
      bank.position.set(bayX, bayY + 0.025, side * 0.12);
      bank.rotation.x = side * 0.28;
      procGroup.add(bank);

      // Coletores de escapamento individuais metálicos
      const runners = name.includes('Huracán') ? 5 : 4;
      for (let r = 0; r < runners; r++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), M.chrome);
        pipe.position.set(bayX - 0.18 + r * 0.085, bayY + 0.01, side * 0.18);
        pipe.rotation.x = side * 0.65;
        procGroup.add(pipe);
      }
    });

    // Barra estrutural em X sobre o motor
    [-1, 1].forEach(side => {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, L * 0.24, 8), M.carbon);
      brace.rotation.z = Math.PI / 2;
      brace.rotation.y = side * 0.48;
      brace.position.set(bayX, bayY + 0.065, 0);
      procGroup.add(brace);
    });

    const engBayGlass = new THREE.Mesh(new THREE.BoxGeometry(L * 0.25, 0.02, W * 0.48), M.engineGlass);
    engBayGlass.position.set(bayX, bayY + 0.085, 0);
    engBayGlass.rotation.z = 0.15;
    engBayGlass.renderOrder = 5;
    procGroup.add(engWell, engBlock, engBayGlass);
  }

  // 3. Traseira de destaque para Câmera Chase (lanternas LED exclusivas, difusor profundo, placa, 4 ponteiras)
  const tl = pl ? M.tailT.clone() : M.tailT;
  const rearX = -L * 0.5;

  const rearFascia = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.28, W * 0.84), M.grille);
  rearFascia.position.set(rearX + 0.04, gc + h * 0.46, 0);
  procGroup.add(rearFascia);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.28, h * 0.2, W * 0.8), M.diffuser);
  diffuser.position.set(rearX + 0.11, gc + h * 0.16, 0);
  diffuser.rotation.z = 0.22;
  procGroup.add(diffuser);
  [-0.32, -0.16, 0, 0.16, 0.32].forEach(zRate => {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.26, h * 0.17, 0.024), M.diffuser);
    strake.position.set(rearX + 0.07, gc + h * 0.145, zRate * W * 0.48);
    procGroup.add(strake);
  });

  // Placa traseira iluminada
  const plateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.13, 0.46), M.diffuser);
  plateFrame.position.set(rearX - 0.004, gc + h * 0.33, 0);
  const plateFace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.105, 0.42), M.plate);
  plateFace.position.set(rearX - 0.011, gc + h * 0.33, 0);
  procGroup.add(plateFrame, plateFace);

  // 4 ponteiras de escapamento cromadas com miolo escuro
  const exOuterGeo = new THREE.CylinderGeometry(0.048, 0.052, 0.18, 14);
  exOuterGeo.rotateZ(Math.PI / 2);
  const exInnerGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.19, 12);
  exInnerGeo.rotateZ(Math.PI / 2);
  const exOffsets = name.includes('Huracán')
    ? [-0.14, -0.06, 0.06, 0.14]
    : [-0.33, -0.22, 0.22, 0.33];
  const exY = name.includes('Huracán') ? gc + h * 0.29 : gc + h * 0.15;
  exOffsets.forEach(zRate => {
    const tip = new THREE.Mesh(exOuterGeo, M.chrome);
    tip.position.set(rearX - 0.02, exY, zRate * W);
    const bore = new THREE.Mesh(exInnerGeo, M.grille);
    bore.position.set(rearX - 0.025, exY, zRate * W);
    procGroup.add(tip, bore);
  });

  // Assinaturas LED traseiras exclusivas por modelo
  [-1, 1].forEach(side => {
    if (name.includes('GT-R') || name.includes('488')) {
      const ringGeo = new THREE.TorusGeometry(0.07, 0.023, 10, 20);
      ringGeo.rotateY(Math.PI / 2);
      const r1 = new THREE.Mesh(ringGeo, tl);
      r1.position.set(rearX - 0.012, gc + h * 0.51, side * W * 0.35);
      procGroup.add(r1);
      if (name.includes('GT-R')) {
        const r2 = new THREE.Mesh(ringGeo, tl);
        r2.scale.setScalar(0.82);
        r2.position.set(rearX - 0.012, gc + h * 0.51, side * W * 0.23);
        procGroup.add(r2);
      }
    } else if (name.includes('Mustang')) {
      [-0.08, 0, 0.08].forEach(barOff => {
        const tri = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.135, 0.044), tl);
        tri.position.set(rearX - 0.012, gc + h * 0.5, side * W * 0.33 + barOff);
        procGroup.add(tri);
      });
    } else if (name.includes('Huracán')) {
      const yStem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.036, 0.34), tl);
      yStem.position.set(rearX - 0.014, gc + h * 0.51, side * W * 0.31);
      const yArmA = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.12), tl);
      yArmA.position.set(rearX - 0.012, gc + h * 0.54, side * W * 0.42);
      yArmA.rotation.x = side * 0.45;
      const yArmB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.12), tl);
      yArmB.position.set(rearX - 0.012, gc + h * 0.48, side * W * 0.42);
      yArmB.rotation.x = side * -0.45;
      procGroup.add(yStem, yArmA, yArmB);
    } else {
      const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.062, 0.42), tl);
      mainBlade.position.set(rearX - 0.014, gc + h * 0.51, side * W * 0.32);
      mainBlade.rotation.y = side * -0.14;
      const cornerHook = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.052, 0.06), tl);
      cornerHook.position.set(rearX + 0.04, gc + h * 0.51, side * W * 0.44);
      procGroup.add(mainBlade, cornerHook);
    }
  });

  if (name.includes('911') || name.includes('Huracán')) {
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.032, W * 0.72), tl);
    tailBar.position.set(rearX - 0.015, gc + h * 0.51, 0);
    procGroup.add(tailBar);
  }
  const thirdBrake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.36), tl);
  thirdBrake.position.set(L * t.rb - 0.03, gh.yPeak - 0.04, 0);
  procGroup.add(thirdBrake);

  // Faróis dianteiros + grade
  const projGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10);
  projGeo.rotateZ(Math.PI / 2);
  if (name.includes('M3')) {
    [-0.13, 0.13].forEach(zOff => {
      const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.24, 0.19), M.grille);
      kidney.position.set(L * 0.49, gc + h * 0.2, zOff);
      procGroup.add(kidney);
    });
  } else {
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.16, W * 0.44), M.grille);
    grille.position.set(L * 0.49, gc + h * 0.16, 0);
    procGroup.add(grille);
  }
  [-1, 1].forEach(side => {
    const hlBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.3), M.grille);
    hlBox.position.set(L * 0.46, gc + h * 0.34, side * W * 0.3);
    hlBox.rotation.y = side * -0.18;
    const proj = new THREE.Mesh(projGeo, M.head);
    proj.position.set(L * 0.48, gc + h * 0.345, side * W * 0.3);
    const drlBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.31), M.drl);
    drlBar.position.set(L * 0.48, gc + h * 0.31, side * W * 0.3);
    drlBar.rotation.y = side * -0.18;
    procGroup.add(hlBox, proj, drlBar);
  });

  // Aerofólio traseiro esculpido específico por modelo
  if (isSuper || name == 'GT-R R35' || name == 'GR Supra' || name == '911 Carrera S' || name == 'Mustang GT') {
    const isLip = name == 'GR Supra' || name == '911 Carrera S';
    const wingY = isLip ? gc + h * 0.67 : gc + h * 0.83;
    const wingX = rearX + 0.14;
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(isLip ? 0.16 : 0.28, 0.032, W * (isLip ? 0.78 : 0.87)), paint);
    wingBlade.position.set(wingX, wingY, 0);
    wingBlade.rotation.z = 0.09;
    procGroup.add(wingBlade);

    if (!isLip) {
      [-1, 1].forEach(side => {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.036), M.carbon);
        pylon.position.set(wingX + 0.03, wingY - 0.1, side * W * 0.25);
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.022), M.carbon);
        endplate.position.set(wingX, wingY - 0.01, side * W * 0.435);
        procGroup.add(pylon, endplate);
      });
    }
  }

  // 4. Interior completo e sempre visível através dos vidros (2 bancos concha, painel, multimídia, volante e santantônio)
  const it = new THREE.Group();
  const cabinFront = L * t.wb;
  const cw = W * 0.7;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(L * (t.wb - t.rb) + 0.35, 0.03, cw), M.dark);
  fl.position.set(L * (t.wb + t.rb) / 2, by - 0.14, 0);
  const consoleTunnel = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, 0.2, 0.2), M.dashTrim);
  consoleTunnel.position.set(cabinFront - 0.56, by + 0.01, 0);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, cw * 0.96), M.dark);
  dash.position.set(cabinFront - 0.14, by + 0.15, 0);
  const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.38), M.dashTrim);
  binnacle.position.set(cabinFront - 0.25, by + 0.28, -0.35);
  const clusterScreen = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.32), M.clusterGlow);
  clusterScreen.position.set(cabinFront - 0.34, by + 0.26, -0.35);
  const revStrip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.26), M.accentOrange);
  revStrip.position.set(cabinFront - 0.355, by + 0.29, -0.35);
  const centerDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.22), M.screenGlow);
  centerDisplay.position.set(cabinFront - 0.34, by + 0.25, 0);
  centerDisplay.rotation.y = -0.18;
  const headerBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, cw * 0.94), M.dark);
  headerBar.position.set(L * t.rf - 0.02, by + h * 0.355, 0);
  const rearViewMirror = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.2), M.dashTrim);
  rearViewMirror.position.set(L * t.rf + 0.03, by + h * 0.29, 0);

  // 2 Bancos esportivos tipo concha com apoios laterais e encosto de cabeça
  [-0.35, 0.35].forEach(sz => {
    const seatGrp = new THREE.Group();
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.36), M.seatCloth);
    cushion.position.set(0.14, -0.14, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.44, 0.34), M.seatCloth);
    back.position.set(-0.04, 0.1, 0);
    back.rotation.z = 0.24;
    const headRest = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.18), M.dark);
    headRest.position.set(-0.1, 0.37, 0);
    headRest.rotation.z = 0.18;
    seatGrp.add(cushion, back, headRest);
    [-0.17, 0.17].forEach(bol => {
      const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.06), M.dark);
      bolster.position.set(-0.01, 0.08, bol);
      bolster.rotation.z = 0.24;
      seatGrp.add(bolster);
    });
    seatGrp.position.set(cabinFront - 1.02, by + 0.06, sz);
    it.add(seatGrp);
  });

  // Santantônio tubular (roll-cage) atrás dos bancos visível pelo vidro traseiro
  const hoopX = L * t.rb - 0.05;
  const hoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hoopX, by - 0.08, -cw * 0.42),
    new THREE.Vector3(hoopX, by + h * 0.31, -cw * 0.36),
    new THREE.Vector3(hoopX, by + h * 0.33, 0),
    new THREE.Vector3(hoopX, by + h * 0.31, cw * 0.36),
    new THREE.Vector3(hoopX, by - 0.08, cw * 0.42)
  ]);
  const rollHoop = new THREE.Mesh(new THREE.TubeGeometry(hoopCurve, 14, 0.022, 8, false), M.rollCage);
  const diagCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hoopX, by + h * 0.31, -cw * 0.34),
    new THREE.Vector3(hoopX - 0.06, by - 0.06, cw * 0.34)
  ]);
  const rollDiag = new THREE.Mesh(new THREE.TubeGeometry(diagCurve, 6, 0.018, 6, false), M.rollCage);
  const harnessBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, cw * 0.78, 8), M.rollCage);
  harnessBar.rotation.x = Math.PI / 2;
  harnessBar.position.set(hoopX - 0.02, by + 0.06, 0);

  // Volante esportivo 3 raios com marcação laranja 12h
  const sw = new THREE.Group();
  const swRim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 10, 24), M.dark);
  swRim.rotation.y = Math.PI / 2;
  const swHub = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 12), M.dashTrim);
  swHub.rotation.z = Math.PI / 2;
  const swMarker = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.036), M.accentOrange);
  swMarker.position.set(0, 0.155, 0);
  const swSpokeL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.13), M.chrome);
  swSpokeL.position.set(0, 0, -0.075);
  const swSpokeR = swSpokeL.clone();
  swSpokeR.position.set(0, 0, 0.075);
  const swSpokeB = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.028), M.chrome);
  swSpokeB.position.set(0, -0.075, 0);
  sw.add(swRim, swHub, swMarker, swSpokeL, swSpokeR, swSpokeB);
  sw.position.set(cabinFront - 0.44, by + 0.24, -0.35);
  sw.rotation.z = 0.28;

  it.add(fl, consoleTunnel, dash, binnacle, clusterScreen, revStrip, centerDisplay, headerBar, rearViewMirror, rollHoop, rollDiag, harnessBar, sw);
  it.visible = true;
  procGroup.add(it);

  // 5. Rodas e Freios de Alta Fidelidade (5 raios duplos côncavos, calota central, discos ventilados e pinças Brembo fixas)
  const frontGeos = getWheelGeos(wheelR, 0.26);
  const rearGeos = getWheelGeos(wheelR, 0.32);
  const caliperMat = (s.col === 0xb81414 || s.col === 0xdfa800) ? M.caliperYellow : M.caliperRed;
  const procSpin = [];
  const procSpinFront = [];
  const procSpinRear = [];
  const procFr = [];

  [[1, -1], [1, 1], [-1, -1], [-1, 1]].forEach(([fx, sz]) => {
    const pv = new THREE.Group();
    const w = new THREE.Group();
    const g = fx > 0 ? frontGeos : rearGeos;

    const tireTread = new THREE.Mesh(g.tireTread, M.tire);
    const tireOut = new THREE.Mesh(g.tireShoulder, M.tireWall);
    tireOut.position.z = sz * g.halfSide;
    const tireIn = new THREE.Mesh(g.tireShoulder, M.tireWall);
    tireIn.position.z = -sz * g.halfSide;
    const rimLip = new THREE.Mesh(g.rimLip, M.rim);
    rimLip.position.z = sz * (g.halfSide + 0.024);
    const rimBarrel = new THREE.Mesh(g.rimBarrel, M.dark);
    const rimHub = new THREE.Mesh(g.rimHub, M.rim);
    rimHub.position.z = sz * (g.halfSide * 0.45);
    const hubCap = new THREE.Mesh(g.hubCap, M.rimCap);
    hubCap.position.z = sz * (g.halfSide - 0.015);
    const disc = new THREE.Mesh(g.discGeo, M.brakeDisc);
    disc.position.z = sz * 0.015;

    w.add(tireTread, tireOut, tireIn, rimLip, rimBarrel, rimHub, hubCap, disc);

    // 5 pares de raios duplos forjados com concavidade esportiva rumo ao cubo central
    for (let k = 0; k < 5; k++) {
      const baseAngle = (k / 5) * Math.PI * 2;
      [-0.14, 0.14].forEach(spread => {
        const spoke = new THREE.Mesh(g.spokeGeo, M.rim);
        const a = baseAngle + spread;
        spoke.position.set(
          Math.cos(a) * wheelR * 0.35,
          Math.sin(a) * wheelR * 0.35,
          sz * (g.halfSide + 0.004)
        );
        spoke.rotation.z = a - Math.PI / 2;
        spoke.rotation.order = 'ZYX';
        spoke.rotation.x = sz * 0.16;
        w.add(spoke);
      });
    }

    // Pinça Brembo acoplada à manga de eixo (pv), mantendo-se estacionária enquanto roda e disco giram
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.16, 0.085), caliperMat);
    caliper.position.set(fx > 0 ? -wheelR * 0.37 : wheelR * 0.37, 0.04, sz * 0.03);

    pv.add(w, caliper);
    pv.position.set(fx * L * 0.32, wheelR, sz * (W * 0.5 - (fx < 0 ? 0.105 : 0.125)));
    procGroup.add(pv);
    procSpin.push(w);
    if (fx > 0) {
      procSpinFront.push(w);
      procFr.push(pv);
    } else {
      procSpinRear.push(w);
    }
  });

  bd.add(procGroup);

  // Sombra de contato de 4 pneus + chassi no asfalto (y = 0.025)
  const contactPlane = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.16, W * 1.22), contactShadowMat);
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.y = 0.025;
  m.add(contactPlane);

  m.add(bd);
  m.rotation.y = Math.PI / 2;
  const root = new THREE.Group();
  root.add(m);
  root.traverse(o => {
    if (o.isMesh && o !== contactPlane && o !== cab) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  root.rotation.order = 'YXZ';

  const refs = {
    root,
    bd,
    procGroup,
    glbModel: null,
    glbObjectUrls: [],
    glbPivots: [],
    glbName: '',
    wheelR,
    procWheelR: wheelR,
    spin: procSpin,
    spinFront: procSpinFront,
    spinRear: procSpinRear,
    fr: procFr,
    procSpin,
    procSpinFront,
    procSpinRear,
    procFr,
    cab,
    roof,
    it,
    sw,
    tl,
    eye: new THREE.Vector3(L * t.wb - 0.68, by + 0.37, -0.35),
    hood: new THREE.Vector3(L * t.wb + 0.25, by + 0.3, 0)
  };

  if (pl) {
    tryAttachRealGLB(s, refs);
  }

  return refs;
}

// ---------- instâncias dos carros do jogador
export const CO = CARS.map(c => {
  const o = build(c, 1);
  o.root.visible = false;
  S.add(o.root);
  return o;
});

export const co = () => CO[state.ci];

// ---------- tráfego
export const TR = [];
for (let i = 0; i < 18; i++) {
  const o = build({
    n: 'T',
    col: new THREE.Color().setHSL(Math.random(), 0.32 + Math.random() * 0.35, 0.24 + Math.random() * 0.3).getHex(),
    L: 4.2 + Math.random() * 0.5,
    W: 1.82,
    H: 1.38 + Math.random() * 0.14,
    t: Math.random() < 0.5 ? 0 : 1
  }, 0);
  o.root.visible = false;
  S.add(o.root);
  TR.push({ o, z: 0, v: 25, vt: 25, l: 0, on: 1 });
}

const LN = [-5.6, -1.9, 1.9, 5.6];

export function spawn(t, far) {
  for (let a = 0; a < 6; a++) {
    const z = P.z - (far ? 1100 + Math.random() * 300 : 150 + Math.random() * 1150);
    const l = LN[Math.random() * 4 | 0];
    if (!TR.some(u => u !== t && u.l == l && Math.abs(u.z - z) < 60) || a == 5) {
      t.z = z;
      t.l = l;
      t.vt = t.v = 17 + Math.random() * 17;
      return;
    }
  }
}

export function trafficUpd(dt) {
  for (const t of TR) {
    t.z -= t.v * dt;
    let tv = t.vt;
    for (const u of TR) {
      if (u !== t && u.l == t.l) {
        const g = t.z - u.z;
        if (g > 0 && g < 38) tv = Math.min(tv, u.v);
      }
    }
    t.v += (tv - t.v) * Math.min(1, dt * (tv < t.v ? 2 : 0.3));
    if (t.z > P.z + 300 || t.z < P.z - 1500) spawn(t, 1);
    const o = t.o.root;
    o.position.set(cx(t.z) + t.l, ry(t.z) + 0.06, t.z);
    o.rotation.y = Math.atan2(cx(t.z) - cx(t.z - 2), 2);
    o.rotation.x = Math.atan((ry(t.z - 3) - ry(t.z + 3)) / 6);
    const tRw = t.o.wheelR || 0.34;
    t.o.spin.forEach(s => { s.rotation.z -= t.v / tRw * dt; });
  }
}

// ---------- posicionamento 3D alinhado aos 4 pontos do terreno e Câmera Orbital Estável (Zero Tremor / Zero Teleporte)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

const camOrb = {
  y: 0,
  dist: 8.5,
  lat: 0,
  ready: false
};

function getInterpPose(menu) {
  if (menu || state.mode != 'drive') {
    return { x: P.x, z: P.z, yaw: P.yaw, wAngF: P.wAngF, wAngR: P.wAngR };
  }
  const jumpDist = Math.hypot(P.x - P.prevX, P.z - P.prevZ);
  if (jumpDist > 3.0) {
    return { x: P.x, z: P.z, yaw: P.yaw, wAngF: P.wAngF, wAngR: P.wAngR };
  }
  const a = cl(state.renderAlpha ?? 1, 0, 1);
  return {
    x: lp(P.prevX, P.x, a),
    z: lp(P.prevZ, P.z, a),
    yaw: wrap(P.prevYaw + wrap(P.yaw - P.prevYaw) * a),
    wAngF: wrap(P.prevWAngF + wrap(P.wAngF - P.prevWAngF) * a),
    wAngR: wrap(P.prevWAngR + wrap(P.wAngR - P.prevWAngR) * a)
  };
}

export function placeCar(dt, menu) {
  const o = co();
  const c = car();
  const r = o.root;
  const pose = getInterpPose(menu);

  const fx = -Math.sin(pose.yaw);
  const fz = -Math.cos(pose.yaw);
  const rx = Math.cos(pose.yaw);
  const rz = -Math.sin(pose.yaw);
  const halfL = c.L * 0.32;
  const halfW = c.W * 0.44;

  const hFL = getGroundY(pose.x + fx * halfL - rx * halfW, pose.z + fz * halfL - rz * halfW);
  const hFR = getGroundY(pose.x + fx * halfL + rx * halfW, pose.z + fz * halfL + rz * halfW);
  const hRL = getGroundY(pose.x - fx * halfL - rx * halfW, pose.z - fz * halfL - rz * halfW);
  const hRR = getGroundY(pose.x - fx * halfL + rx * halfW, pose.z - fz * halfL + rz * halfW);

  const groundH = (hFL + hFR + hRL + hRR) * 0.25;
  const frontH = (hFL + hFR) * 0.5;
  const rearH = (hRL + hRR) * 0.5;
  const leftH = (hFL + hRL) * 0.5;
  const rightH = (hFR + hRR) * 0.5;

  const targetPitch = Math.atan2(frontH - rearH, halfL * 2);
  const targetRoll = Math.atan2(rightH - leftH, halfW * 2);
  const blend = dt > 0 ? 1 - Math.exp(-20 * dt) : 1;

  r.visible = true;
  r.position.set(pose.x, groundH, pose.z);
  r.rotation.y = pose.yaw;
  r.rotation.x = lp(r.rotation.x, targetPitch, blend);
  r.rotation.z = lp(r.rotation.z, targetRoll, blend);

  o.bd.rotation.z = P.pit;
  o.bd.rotation.x = P.rol;
  o.fr.forEach(p => { p.rotation.y = -P.steer; });

  // Rotação das rodas sincronizada com atrito do solo e interpolação sub-frame
  const rW = o.wheelR || 0.34;
  if (menu) {
    const dw = (P.spd / rW) * dt;
    P.wAngF = wrap(P.wAngF - dw);
    P.wAngR = P.wAngF;
  }
  o.spinFront.forEach(s => { s.rotation.z = menu ? P.wAngF : pose.wAngF; });
  o.spinRear.forEach(s => { s.rotation.z = menu ? P.wAngR : pose.wAngR; });

  o.sw.rotation.x = -P.steer * 3;
  // Lanternas LED traseiras: 2.2 rodando / 5.5 freando (aciona UnrealBloomPass)
  o.tl.emissiveIntensity = P.brk ? 5.5 : (set.tod == 5 ? 3.2 : (set.tod == 4 || set.tod == 0 || set.wx == 3 ? 2.6 : 2.2));

  // Interior permanece sempre visível através dos vidros; na câmera interna (1) oculta o vidro da cabine
  const interiorView = state.camMode == 1 && !menu;
  if (!o.glbModel) {
    o.procGroup.visible = true;
    o.cab.visible = !interiorView;
    o.roof.visible = true;
    o.it.visible = true;
  }

  r.updateMatrixWorld(true);

  _v1.set(c.L / 2, 0.72, 0);
  _v2.set(c.L / 2 + 38, -0.75, 0);
  _v3.set(c.L / 2 + 1.2, 0.75, 0);
  spot.position.copy(o.bd.localToWorld(_v1));
  spot.target.position.copy(o.bd.localToWorld(_v2));
  spot.target.updateMatrixWorld();
  headFill.position.copy(o.bd.localToWorld(_v3));
}

export function camUpd(dt) {
  const o = co();
  const c = car();
  const sp = Math.hypot(P.vx, P.vz);
  const kmh = sp * 3.6;
  const pose = getInterpPose(state.mode != 'drive');
  const y = getGroundY(pose.x, pose.z);
  const effDt = state.mode == 'pause' ? 0 : cl(dt, 0.0005, 0.05);
  let fov = 50;

  if (state.mode == 'menu' || state.mode == 'garage' || state.mode == 'settings' || state.mode == 'controls') {
    camOrb.ready = false;
    const g = state.mode == 'garage';
    const a = state.T * 0.15;
    const d = (g ? 6.2 : 8.5) + c.L * 0.3;
    cam.position.set(P.x + Math.sin(a) * d, y + (g ? 1.35 : 1.95) + Math.sin(state.T * 0.3) * 0.2, P.z + Math.cos(a) * d);
    cam.lookAt(P.x, y + 0.65, P.z);
    fov = g ? 38 : 34;
  } else {
    // Direção do carro ao longo do vetor frontal: evita inversão da câmera na ré ou parado
    const fwdSpd = -Math.sin(pose.yaw) * P.vx - Math.cos(pose.yaw) * P.vz;
    const velYaw = fwdSpd > 6 ? Math.atan2(-P.vx, -P.vz) : pose.yaw;
    const targetCy = fwdSpd > 6 ? pose.yaw + wrap(velYaw - pose.yaw) * 0.34 : pose.yaw;

    if (!camOrb.ready) {
      P.cy = targetCy;
    } else if (effDt > 0) {
      P.cy = wrap(P.cy + wrap(targetCy - P.cy) * (1 - Math.exp(-5.4 * effDt)));
    }

    if (state.camMode == 0) {
      const spdNorm = cl(kmh / 320, 0, 1);
      const targetDist = c.L * 0.9 + 4.35 + cl((P.ax || 0) * 0.04, -0.25, 0.45) + spdNorm * 0.45;
      const targetLat = cl(P.yr * 0.22 + P.slipAngle * 0.32, -0.48, 0.48);
      const targetH = 1.98 + spdNorm * 0.18;

      if (!camOrb.ready || Math.abs(camOrb.y - y) > 12) {
        camOrb.y = y;
        camOrb.dist = targetDist;
        camOrb.lat = targetLat;
        camOrb.ready = true;
      } else if (effDt > 0) {
        camOrb.y = lp(camOrb.y, y, 1 - Math.exp(-12 * effDt));
        camOrb.dist = lp(camOrb.dist, targetDist, 1 - Math.exp(-7.5 * effDt));
        camOrb.lat = lp(camOrb.lat, targetLat, 1 - Math.exp(-6.5 * effDt));
      }

      const cyw = P.cy;
      const rx = Math.cos(cyw);
      const rz = -Math.sin(cyw);

      _v1.set(
        pose.x + Math.sin(cyw) * camOrb.dist + rx * camOrb.lat,
        camOrb.y + targetH,
        pose.z + Math.cos(cyw) * camOrb.dist + rz * camOrb.lat
      );
      _v2.set(
        pose.x - Math.sin(cyw) * 3.2,
        camOrb.y + 0.96,
        pose.z - Math.cos(cyw) * 3.2
      );

      cam.position.copy(_v1);
      cam.lookAt(_v2);
      fov = lp(50, 64, spdNorm);
    } else if (state.camMode == 1) {
      camOrb.ready = false;
      _v1.copy(o.eye).add(_v3.set(cockpitOffset.eyeX, cockpitOffset.eyeY, cockpitOffset.eyeZ));
      _v2.copy(_v1).add(_v3.set(18, cockpitOffset.lookPitch, 0));
      cam.position.copy(o.bd.localToWorld(_v1));
      cam.lookAt(o.bd.localToWorld(_v2));
      fov = lp(68, 76, cl(kmh / 320, 0, 1));
    } else if (state.camMode == 2) {
      camOrb.ready = false;
      _v1.copy(o.hood);
      _v2.copy(o.hood).add(_v3.set(20, -0.55, 0));
      cam.position.copy(o.bd.localToWorld(_v1));
      cam.lookAt(o.bd.localToWorld(_v2));
      fov = lp(62, 72, cl(kmh / 320, 0, 1));
    } else {
      camOrb.ready = false;
      const a = pose.yaw + Math.PI * (0.72 + 0.28 * Math.sin(state.T * 0.12));
      const d = 9 + kmh * 0.03;
      _v1.set(pose.x - Math.sin(a) * d, y + 1.3 + 0.4 * Math.sin(state.T * 0.2), pose.z - Math.cos(a) * d);
      if (effDt > 0) cam.position.lerp(_v1, 1 - Math.exp(-3.5 * effDt));
      else cam.position.copy(_v1);
      cam.lookAt(pose.x - Math.sin(pose.yaw) * 3, y + 0.7, pose.z - Math.cos(pose.yaw) * 3);
      fov = 40;
    }
  }

  if (Math.abs(cam.fov - fov) > 0.04) {
    const fovBlend = effDt > 0 ? 1 - Math.exp(-6 * effDt) : 1;
    cam.fov = lp(cam.fov, fov, fovBlend);
    cam.updateProjectionMatrix();
  }
}
