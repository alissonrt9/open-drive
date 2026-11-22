import * as THREE from 'three';
import { $, cl, wrap, biome, TOD, BIOMES, set, state, P } from './config.js';
import {
  R,
  cam,
  cx,
  ry,
  sdir,
  getGroundY,
  rows,
  IM,
  applyEnv,
  updateSkyPos,
  updateCSM,
  renderWorld,
  setBiome,
  getPipelineDebug,
  setPipelineDebug,
  setToneMappingMode
} from './world.js';
import { placeCar, co } from './vehicles.js';

const WX_NAMES = ['Limpo', 'Neblina', 'Nublado', 'Chuva'];
const QUAL_NAMES = ['Baixa', 'Média', 'Alta'];

const QA_TARGETS = {
  lumMin: 0.22,
  lumMax: 0.45,
  p5Min: 0.03,
  contrastMin: 6.0,
  contrastMax: 25.0,
  blackMaxPct: 1.0,
  clippedMaxPct: 2.0,
  maxCalls: 1200,
  maxTriangles: 1500000
};

const BISECT_STAGES = [
  ['fog', 'Fog'],
  ['heightFog', 'Altura'],
  ['fogScatter', 'Mie'],
  ['gtao', 'GTAO'],
  ['bloom', 'Bloom'],
  ['grade', 'Grade'],
  ['smaa', 'SMAA'],
  ['csm', 'CSM'],
  ['envMap', 'PMREM']
];

const TM_MODES = [
  ['aces', 'ACES'],
  ['agx', 'AgX'],
  ['neutral', 'Neutral'],
  ['linear', 'Linear']
];

const qaActive = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('qa') === '1';

let debugEl = null;
let debugStatsEl = null;
let debugSummaryEl = null;
let debugBuilt = false;
const stageBtns = new Map();
const tmBtns = new Map();
let debugOpen = qaActive;
let fpsEma = 60;
let domTimer = 0;

const _bufSize = new THREE.Vector2();
const _targetVec = new THREE.Vector3();
let _pixelBuf = null;
let _lumSamples = null;
let _pngCanvas = null;
let _pngCtx = null;

function syncDebugButtons() {
  if (!debugBuilt) return;
  const st = getPipelineDebug();
  stageBtns.forEach((btn, key) => {
    btn.classList.toggle('on', !!st[key]);
  });
  tmBtns.forEach((btn, mode) => {
    btn.classList.toggle('on', st.toneMapping === mode);
  });
}

function setSummaryText(text) {
  if (debugSummaryEl) debugSummaryEl.textContent = text;
}

