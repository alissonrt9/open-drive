import { $, TAU, cl, CARS, car, BIOMES, biome, TOD, TUNING_PRESETS, tuning, saveTuning, saveBiomeChoice, applyTuningPreset, set, state, P, IN } from './config.js';
import { R, cam, IM, rain, cx, applyEnv, resizeComposer, setBiome, setQualityPipeline } from './world.js';
import { CO, co, TR, placeCar, importVehicleFiles } from './vehicles.js';
import { aInit, eBuild, resumeAudio, setMasterVolume } from './audio.js';
import { startDrive } from './physics.js';
import { resetFx } from './fx.js';

let dropHintEl = null;
let dropTimer = 0;

export function showToast(msg, isError = false, duration = 2800) {
  if (!dropHintEl) {
    dropHintEl = $('#dropHint') || document.createElement('div');
    dropHintEl.id = 'dropHint';
    if (!dropHintEl.parentNode) document.body.appendChild(dropHintEl);
  }
  clearTimeout(dropTimer);
  dropHintEl.textContent = msg;
  dropHintEl.className = isError ? 'on err' : 'on';
  if (duration > 0) {
    dropTimer = setTimeout(() => {
      if (dropHintEl) dropHintEl.className = '';
    }, duration);
  }
}

export function hideToast() {
  if (dropHintEl) dropHintEl.className = '';
}

const fxCanvas = $('#fx');
const fx = fxCanvas.getContext('2d');
const mmCanvas = $('#minimap');
const mm = mmCanvas ? mmCanvas.getContext('2d') : null;
const tachoCanvas = $('#tachoCanvas');
const tc = tachoCanvas ? tachoCanvas.getContext('2d') : null;

