/* global THREE */

export const $ = s => document.querySelector(s);

// ---------- constantes e utilitários matemáticos
export const TAU = Math.PI * 2;
export const cl = (v, a, b) => Math.max(a, Math.min(b, v));
export const lp = (a, b, t) => a + (b - a) * t;
export const sm = (a, b, v) => cl((v - a) / (b - a), 0, 1) ** 2 * (3 - 2 * cl((v - a) / (b - a), 0, 1));
export const rnd = (i, k, s) => {
  const x = Math.sin(i * 127.1 + k * 311.7 + s * 74.7) * 43758.5;
  return x - Math.floor(x);
};
export const wrap = a => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};

// ---------- presets de carroceria e catálogo completo dos 7 veículos reais
export const TY = [
  { rb: -0.2, rf: 0.03, wb: 0.18, hd: 0.52 },
  { rb: -0.16, rf: 0, wb: 0.2, hd: 0.48 },
  { rb: -0.02, rf: 0.12, wb: 0.27, hd: 0.38 }
];

export const CARS = [
  { n: 'M3 Competition', b: 'BMW', c: 'Sedã esportivo · G80', modelUrl: 'assets/cars/bmw-m3-g80.glb', hp: 510, tq: 650, top: 250, a: 3.9, kg: 1730, dr: 'RWD', col: 0x164a8a, L: 4.8, W: 1.9, H: 1.43, t: 0, cyl: 6, tb: 1, rev: 7200, tr: 0.58, gr: 1 },
  { n: 'GT-R R35', b: 'Nissan', c: 'Coupé esportivo', modelUrl: 'assets/cars/nissan-gtr-r35.glb', hp: 565, tq: 633, top: 315, a: 3, kg: 1752, dr: 'AWD', col: 0x8e96a0, L: 4.7, W: 1.89, H: 1.37, t: 1, cyl: 6, tb: 1, rev: 7100, tr: 0.95, gr: 1.05 },
  { n: '911 Carrera S', b: 'Porsche', c: 'Esportivo · 992', modelUrl: 'assets/cars/porsche-911-992.glb', hp: 450, tq: 530, top: 308, a: 3.5, kg: 1540, dr: 'RWD', col: 0xb6b8b2, L: 4.52, W: 1.85, H: 1.3, t: 1, cyl: 6, tb: 1, rev: 7600, tr: 0.64, gr: 1.12 },
  { n: 'Huracán EVO', b: 'Lamborghini', c: 'Supercarro', modelUrl: 'assets/cars/lamborghini-huracan.glb', hp: 640, tq: 600, top: 325, a: 2.9, kg: 1422, dr: 'AWD', col: 0xdfa800, L: 4.52, W: 1.93, H: 1.16, t: 2, cyl: 10, tb: 0, rev: 8500, tr: 0.95, gr: 1.1 },
  { n: '488 GTB', b: 'Ferrari', c: 'Supercarro', modelUrl: 'assets/cars/ferrari-488-gtb.glb', hp: 670, tq: 760, top: 330, a: 3, kg: 1475, dr: 'RWD', col: 0xb81414, L: 4.57, W: 1.95, H: 1.21, t: 2, cyl: 8, tb: 1, rev: 8000, tr: 0.64, gr: 1.1 },
  { n: 'GR Supra', b: 'Toyota', c: 'Coupé esportivo · A90', modelUrl: 'assets/cars/toyota-supra-a90.glb', hp: 382, tq: 500, top: 250, a: 4.1, kg: 1540, dr: 'RWD', col: 0xd0d4da, L: 4.38, W: 1.87, H: 1.29, t: 1, cyl: 6, tb: 1, rev: 7000, tr: 0.58, gr: 1 },
  { n: 'Mustang GT', b: 'Ford', c: 'Muscle car', modelUrl: 'assets/cars/ford-mustang-gt.glb', hp: 460, tq: 569, top: 250, a: 4.3, kg: 1700, dr: 'RWD', col: 0x162b4d, L: 4.8, W: 1.92, H: 1.38, t: 0, cyl: 8, tb: 0, rev: 7000, tr: 0.58, gr: 0.98 }
];