function ensureDebugDOM() {
  if (!debugEl) debugEl = $('#qaDebug');
  if (!debugEl || debugBuilt) return;
  debugBuilt = true;
  debugEl.replaceChildren();

  debugStatsEl = document.createElement('div');
  debugStatsEl.className = 'qa-stats';

  const stageLabel = document.createElement('div');
  stageLabel.className = 'qa-sec';
  stageLabel.textContent = 'BISSEÇÃO DE PIPELINE';

  const stageGrid = document.createElement('div');
  stageGrid.className = 'qa-grid';
  BISECT_STAGES.forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qa-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const cur = getPipelineDebug()[key];
      setPipelineDebug({ [key]: !cur });
      syncDebugButtons();
      btn.blur();
    });
    stageBtns.set(key, btn);
    stageGrid.appendChild(btn);
  });

  const tmLabel = document.createElement('div');
  tmLabel.className = 'qa-sec';
  tmLabel.textContent = 'TONE MAPPING';

  const tmRow = document.createElement('div');
  tmRow.className = 'qa-grid qa-tm';
  TM_MODES.forEach(([mode, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qa-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      setToneMappingMode(mode);
      syncDebugButtons();
      btn.blur();
    });
    tmBtns.set(mode, btn);
    tmRow.appendChild(btn);
  });

  const actRow = document.createElement('div');
  actRow.className = 'qa-actions';

  const snapBtn = document.createElement('button');
  snapBtn.type = 'button';
  snapBtn.className = 'qa-btn qa-act';
  snapBtn.textContent = 'Medir';
  snapBtn.addEventListener('click', () => {
    const res = snapshot('car_front_34');
    const m = res.metrics;
    setSummaryText(
      `Lum:${m.meanLuminance.toFixed(2)} p95/p5:${m.contrastRatio} Blk:${m.blackPct}% Clip:${m.clippedPct}% ${res.pass ? 'OK' : 'FAIL'}`
    );
    snapBtn.blur();
  });

  const bisectBtn = document.createElement('button');
  bisectBtn.type = 'button';
  bisectBtn.className = 'qa-btn qa-act';
  bisectBtn.textContent = 'Bissecar';
  bisectBtn.addEventListener('click', () => {
    const res = bisect('car_front_34');
    const top = res.ranking[0];
    setSummaryText(
      top
        ? `Top ΔLum: ${top.stage} (${top.deltaLum >= 0 ? '+' : ''}${top.deltaLum.toFixed(3)}) | ΔCtr: ${top.deltaContrast >= 0 ? '+' : ''}${top.deltaContrast.toFixed(2)}`
        : 'Bisseção concluída'
    );
    bisectBtn.blur();
  });

  const tmCmpBtn = document.createElement('button');
  tmCmpBtn.type = 'button';
  tmCmpBtn.className = 'qa-btn qa-act';
  tmCmpBtn.textContent = 'Comparar TM';
  tmCmpBtn.addEventListener('click', () => {
    const cmp = compareToneMapping('car_front_34');
    setSummaryText(
      cmp.map(r => `${r.mode.toUpperCase()}:${r.contrastRatio}x`).join(' ')
    );
    tmCmpBtn.blur();
  });

  actRow.append(snapBtn, bisectBtn, tmCmpBtn);

  debugSummaryEl = document.createElement('div');
  debugSummaryEl.className = 'qa-summary';
  debugSummaryEl.textContent = 'Clique nos módulos para isolar lavagem/exposição';

  debugEl.append(debugStatsEl, stageLabel, stageGrid, tmLabel, tmRow, actRow, debugSummaryEl);
  syncDebugButtons();
}

function setDebugVisibility(open) {
  debugOpen = !!open;
  if (!debugEl) debugEl = $('#qaDebug');
  if (debugOpen) ensureDebugDOM();
  if (debugEl) {
    debugEl.classList.toggle('on', debugOpen);
    debugEl.setAttribute('aria-hidden', debugOpen ? 'false' : 'true');
  }
}

export function toggleDebug(force) {
  const next = typeof force === 'boolean' ? force : !debugOpen;
  setDebugVisibility(next);
  if (next) updateDebugOverlay(0.016, true);
}

export function updateDebugOverlay(dt = 0.016, forceDom = false) {
  if (dt > 0.0005) {
    const instFps = 1 / dt;
    fpsEma = fpsEma * 0.9 + instFps * 0.1;
  }
  if (!debugOpen) return;
  ensureDebugDOM();
  if (!debugStatsEl) return;

  domTimer += dt;
  if (!forceDom && domTimer < 0.14) return;
  domTimer = 0;

  const info = R.info;
  const bm = biome();
  const todName = (TOD[set.tod] && TOD[set.tod][0]) || String(set.tod);
  const wxName = WX_NAMES[set.wx] || String(set.wx);
  const qName = QUAL_NAMES[set.q] || String(set.q);
  const ms = (1000 / Math.max(1, fpsEma)).toFixed(1);
  const st = getPipelineDebug();

  debugStatsEl.textContent = [
    `OPEN DRIVE · QA [F3]`,
    `FPS: ${Math.round(fpsEma)} (${ms} ms) | TM: ${st.toneMapping.toUpperCase()}`,
    `Draws: ${info.render.calls} | Tris: ${info.render.triangles.toLocaleString('pt-BR')}`,
    `Geom: ${info.memory.geometries} | Tex: ${info.memory.textures}`,
    `Bioma: ${bm.name}`,
    `Clima: ${todName} · ${wxName}`,
    `Qualidade: ${qName} | Exp: ${R.toneMappingExposure.toFixed(2)}`
  ].join('\n');
  syncDebugButtons();
}