// ---------- efeitos 2D em tela (vinheta e linhas de velocidade)
export function fxDraw() {
  const w = fxCanvas.width;
  const h = fxCanvas.height;
  fx.clearRect(0, 0, w, h);
  if (state.mode != 'drive') return;

  const s = cl((Math.hypot(P.vx, P.vz) * 3.6 - 130) / 150, 0, 1);
  if (s < 0.01) return;

  const gr = fx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${0.45 * s})`);
  fx.fillStyle = gr;
  fx.fillRect(0, 0, w, h);

  fx.strokeStyle = `rgba(255,255,255,${0.09 * s})`;
  fx.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * TAU;
    const r0 = h * (0.45 + Math.random() * 0.25);
    const r1 = r0 + h * (0.12 + 0.25 * s) * Math.random();
    fx.moveTo(w / 2 + Math.cos(a) * r0 * 1.3, h / 2 + Math.sin(a) * r0);
    fx.lineTo(w / 2 + Math.cos(a) * r1 * 1.3, h / 2 + Math.sin(a) * r1);
  }
  fx.stroke();
}

// ---------- minimapa limpo de simulação (rodovia principal, tráfego e Norte)
export function drawMinimap() {
  if (!mm) return;
  const w = mmCanvas.width;
  const h = mmCanvas.height;
  const cx0 = w * 0.5;
  const cy0 = h * 0.5;
  const radius = w * 0.5 - 3;
  const scale = 0.34;

  mm.clearRect(0, 0, w, h);

  const f0 = -Math.sin(P.yaw);
  const f1 = -Math.cos(P.yaw);
  const r0 = Math.cos(P.yaw);
  const r1 = -Math.sin(P.yaw);
  const toMap = (wx, wz) => {
    const dx = wx - P.x;
    const dz = wz - P.z;
    return [
      cx0 + (dx * r0 + dz * r1) * scale,
      cy0 - (dx * f0 + dz * f1) * scale
    ];
  };

  mm.save();
  mm.beginPath();
  mm.arc(cx0, cy0, radius, 0, TAU);
  mm.clip();

  mm.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  mm.lineWidth = 1;
  mm.beginPath();
  mm.arc(cx0, cy0, radius * 0.52, 0, TAU);
  mm.stroke();

  // Rodovia principal nítida (sem estrada de terra ou ícones arcade)
  const zStart = P.z - 320;
  const zEnd = P.z + 320;
  const zStep = 10;

  mm.lineCap = 'round';
  mm.lineJoin = 'round';
  mm.strokeStyle = '#141922';
  mm.lineWidth = 10;
  mm.beginPath();
  for (let z = zStart, first = true; z <= zEnd; z += zStep, first = false) {
    const [mx, my] = toMap(cx(z), z);
    if (first) mm.moveTo(mx, my);
    else mm.lineTo(mx, my);
  }
  mm.stroke();

  mm.strokeStyle = '#a6b0bd';
  mm.lineWidth = 6.2;
  mm.stroke();

  // Tráfego próximo
  mm.fillStyle = '#ffd166';
  for (const t of TR) {
    const [tx, ty] = toMap(cx(t.z) + t.l, t.z);
    if (Math.hypot(tx - cx0, ty - cy0) < radius - 6) {
      mm.beginPath();
      mm.arc(tx, ty, 2.5, 0, TAU);
      mm.fill();
    }
  }

  // Seta do jogador no centro apontando para frente
  mm.fillStyle = '#ff8a3d';
  mm.strokeStyle = '#ffffff';
  mm.lineWidth = 1.5;
  mm.beginPath();
  mm.moveTo(cx0, cy0 - 9);
  mm.lineTo(cx0 + 6.5, cy0 + 6.5);
  mm.lineTo(cx0, cy0 + 3);
  mm.lineTo(cx0 - 6.5, cy0 + 6.5);
  mm.closePath();
  mm.fill();
  mm.stroke();

  mm.restore();

  // Indicador Norte (N) na borda girando com o heading do carro
  const nx = -r1;
  const ny = f1;
  const nbx = cx0 + nx * (radius - 10);
  const nby = cy0 + ny * (radius - 10);
  mm.fillStyle = 'rgba(10, 14, 22, 0.92)';
  mm.beginPath();
  mm.arc(nbx, nby, 8.5, 0, TAU);
  mm.fill();
  mm.fillStyle = '#ff8a3d';
  mm.font = 'bold 10px sans-serif';
  mm.textAlign = 'center';
  mm.textBaseline = 'middle';
  mm.fillText('N', nbx, nby + 0.5);
}

// ---------- conta-giros estilo corrida (Câmbio Manual)
export function drawTachometer(c, gearLabel) {
  const hudEl = $('#hud');
  const isManual = set.tx == 1;
  if (hudEl) hudEl.classList.toggle('manual', isManual);

  const txEl = $('#txMode');
  if (txEl) {
    txEl.textContent = isManual ? 'MANUAL · [M]' : 'AUTO · [M]';
    txEl.classList.toggle('manual', isManual);
  }

  if (!isManual) return;

  const wrapEl = $('#tachoWrap');
  const gearEl = $('#tachoGear');
  const rpmEl = $('#tachoRpm');
  const maxGaugeRpm = Math.ceil((c.rev * 1.08) / 1000) * 1000;
  const rpmClamped = cl(P.rpm, 0, maxGaugeRpm);
  const rpmRatio = cl(P.rpm / c.rev, 0, 1.05);
  const onRedline = P.limiterCut || rpmRatio >= 0.94;

  if (wrapEl) wrapEl.classList.toggle('redline', onRedline);
  if (gearEl) gearEl.textContent = gearLabel;
  if (rpmEl) rpmEl.textContent = `${Math.round(P.rpm)} RPM`;

  // Shift lights sequenciais no topo do mostrador
  const lightsWrap = $('#shiftLights');
  if (lightsWrap) {
    const leds = lightsWrap.querySelectorAll('i');
    const blinkOff = P.limiterCut && Math.floor(state.T * 24) % 2 === 0;
    const activeCount = rpmRatio < 0.62 ? 0 : Math.min(8, Math.ceil(((rpmRatio - 0.62) / 0.34) * 8));
    leds.forEach((led, idx) => {
      const lit = !blinkOff && idx < activeCount;
      const tier = idx < 3 ? 'g' : idx < 6 ? 'a' : 'r';
      led.className = lit ? `on ${tier}` : '';
    });
  }

  if (!tc || !tachoCanvas) return;
  const w = tachoCanvas.width;
  const h = tachoCanvas.height;
  const cx0 = w * 0.5;
  const cy0 = h * 0.5;
  const radius = w * 0.42;
  const startAng = Math.PI * 0.78;
  const sweepAng = Math.PI * 1.44;
  const endAng = startAng + sweepAng;
  const redStartAng = startAng + sweepAng * (c.rev * 0.88 / maxGaugeRpm);
  const peakAng = startAng + sweepAng * (c.rev / maxGaugeRpm);
  const curAng = startAng + sweepAng * cl(rpmClamped / maxGaugeRpm, 0, 1);

  tc.clearRect(0, 0, w, h);
  tc.lineCap = 'round';

  // Trilho de fundo graduado
  tc.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  tc.lineWidth = 14;
  tc.beginPath();
  tc.arc(cx0, cy0, radius, startAng, endAng);
  tc.stroke();

  // Zona de alerta âmbar e redline carmesim
  tc.strokeStyle = 'rgba(255, 168, 44, 0.42)';
  tc.lineWidth = 14;
  tc.beginPath();
  tc.arc(cx0, cy0, radius, redStartAng, peakAng);
  tc.stroke();

  tc.strokeStyle = 'rgba(255, 59, 48, 0.82)';
  tc.lineWidth = 14;
  tc.beginPath();
  tc.arc(cx0, cy0, radius, peakAng, endAng);
  tc.stroke();

  // Arco iluminado progressivo do RPM atual
  if (curAng > startAng + 0.01) {
    const grad = tc.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0, '#44d6ff');
    grad.addColorStop(0.6, '#ff8a3d');
    grad.addColorStop(1, '#ff3b30');
    tc.strokeStyle = onRedline ? '#ff3b30' : grad;
    tc.lineWidth = 14;
    tc.beginPath();
    tc.arc(cx0, cy0, radius, startAng, curAng);
    tc.stroke();
  }

  // Marcações de 500 e 1000 RPM com números legíveis
  const steps = Math.round(maxGaugeRpm / 500);
  for (let i = 0; i <= steps; i++) {
    const valRpm = i * 500;
    const frac = valRpm / maxGaugeRpm;
    const ang = startAng + sweepAng * frac;
    const isMajor = i % 2 === 0;
    const isRed = valRpm >= c.rev * 0.9;
    const rOuter = radius - 10;
    const rInner = rOuter - (isMajor ? 18 : 9);

    tc.strokeStyle = isRed ? '#ff5247' : (isMajor ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)');
    tc.lineWidth = isMajor ? 3 : 1.6;
    tc.beginPath();
    tc.moveTo(cx0 + Math.cos(ang) * rInner, cy0 + Math.sin(ang) * rInner);
    tc.lineTo(cx0 + Math.cos(ang) * rOuter, cy0 + Math.sin(ang) * rOuter);
    tc.stroke();

    if (isMajor) {
      const rTxt = rInner - 20;
      tc.fillStyle = isRed ? '#ff6961' : '#e6ebf2';
      tc.font = 'bold 20px "Helvetica Neue", Inter, sans-serif';
      tc.textAlign = 'center';
      tc.textBaseline = 'middle';
      tc.fillText(String(valRpm / 1000), cx0 + Math.cos(ang) * rTxt, cy0 + Math.sin(ang) * rTxt);
    }
  }

  // Ponteiro de corrida iluminado + eixo central metálico
  tc.save();
  tc.strokeStyle = onRedline ? '#ff3b30' : '#ff8a3d';
  tc.lineWidth = 6;
  tc.shadowColor = onRedline ? 'rgba(255, 59, 48, 0.95)' : 'rgba(255, 138, 61, 0.85)';
  tc.shadowBlur = 14;
  tc.beginPath();
  tc.moveTo(cx0 - Math.cos(curAng) * 22, cy0 - Math.sin(curAng) * 22);
  tc.lineTo(cx0 + Math.cos(curAng) * (radius - 12), cy0 + Math.sin(curAng) * (radius - 12));
  tc.stroke();
  tc.restore();

  tc.fillStyle = '#181c26';
  tc.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  tc.lineWidth = 3;
  tc.beginPath();
  tc.arc(cx0, cy0, 16, 0, TAU);
  tc.fill();
  tc.stroke();
}

// ---------- HUD de telemetria limpa
export function hudUpd() {
  if (state.mode != 'drive' && state.mode != 'pause') return;
  const c = car();
  const gearLabel = set.tx == 1
    ? (P.spd < -0.8 ? 'R' : P.gear)
    : (P.spd < -0.8 ? 'R' : Math.abs(P.spd) < 0.5 && IN.g < 0.05 ? 'N' : P.gear);

  $('#spd').textContent = Math.round(Math.abs(P.spd) * 3.6);
  $('#gear').textContent = gearLabel;
  $('#rb i').style.width = cl((P.rpm - 900) / (c.rev - 900), 0, 1) * 100 + '%';

  const estEl = $('#est');
  const stateLabel = P.drifting
    ? 'DRIFT'
    : P.offroad
      ? 'OFF-ROAD'
      : P.tractionLoss
        ? 'TRAÇÃO'
        : P.eng;
  estEl.textContent = stateLabel;
  estEl.className = P.drifting
    ? 'drift'
    : P.offroad
      ? 'offroad'
      : P.tractionLoss
        ? 'traction'
        : (P.eng == 'CORTE DE GIRO' || P.eng == 'LIMITADOR' || P.limiterCut)
          ? 'limiter'
          : '';

  const surfEl = $('#surf');
  if (surfEl) {
    surfEl.textContent = P.surface == 'asphalt' ? 'RODOVIA PRINCIPAL' : 'OFF-ROAD LIVRE';
    surfEl.className = P.surface == 'asphalt' ? '' : 'offroad';
  }

  $('#sb i').style.left = 30 + P.steer / 0.5 * 30 + 'px';
  $('#hcar').textContent = c.b + ' ' + c.n;
  const m = Math.floor(P.t / 60);
  const s = Math.floor(P.t % 60);
  $('#htm').textContent = `${m}:${String(s).padStart(2, '0')} · ${(P.dist / 1000).toFixed(2)} km`;

  const bm = biome();
  const hbiomeEl = $('#hbiome');
  if (hbiomeEl) hbiomeEl.textContent = `${bm.short} · [B]`;

  const hprofEl = $('#hprofile');
  if (hprofEl) {
    const presetInfo = TUNING_PRESETS[tuning.preset];
    const presetLabel = presetInfo ? presetInfo.short : 'CUSTOM';
    const tcsLabel = tuning.tcs > 0 ? 'TCS ON' : 'TCS OFF';
    const absLabel = P.absActive ? ' · ABS' : '';
    hprofEl.textContent = `${presetLabel} · ${tcsLabel}${absLabel}`;
  }

  drawTachometer(c, gearLabel);
  drawMinimap();
}

// ---------- seletor dinâmico dos 5 mapas / biomas
export function renderBiomeSelectors() {
  const bm = biome();
  const menuWrap = $('#menuBiomes');
  if (menuWrap) {
    menuWrap.innerHTML = BIOMES.map(
      (b, idx) =>
        `<button type="button" class="biome-pill${set.biome === idx ? ' on' : ''}" data-biome="${idx}" style="--b-ac:${b.accent}">${b.name}</button>`
    ).join('');
  }
  const gBtn = $('#garageBiomeBtn');
  if (gBtn) gBtn.textContent = `MAPA: ${bm.short} [B]`;
  const pBtn = $('#pauseBiomeBtn');
  if (pBtn) pBtn.textContent = `MAPA: ${bm.short} [B]`;
}

export function selectBiome(idx, silent = false) {
  const nextIdx = ((Math.round(idx) % BIOMES.length) + BIOMES.length) % BIOMES.length;
  setBiome(nextIdx);
  saveBiomeChoice();
  renderBiomeSelectors();
  syncSettings();
  if (!silent) showToast(`Mapa: ${biome().name}`);
}

export function cycleBiome() {
  selectBiome((set.biome + 1) % BIOMES.length);
}

// ---------- regulador de dirigibilidade & tuning em tempo real (Tecla H)
const TUNING_SLIDERS = [
  { key: 'steerSens', label: 'Sensibilidade da Direção', min: 50, max: 150, step: 1, fmt: v => `${v}%` },
  { key: 'esc', label: 'Assistência de Estabilidade / ESC', min: 0, max: 100, step: 1, fmt: v => `${v}%` },
  { key: 'tcs', label: 'Controle de Tração / TCS', min: 0, max: 100, step: 1, fmt: v => `${v}%` },
  { key: 'grip', label: 'Aderência dos Pneus (Grip)', min: 70, max: 130, step: 1, fmt: v => `${v}%` },
  { key: 'brakeForce', label: 'Força de Frenagem (ABS)', min: 70, max: 130, step: 1, fmt: v => `${v}%` },
  {
    key: 'suspStiff',
    label: 'Rigidez da Suspensão',
    min: 0,
    max: 100,
    step: 1,
    fmt: v => (v < 35 ? `Macia (${v})` : v > 68 ? `Pista (${v})` : `Média (${v})`)
  },
  {
    key: 'gearRatio',
    label: 'Relação de Marchas',
    min: 0,
    max: 100,
    step: 1,
    fmt: v => (v < 35 ? `Curta (${v})` : v > 68 ? `Longa (${v})` : `Equilibrada (${v})`)
  }
];

export function syncTuningUI() {
  const presetsWrap = $('#tpPresets');
  if (presetsWrap) {
    presetsWrap.querySelectorAll('[data-preset]').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.preset === tuning.preset);
    });
  }
  const slidersWrap = $('#tpSliders');
  if (slidersWrap) {
    TUNING_SLIDERS.forEach(cfg => {
      const val = tuning[cfg.key];
      const inp = slidersWrap.querySelector(`input[data-tkey="${cfg.key}"]`);
      const out = slidersWrap.querySelector(`[data-tval="${cfg.key}"]`);
      if (inp) inp.value = String(val);
      if (out) out.textContent = cfg.fmt(val);
    });
  }
}

export function initTuningUI() {
  const slidersWrap = $('#tpSliders');
  if (slidersWrap) {
    slidersWrap.innerHTML = TUNING_SLIDERS.map(
      cfg => `
        <div class="tp-row">
          <div class="tp-row-head">
            <label for="tp_${cfg.key}">${cfg.label}</label>
            <span data-tval="${cfg.key}">${cfg.fmt(tuning[cfg.key])}</span>
          </div>
          <input id="tp_${cfg.key}" type="range" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${tuning[cfg.key]}" data-tkey="${cfg.key}" />
        </div>`
    ).join('');

    slidersWrap.addEventListener('input', e => {
      const inp = e.target;
      const key = inp && inp.dataset && inp.dataset.tkey;
      if (!key) return;
      const val = Number(inp.value);
      tuning[key] = val;
      tuning.preset = 'custom';
      if (key === 'esc') {
        set.as = val >= 35 ? 1 : 0;
        syncSettings();
      }
      saveTuning();
      syncTuningUI();
      hudUpd();
    });

    slidersWrap.addEventListener('change', e => {
      if (e.target && typeof e.target.blur === 'function') e.target.blur();
    });
  }

  const presetsWrap = $('#tpPresets');
  if (presetsWrap) {
    presetsWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-preset]');
      if (!btn) return;
      applyTuningPreset(btn.dataset.preset);
      syncTuningUI();
      syncSettings();
      hudUpd();
      if (typeof btn.blur === 'function') btn.blur();
      const presetInfo = TUNING_PRESETS[btn.dataset.preset];
      if (presetInfo) showToast(`Perfil: ${presetInfo.name}`);
    });
  }

  syncTuningUI();
}

export function toggleTuning(force) {
  const next = typeof force === 'boolean' ? force : !state.tuningOpen;
  state.tuningOpen = next;
  const panel = $('#tuningPanel');
  if (panel) {
    panel.classList.toggle('on', next);
    panel.setAttribute('aria-hidden', next ? 'false' : 'true');
  }
  if (next) syncTuningUI();
}

// ---------- gerenciamento de telas e garagem (todos os 7 carros livres desde o início)
export function show(n) {
  state.mode = n;
  document.querySelectorAll('.scr').forEach(e => e.classList.toggle('on', e.id == n));
  const d = n == 'drive' || n == 'pause';
  $('#hud').style.display = d && set.hud ? 'block' : 'none';
  TR.forEach(t => { t.o.root.visible = d; });
  if (n == 'garage') fillGarage();
  if (!d && state.camMode == 1) state.camMode = 0;
}

export function fillGarage() {
  const c = car();
  const cur = co();
  $('#gb').textContent = c.b;
  $('#gn').textContent = c.n;
  $('#gc').textContent = c.c;

  const modelStatus = cur && cur.glbModel ? `.GLB (${cur.glbName || 'Personalizado'})` : 'Procedural 3D';
  const bar = (l, v, p) => `<div class="st">${l}<span>${v}</span><div class="bar"><i style="width:${p * 100}%"></i></div></div>`;
  $('#gs').innerHTML =
    bar('Potência', c.hp + ' hp', c.hp / 700) +
    bar('Torque', c.tq + ' Nm', c.tq / 800) +
    bar('Vel. máx.', c.top + ' km/h', c.top / 340) +
    bar('0–100 km/h', c.a.toFixed(1) + ' s', cl(1 - (c.a - 2.5) / 2.5, 0.1, 1)) +
    `<div class="st">Tração<span>${c.dr}</span></div><div class="st">Peso<span>${c.kg} kg</span></div><div class="st">Modelo 3D<span>${modelStatus}</span></div><div class="note">Todos os 7 veículos liberados · importe arquivos .glb/.gltf ou texturas (.png/.jpg) para este carro ou todos de uma vez.</div>`;
}

export function setCar() {
  CO.forEach((o, i) => { o.root.visible = i == state.ci; });
  P.rpm = 900;
  eBuild();
  placeCar(0, state.mode != 'drive');
}

export function pick(n) {
  state.ci = (state.ci + n + CARS.length) % CARS.length;
  setCar();
  state.revKick = 1;
  fillGarage();
}

let going = false;

export function go() {
  if (going) return;
  going = true;
  $('#fade').style.opacity = 1;
  setTimeout(() => {
    startDrive();
    resetFx();
    show('drive');
    $('#fade').style.opacity = 0;
    going = false;
  }, 500);
}

// ---------- configurações e viewport
export function qual() {
  const q = set.q;
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  const pr = [0.85, Math.min(dpr, 1.5), Math.min(dpr, 2.0)][q];
  R.setPixelRatio(pr);
  setQualityPipeline(q);
  state.qT = [0.42, 0.78, 1][q];
  IM.forEach(m => m.reset());
  rain.geometry.setDrawRange(0, [250, 500, 800][q] * 2);
  resize();
}

export function resize() {
  const pr = typeof R.getPixelRatio === 'function' ? R.getPixelRatio() : 1;
  R.setSize(innerWidth, innerHeight);
  resizeComposer(innerWidth, innerHeight, pr);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  fxCanvas.width = innerWidth;
  fxCanvas.height = innerHeight;
}

export function syncSettings() {
  const sp = $('#sp');
  if (!sp) return;
  sp.querySelectorAll('select[data-k]').forEach(sel => {
    const k = sel.dataset.k;
    if (k in set) sel.value = String(set[k]);
  });
}

export function initUI() {
  const ACT = {
    drive: go,
    garage: () => show('garage'),
    settings: () => show('settings'),
    controls: () => show('controls'),
    menu: () => show('menu'),
    prev: () => pick(-1),
    next: () => pick(1),
    importGlb: () => {
      const inp = $('#glbInput');
      if (inp) inp.click();
    },
    tuning: () => toggleTuning(),
    closeTuning: () => toggleTuning(false),
    cycleBiome: () => cycleBiome(),
    resume: () => show('drive')
  };

  const glbInput = $('#glbInput');
  if (glbInput) {
    glbInput.addEventListener('change', async e => {
      const files = e.target.files;
      if (!files || !files.length) return;
      showToast('Importando modelo 3D e texturas...', false, 0);
      try {
        const res = await importVehicleFiles(files, state.ci);
        placeCar(0, state.mode != 'drive');
        if (state.mode == 'garage') fillGarage();
        showToast(res.message);
      } catch (err) {
        showToast((err && err.message) || 'Não foi possível importar o arquivo .glb / textura', true);
      } finally {
        e.target.value = '';
      }
    });
  }

  const menuBiomes = $('#menuBiomes');
  if (menuBiomes) {
    menuBiomes.addEventListener('click', e => {
      const btn = e.target.closest('[data-biome]');
      if (!btn) return;
      aInit();
      resumeAudio();
      selectBiome(Number(btn.dataset.biome));
      if (typeof btn.blur === 'function') btn.blur();
    });
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    aInit();
    resumeAudio();
    const fn = ACT[b.dataset.a];
    if (fn) fn();
    if (typeof b.blur === 'function') b.blur();
  });

  const OPT = {
    biome: BIOMES.map(b => b.name),
    q: ['Baixa', 'Média', 'Alta'],
    tx: ['Automático', 'Manual'],
    tod: TOD.map(t => t[0]),
    wx: ['Limpo', 'Neblina', 'Nublado', 'Chuva'],
    as: ['Desligada', 'Ligada'],
    vol: ['Mudo', 'Baixo', 'Médio', 'Alto']
  };
  const LB = {
    biome: 'Mapa / Bioma',
    q: 'Qualidade gráfica',
    tx: 'Câmbio',
    tod: 'Horário',
    wx: 'Clima',
    as: 'Estabilidade',
    vol: 'Volume'
  };

  const sp = $('#sp');
  sp.innerHTML =
    Object.keys(OPT)
      .map(
        k =>
          `<div class="row"><span>${LB[k]}</span><select data-k="${k}">${OPT[k]
            .map((o, i) => `<option value="${i}"${set[k] == i ? ' selected' : ''}>${o}</option>`)
            .join('')}</select></div>`
      )
      .join('') + '<div class="note">Dica: H abre Ajustes/Tuning, B troca de Mapa, T muda horário, V clima e M Câmbio Auto/Manual.</div>';

  sp.addEventListener('change', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    const val = +e.target.value;
    if (k == 'biome') {
      selectBiome(val);
      return;
    }
    set[k] = val;
    if (k == 'q') qual();
    if (k == 'tod' || k == 'wx') applyEnv();
    if (k == 'as') {
      tuning.esc = val ? 70 : 0;
      tuning.tcs = val ? 55 : 0;
      tuning.preset = 'custom';
      saveTuning();
      syncTuningUI();
      hudUpd();
    }
    if (k == 'vol') setMasterVolume(set.vol);
  });

  renderBiomeSelectors();
  initTuningUI();
}