// ---------- 5 mapas / biomas completos e selecionáveis
export const BIOMES = [
  {
    id: 'alpine',
    name: 'Vale Alpino',
    short: 'VALE ALPINO',
    desc: 'Colinas verde-esmeralda, pinheiros e céu sereno',
    gripMul: 1.0,
    skyTop: 0x4a7ab5,
    skyHor: 0x9ec0e0,
    groundCol: 0x26381b,
    fogDensity: 0.00034,
    particle: 'none',
    accent: '#63b87b'
  },
  {
    id: 'desert',
    name: 'Deserto Dourado',
    short: 'DESERTO DOURADO',
    desc: 'Dunas onduladas, cânions terracota e cactos saguaro',
    gripMul: 0.96,
    skyTop: 0x4b77ad,
    skyHor: 0xdcb88e,
    groundCol: 0x6b4326,
    fogDensity: 0.00040,
    particle: 'dust',
    accent: '#e0914c'
  },
  {
    id: 'city',
    name: 'Metrópole Costeira',
    short: 'CIDADE / METRÓPOLE',
    desc: 'Via expressa urbana, arranha-céus e postes a cada 35m',
    gripMul: 1.03,
    skyTop: 0x456f9e,
    skyHor: 0x9db4cc,
    groundCol: 0x1e252e,
    fogDensity: 0.00038,
    particle: 'none',
    accent: '#5caeff'
  },
  {
    id: 'sakura',
    name: 'Santuário Sakura',
    short: 'SANTUÁRIO SAKURA',
    desc: 'Cerejeiras em flor, portais Torii e Monte Fuji',
    gripMul: 1.0,
    skyTop: 0x4d7cb2,
    skyHor: 0xbcd0e4,
    groundCol: 0x2e3b27,
    fogDensity: 0.00032,
    particle: 'sakura',
    accent: '#ee8fab'
  },
  {
    id: 'snow',
    name: 'Montanhas Nevadas',
    short: 'MONTANHAS NEVADAS',
    desc: 'Passo alpino invernal com neve macia e flocos no ar',
    gripMul: 0.88,
    skyTop: 0x476f9c,
    skyHor: 0xb4c7da,
    groundCol: 0x627080,
    fogDensity: 0.00044,
    particle: 'snow',
    accent: '#8cbde8'
  }
];

// ---------- presets de horário e atmosfera (tons harmônicos sem ofuscamento branco)
export const TOD = [
  ['Manhã', 0x4674ab, 0xc9b9a6, 0.30, 0.55, 0xffdfb8, 2.15, 0.56],
  ['Meio-dia', 0x4a7ab5, 0x9ec0e0, 1.12, 0.92, 0xfff5e6, 2.35, 0.60],
  ['Fim de tarde', 0x3f679c, 0xd8b28d, 0.48, 1.92, 0xffd096, 2.15, 0.54],
  ['Golden hour', 0x3b598a, 0xdda16a, 0.22, 2.22, 0xffa654, 2.05, 0.48],
  ['Pôr do sol', 0x25325e, 0xd98a5f, 0.09, 2.62, 0xff7847, 1.75, 0.42],
  ['Noite', 0x0b1220, 0x141d2e, 0.48, 3.8, 0x89a6ff, 0.58, 0.24]
];

// ---------- presets rápidos de dirigibilidade & regulador de tuning
export const TUNING_PRESETS = {
  arcade: {
    id: 'arcade',
    name: 'ARCADE / FÁCIL',
    short: 'ARCADE',
    steerSens: 105,
    esc: 100,
    tcs: 100,
    grip: 118,
    brakeForce: 115,
    suspStiff: 55,
    gearRatio: 45
  },
  forza: {
    id: 'forza',
    name: 'FORZA / EQUILIBRADO',
    short: 'FORZA',
    steerSens: 100,
    esc: 70,
    tcs: 55,
    grip: 100,
    brakeForce: 100,
    suspStiff: 55,
    gearRatio: 50
  },
  sim: {
    id: 'sim',
    name: 'SIMULAÇÃO / PRO',
    short: 'SIMULAÇÃO',
    steerSens: 100,
    esc: 0,
    tcs: 0,
    grip: 92,
    brakeForce: 95,
    suspStiff: 72,
    gearRatio: 50
  }
};