function measureFramebuffer(capturePng = false) {
  R.getDrawingBufferSize(_bufSize);
  const w = Math.max(1, _bufSize.x | 0);
  const h = Math.max(1, _bufSize.y | 0);
  const totalPixels = w * h;
  const needed = totalPixels * 4;

  if (!_pixelBuf || _pixelBuf.length !== needed) {
    _pixelBuf = new Uint8Array(needed);
  }

  const gl = R.getContext();
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, _pixelBuf);

  const stride = Math.max(1, Math.floor(totalPixels / 65536));
  const sampleCount = Math.ceil(totalPixels / stride);
  if (!_lumSamples || _lumSamples.length !== sampleCount) {
    _lumSamples = new Float32Array(sampleCount);
  }

  let sumLum = 0;
  let blackCount = 0;
  let clippedCount = 0;
  let sIdx = 0;

  for (let p = 0; p < totalPixels && sIdx < sampleCount; p += stride) {
    const i = p * 4;
    const r = _pixelBuf[i] / 255;
    const g = _pixelBuf[i + 1] / 255;
    const b = _pixelBuf[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    _lumSamples[sIdx++] = lum;
    sumLum += lum;
    if (lum < 0.02) blackCount++;
    if (lum > 0.98) clippedCount++;
  }

  const used = sIdx;
  const sorted = _lumSamples.subarray(0, used).sort();
  const p5 = sorted[Math.min(used - 1, Math.floor(used * 0.05))];
  const p50 = sorted[Math.min(used - 1, Math.floor(used * 0.50))];
  const p95 = sorted[Math.min(used - 1, Math.floor(used * 0.95))];
  const meanLuminance = sumLum / Math.max(1, used);
  const contrastRatio = p95 / Math.max(p5, 1e-4);
  const blackPct = (blackCount / Math.max(1, used)) * 100;
  const clippedPct = (clippedCount / Math.max(1, used)) * 100;

  let dataUrl = null;
  if (capturePng) {
    if (!_pngCanvas) {
      _pngCanvas = document.createElement('canvas');
      _pngCtx = _pngCanvas.getContext('2d');
    }
    _pngCanvas.width = w;
    _pngCanvas.height = h;
    const imgData = _pngCtx.createImageData(w, h);
    const dst = imgData.data;
    const rowBytes = w * 4;
    for (let row = 0; row < h; row++) {
      const srcOff = (h - 1 - row) * rowBytes;
      const dstOff = row * rowBytes;
      dst.set(_pixelBuf.subarray(srcOff, srcOff + rowBytes), dstOff);
    }
    _pngCtx.putImageData(imgData, 0, 0);
    dataUrl = _pngCanvas.toDataURL('image/png');
  }

  return {
    resolution: `${w}x${h}`,
    meanLuminance: Number(meanLuminance.toFixed(4)),
    p5: Number(p5.toFixed(4)),
    p50: Number(p50.toFixed(4)),
    p95: Number(p95.toFixed(4)),
    contrastRatio: Number(contrastRatio.toFixed(2)),
    blackPct: Number(blackPct.toFixed(2)),
    clippedPct: Number(clippedPct.toFixed(2)),
    dataUrl
  };
}

function evaluateTargets(metrics, info, isNight = false) {
  const lumOk = isNight
    ? metrics.meanLuminance >= 0.04 && metrics.meanLuminance <= 0.32
    : metrics.meanLuminance >= QA_TARGETS.lumMin && metrics.meanLuminance <= QA_TARGETS.lumMax;
  const p5Ok = isNight ? true : metrics.p5 >= QA_TARGETS.p5Min;
  const contrastOk = isNight
    ? metrics.contrastRatio >= QA_TARGETS.contrastMin
    : metrics.contrastRatio >= QA_TARGETS.contrastMin && metrics.contrastRatio <= QA_TARGETS.contrastMax;
  const blackOk = isNight ? true : metrics.blackPct < QA_TARGETS.blackMaxPct;
  const clippedOk = metrics.clippedPct < QA_TARGETS.clippedMaxPct;
  const budgetOk = info.calls < QA_TARGETS.maxCalls && info.triangles < QA_TARGETS.maxTriangles;

  return {
    pass: lumOk && p5Ok && contrastOk && blackOk && clippedOk && budgetOk,
    checks: { lumOk, p5Ok, contrastOk, blackOk, clippedOk, budgetOk }
  };
}

function saveQASnapshotState() {
  return {
    biome: set.biome,
    tod: set.tod,
    wx: set.wx,
    q: set.q,
    mode: state.mode,
    camMode: state.camMode,
    x: P.x,
    z: P.z,
    yaw: P.yaw,
    prevX: P.prevX,
    prevZ: P.prevZ,
    prevYaw: P.prevYaw,
    vx: P.vx,
    vz: P.vz,
    spd: P.spd,
    yr: P.yr,
    steer: P.steer,
    brk: P.brk,
    pit: P.pit,
    rol: P.rol,
    cy: P.cy,
    camPos: cam.position.clone(),
    camQuat: cam.quaternion.clone(),
    camFov: cam.fov
  };
}

function restoreQASnapshotState(saved) {
  const biomeChanged = set.biome !== saved.biome;
  set.tod = saved.tod;
  set.wx = saved.wx;
  set.q = saved.q;
  state.mode = saved.mode;
  state.camMode = saved.camMode;

  P.x = saved.x;
  P.z = saved.z;
  P.yaw = saved.yaw;
  P.prevX = saved.prevX;
  P.prevZ = saved.prevZ;
  P.prevYaw = saved.prevYaw;
  P.vx = saved.vx;
  P.vz = saved.vz;
  P.spd = saved.spd;
  P.yr = saved.yr;
  P.steer = saved.steer;
  P.brk = saved.brk;
  P.pit = saved.pit;
  P.rol = saved.rol;
  P.cy = saved.cy;

  if (biomeChanged) {
    setBiome(saved.biome);
  }
  applyEnv(true);
  rows(P.z);
  IM.forEach(m => { m.reset(); m.upd(P.z); });
  placeCar(0, saved.mode !== 'drive');

  cam.position.copy(saved.camPos);
  cam.quaternion.copy(saved.camQuat);
  cam.fov = saved.camFov;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  updateSkyPos(cam.position, state.T);
  updateCSM();
}