export const tuning = {
  preset: 'forza',
  steerSens: 100,
  esc: 70,
  tcs: 55,
  grip: 100,
  brakeForce: 100,
  suspStiff: 55,
  gearRatio: 50
};

const STORAGE_TUNING_KEY = 'opendrive_tuning_v1';
const STORAGE_BIOME_KEY = 'opendrive_biome_v1';

export function saveTuning() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_TUNING_KEY, JSON.stringify(tuning));
    }
  } catch {
    // ambiente sem storage persistente
  }
}

export function loadTuning() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_TUNING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        tuning.preset = parsed.preset || 'custom';
        tuning.steerSens = cl(Number(parsed.steerSens ?? 100), 50, 150);
        tuning.esc = cl(Number(parsed.esc ?? 70), 0, 100);
        tuning.tcs = cl(Number(parsed.tcs ?? 55), 0, 100);
        tuning.grip = cl(Number(parsed.grip ?? 100), 70, 130);
        tuning.brakeForce = cl(Number(parsed.brakeForce ?? 100), 70, 130);
        tuning.suspStiff = cl(Number(parsed.suspStiff ?? 55), 0, 100);
        tuning.gearRatio = cl(Number(parsed.gearRatio ?? 50), 0, 100);
      }
    }
    const savedBiome = localStorage.getItem(STORAGE_BIOME_KEY);
    if (savedBiome !== null) {
      const bIdx = Number(savedBiome);
      if (Number.isInteger(bIdx) && bIdx >= 0 && bIdx < BIOMES.length) {
        set.biome = bIdx;
      }
    }
  } catch {
    // ambiente sem storage persistente
  }
}

export function saveBiomeChoice() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_BIOME_KEY, String(set.biome));
    }
  } catch {
    // ambiente sem storage persistente
  }
}

export function applyTuningPreset(presetId) {
  const p = TUNING_PRESETS[presetId];
  if (!p) return;
  tuning.preset = p.id;
  tuning.steerSens = p.steerSens;
  tuning.esc = p.esc;
  tuning.tcs = p.tcs;
  tuning.grip = p.grip;
  tuning.brakeForce = p.brakeForce;
  tuning.suspStiff = p.suspStiff;
  tuning.gearRatio = p.gearRatio;
  set.as = p.esc >= 35 ? 1 : 0;
  saveTuning();
}

// ---------- configurações e estado global mutável
export const set = { q: 1, tod: 1, wx: 0, as: 1, tx: 0, vol: 2, hud: 1, biome: 0 };
export const VV = [0, 0.35, 0.7, 1];
loadTuning();
set.as = tuning.esc >= 35 ? 1 : 0;

export const state = {
  mode: 'menu',
  ci: 0,
  camMode: 0,
  tuningOpen: false,
  T: 0,
  Pth: 0,
  lastB: 1e9,
  revKick: 0,
  hitCD: 0,
  qT: 1,
  gpY: 0,
  gpS: 0,
  gpLB: 0,
  gpRB: 0,
  physAcc: 0,
  renderAlpha: 1
};

export const car = () => CARS[state.ci];
export const biome = () => BIOMES[set.biome] || BIOMES[0];

export const P = {
  x: 0,
  z: 0,
  yaw: 0,
  prevX: 0,
  prevZ: 0,
  prevYaw: 0,
  vx: 0,
  vz: 0,
  spd: 0,
  steer: 0,
  wFront: 0,
  wRear: 0,
  wAngF: 0,
  wAngR: 0,
  prevWAngF: 0,
  prevWAngR: 0,
  rpm: 900,
  gear: 1,
  yr: 0,
  pit: 0,
  rol: 0,
  ax: 0,
  dist: 0,
  t: 0,
  shift: 0,
  boost: 0,
  sq: 0,
  sh: 0,
  brk: 0,
  absActive: false,
  tcsActive: false,
  slipAngle: 0,
  limiterCut: false,
  limiterPhase: 0,
  offroad: false,
  surface: 'asphalt',
  drifting: false,
  tractionLoss: false,
  eng: '',
  cy: 0,
  cp: new THREE.Vector3()
};

export const IN = { g: 0, b: 0, s: 0, hb: 0 };
export const K = {};