export function snapshot(presetName = 'car_front_34') {
  const saved = saveQASnapshotState();
  try {
    const z0 = P.z;
    const roadYaw = Math.atan2(cx(z0) - cx(z0 - 2), 2);
    state.mode = 'drive';
    state.camMode = 0;
    P.x = cx(z0) + 1.9;
    P.z = z0;
    P.yaw = roadYaw;
    P.prevX = P.x;
    P.prevZ = P.z;
    P.prevYaw = P.yaw;
    P.steer = 0;
    P.pit = 0;
    P.rol = 0;
    P.brk = 0;

    if (presetName === 'city_panorama') {
      if (set.biome !== 2) setBiome(2);
      set.tod = 2;
      set.wx = 0;
    } else {
      if (set.tod === 5) set.tod = 2;
      if (set.wx !== 0) set.wx = 0;
    }

    const groundY = getGroundY(P.x, P.z);
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);

    if (presetName === 'car_rear_motion') {
      P.spd = 42;
      P.vx = fx * 42;
      P.vz = fz * 42;
      cam.position.set(P.x - fx * 6.0 + rx * 0.25, groundY + 1.92, P.z - fz * 6.0 + rz * 0.25);
      _targetVec.set(P.x + fx * 6.0, groundY + 0.92, P.z + fz * 6.0);
      cam.fov = 56;
    } else if (presetName === 'road_closeup') {
      P.spd = 18;
      P.vx = fx * 18;
      P.vz = fz * 18;
      cam.position.set(P.x - rx * 1.4 - fx * 4.5, groundY + 0.92, P.z - rz * 1.4 - fz * 4.5);
      _targetVec.set(cx(z0 - 28), ry(z0 - 28) + 0.18, z0 - 28);
      cam.fov = 46;
    } else if (presetName === 'city_panorama') {
      P.spd = 22;
      P.vx = fx * 22;
      P.vz = fz * 22;
      cam.position.set(cx(z0) + 32, groundY + 24, z0 + 48);
      _targetVec.set(cx(z0 - 130), ry(z0 - 130) + 14, z0 - 130);
      cam.fov = 52;
    } else if (presetName === 'sky') {
      P.spd = 18;
      P.vx = fx * 18;
      P.vz = fz * 18;
      cam.position.set(P.x, groundY + 2.2, P.z);
      _targetVec.set(
        P.x + sdir.x * 120,
        groundY + 2.2 + Math.max(0.45, sdir.y) * 95,
        P.z + sdir.z * 120
      );
      cam.fov = 58;
    } else {
      // 'car_front_34' (padrão)
      P.spd = 0;
      P.vx = 0;
      P.vz = 0;
      cam.position.set(P.x + fx * 4.1 + rx * 2.55, groundY + 1.38, P.z + fz * 4.1 + rz * 2.55);
      _targetVec.set(P.x, groundY + 0.68, P.z);
      cam.fov = 38;
    }

    cam.updateProjectionMatrix();
    cam.lookAt(_targetVec);
    cam.updateMatrixWorld(true);

    applyEnv(true);
    rows(P.z);
    IM.forEach(m => { m.reset(); m.upd(P.z); });
    placeCar(0, false);
    const activeCar = co();
    if (activeCar && activeCar.root) activeCar.root.updateMatrixWorld(true);
    updateSkyPos(cam.position, state.T);
    updateCSM();

    R.info.reset();
    renderWorld(state.T, Math.abs(P.spd) * 3.6, 0, set.wx == 3, 0);

    const metrics = measureFramebuffer(true);
    const info = {
      calls: R.info.render.calls,
      triangles: R.info.render.triangles,
      geometries: R.info.memory.geometries,
      textures: R.info.memory.textures
    };
    const evalRes = evaluateTargets(metrics, info, set.tod === 5);

    return {
      preset: presetName,
      biome: biome().name,
      tod: (TOD[set.tod] && TOD[set.tod][0]) || set.tod,
      wx: WX_NAMES[set.wx],
      quality: QUAL_NAMES[set.q],
      exposure: Number(R.toneMappingExposure.toFixed(3)),
      info,
      metrics,
      pass: evalRes.pass,
      checks: evalRes.checks
    };
  } finally {
    restoreQASnapshotState(saved);
  }
}

export function cycle() {
  const saved = saveQASnapshotState();
  const results = [];

  try {
    const z0 = P.z;
    const roadYaw = Math.atan2(cx(z0) - cx(z0 - 2), 2);
    state.mode = 'drive';
    state.camMode = 0;
    P.x = cx(z0) + 1.9;
    P.z = z0;
    P.yaw = roadYaw;
    P.prevX = P.x;
    P.prevZ = P.z;
    P.prevYaw = P.yaw;
    P.spd = 24;
    P.vx = -Math.sin(P.yaw) * 24;
    P.vz = -Math.cos(P.yaw) * 24;
    P.steer = 0;
    P.pit = 0;
    P.rol = 0;
    P.brk = 0;

    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);

    for (let b = 0; b < BIOMES.length; b++) {
      setBiome(b);
      rows(P.z);
      IM.forEach(m => { m.reset(); m.upd(P.z); });
      placeCar(0, false);

      const groundY = getGroundY(P.x, P.z);
      cam.position.set(P.x - fx * 6.4, groundY + 2.05, P.z - fz * 6.4);
      cam.fov = 50;
      cam.updateProjectionMatrix();
      cam.lookAt(P.x + fx * 12, groundY + 1.0, P.z + fz * 12);
      cam.updateMatrixWorld(true);

      for (let tod = 0; tod < TOD.length; tod++) {
        for (let wx = 0; wx < WX_NAMES.length; wx++) {
          set.tod = tod;
          set.wx = wx;
          applyEnv(true);
          updateSkyPos(cam.position, state.T);
          updateCSM();

          R.info.reset();
          renderWorld(state.T, 86, 0, wx === 3, 0);

          const metrics = measureFramebuffer(false);
          const info = {
            calls: R.info.render.calls,
            triangles: R.info.render.triangles
          };
          const isNight = tod === 5;
          const evalRes = evaluateTargets(metrics, info, isNight);

          results.push({
            biome: BIOMES[b].name,
            tod: TOD[tod][0],
            wx: WX_NAMES[wx],
            isNight,
            calls: info.calls,
            triangles: info.triangles,
            meanLuminance: metrics.meanLuminance,
            p5: metrics.p5,
            p95: metrics.p95,
            contrastRatio: metrics.contrastRatio,
            blackPct: metrics.blackPct,
            clippedPct: metrics.clippedPct,
            pass: evalRes.pass,
            checks: evalRes.checks
          });
        }
      }
    }

    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const dayResults = results.filter(r => !r.isNight);
    const dayPassed = dayResults.filter(r => r.pass).length;
    const maxCalls = results.reduce((acc, r) => Math.max(acc, r.calls), 0);
    const maxTriangles = results.reduce((acc, r) => Math.max(acc, r.triangles), 0);
    const failedCombos = results.filter(r => !r.pass);

    return {
      total,
      passed,
      failed: total - passed,
      dayTotal: dayResults.length,
      dayPassed,
      quality: QUAL_NAMES[set.q],
      maxCalls,
      maxTriangles,
      failedCombos,
      results
    };
  } finally {
    restoreQASnapshotState(saved);
  }
}

export function bisect(presetName = 'car_front_34') {
  const savedPipeline = getPipelineDebug();
  try {
    const baseline = snapshot(presetName);
    const ranking = [];

    for (const [stage, label] of BISECT_STAGES) {
      setPipelineDebug({ ...savedPipeline, [stage]: false });
      const res = snapshot(presetName);
      const deltaLum = Number((baseline.metrics.meanLuminance - res.metrics.meanLuminance).toFixed(4));
      const deltaContrast = Number((res.metrics.contrastRatio - baseline.metrics.contrastRatio).toFixed(2));
      const deltaClip = Number((baseline.metrics.clippedPct - res.metrics.clippedPct).toFixed(2));
      ranking.push({
        stage,
        label,
        meanLuminanceOff: res.metrics.meanLuminance,
        contrastOff: res.metrics.contrastRatio,
        deltaLum,
        deltaContrast,
        deltaClip
      });
    }

    ranking.sort((a, b) => Math.abs(b.deltaLum) - Math.abs(a.deltaLum));
    return {
      preset: presetName,
      baseline: baseline.metrics,
      baselinePass: baseline.pass,
      ranking
    };
  } finally {
    setPipelineDebug(savedPipeline);
    syncDebugButtons();
  }
}

export function compareToneMapping(presetName = 'car_front_34') {
  const savedPipeline = getPipelineDebug();
  const out = [];
  try {
    for (const [mode] of TM_MODES) {
      setToneMappingMode(mode);
      const res = snapshot(presetName);
      out.push({
        mode,
        exposure: res.exposure,
        meanLuminance: res.metrics.meanLuminance,
        p5: res.metrics.p5,
        p95: res.metrics.p95,
        contrastRatio: res.metrics.contrastRatio,
        blackPct: res.metrics.blackPct,
        clippedPct: res.metrics.clippedPct,
        pass: res.pass
      });
    }
    return out;
  } finally {
    setPipelineDebug(savedPipeline);
    syncDebugButtons();
  }
}

export function initQA() {
  setDebugVisibility(qaActive);
  if (typeof window !== 'undefined') {
    window.__qa = {
      active: qaActive,
      targets: { ...QA_TARGETS },
      snapshot,
      cycle,
      bisect,
      compareToneMapping,
      getStage: getPipelineDebug,
      setStage: patch => {
        const res = setPipelineDebug(patch);
        syncDebugButtons();
        return res;
      },
      setToneMapping: mode => {
        const res = setToneMappingMode(mode);
        syncDebugButtons();
        return res;
      },
      toggleDebug
    };
  }
  if (debugOpen) {
    updateDebugOverlay(0.016, true);
  }
}
