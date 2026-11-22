import { cl, car, set, VV, state, P } from './config.js';

// ---------- áudio procedural (Web Audio API com foco em graves, saturação quente e zero agudos estridentes)
let AC;
let MG;
let eng;
let NB;
let wnd;
let sq;
let rum;
let pBoost = 0;
let prevPth = 0;
let prevShift = 0;
let crackleCD = 0;
let lastUpdTime = 0;

export function aInit() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  MG = AC.createGain();
  MG.gain.value = VV[set.vol];
  MG.connect(AC.destination);

  NB = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = NB.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const nz = (type, f, q) => {
    const s = AC.createBufferSource();
    s.buffer = NB;
    s.loop = true;
    const fl = AC.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q || 0.8;
    const g = AC.createGain();
    g.gain.value = 0;
    s.connect(fl);
    fl.connect(g);
    g.connect(MG);
    s.start();
    return { g, fl };
  };

  wnd = nz('lowpass', 320, 0.7);
  sq = nz('bandpass', 1050, 2.2);
  rum = nz('lowpass', 135, 0.8);
  lastUpdTime = performance.now();
  eBuild();
}

export function resumeAudio() {
  if (AC && AC.state == 'suspended') AC.resume();
}

export function setMasterVolume(volIndex) {
  if (MG && AC) {
    MG.gain.setTargetAtTime(VV[volIndex], AC.currentTime, 0.03);
  }
}

export function eBuild() {
  if (!AC) return;
  if (eng) {
    eng.o.forEach(o => {
      try { o.stop(); } catch {}
      try { o.disconnect(); } catch {}
    });
    try { eng.out.disconnect(); } catch {}
    try { eng.tg.disconnect(); } catch {}
  }

  const c = car();
  const sum = AC.createGain();
  sum.gain.value = 0.9;

  // Saturação suave tipo tubo / escapamento (tanh * 1.6)
  const ws = AC.createWaveShaper();
  const cv = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = (i / 256) - 1;
    cv[i] = Math.tanh(x * 1.6);
  }
  ws.curve = cv;
  ws.oversample = '2x';

  // Filtro pré-shaper suave na onda dente de serra para evitar aliasing agudo
  const preLpf = AC.createBiquadFilter();
  preLpf.type = 'lowpass';
  preLpf.frequency.value = 1600;
  preLpf.Q.value = 0.7;

  // Filtro passa-baixa dinâmico pós-saturação (180Hz marcha lenta -> máximo 1450Hz no corte)
  const lpf = AC.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 220;
  lpf.Q.value = 1.25;

  // EQ de escapamento: lowshelf 250Hz (+5dB) + peaking 140Hz (+6dB, Q 1.2)
  const lowShelf = AC.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 250;
  lowShelf.gain.value = 5;

  const peakEq = AC.createBiquadFilter();
  peakEq.type = 'peaking';
  peakEq.frequency.value = 140;
  peakEq.Q.value = 1.2;
  peakEq.gain.value = 6;

  const out = AC.createGain();
  out.gain.value = 0;

  const mk = (type, detune = 0, target = sum) => {
    const o = AC.createOscillator();
    o.type = type;
    o.detune.value = detune;
    const g = AC.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(target);
    o.start();
    return { o, g };
  };

  // Camada 1: Sub-grave / ressonância do bloco (triangle em f0 * 0.5)
  const sub = mk('triangle', 0, sum);
  // Camada 2: Pulso principal de combustão (sawtooth em f0 via preLpf)
  const comb = mk('sawtooth', 0, preLpf);
  preLpf.connect(sum);
  // Camada 3: Harmônicos guturais de escape (quinta justa e oitava com leve detune)
  const h5 = mk('triangle', 6, sum);
  const h8 = mk('triangle', -5, sum);

  sum.connect(ws);
  ws.connect(lpf);
  lpf.connect(lowShelf);
  lowShelf.connect(peakEq);
  peakEq.connect(out);
  out.connect(MG);

  const lf = AC.createOscillator();
  lf.type = 'sine';
  const lg = AC.createGain();
  lg.gain.value = c.cyl == 8 ? 0.08 : 0.03;
  lf.connect(lg);
  lg.connect(sum.gain);
  lf.start();

  const tb = AC.createOscillator();
  tb.type = 'sine';
  const tg = AC.createGain();
  tg.gain.value = 0;
  tb.connect(tg);
  tg.connect(MG);
  tb.start();

  eng = {
    o: [sub.o, comb.o, h5.o, h8.o, lf, tb],
    sub,
    comb,
    h5,
    h8,
    lpf,
    out,
    lf,
    tb,
    tg
  };
}

export function burst(type, f, g, dur) {
  if (!AC || !NB) return;
  const s = AC.createBufferSource();
  s.buffer = NB;
  const fl = AC.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = Math.max(40, f);
  const gn = AC.createGain();
  const t = AC.currentTime;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.linearRampToValueAtTime(Math.max(0.001, g), t + 0.006);
  gn.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.03, dur));
  s.connect(fl);
  fl.connect(gn);
  gn.connect(MG);
  s.start(t, Math.random() * 0.9, dur + 0.02);
}

function cracklePop(delay = 0, amp = 0.22) {
  if (!AC || !NB) return;
  const t = AC.currentTime + delay;

  const s1 = AC.createBufferSource();
  s1.buffer = NB;
  const bp = AC.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 450 + Math.random() * 90;
  bp.Q.value = 1.6;
  const g1 = AC.createGain();
  g1.gain.setValueAtTime(0.0001, t);
  g1.gain.linearRampToValueAtTime(amp, t + 0.005);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
  s1.connect(bp);
  bp.connect(g1);
  g1.connect(MG);
  s1.start(t, Math.random() * 0.8, 0.1);

  const s2 = AC.createBufferSource();
  s2.buffer = NB;
  const lpF = AC.createBiquadFilter();
  lpF.type = 'lowpass';
  lpF.frequency.value = 120;
  const g2 = AC.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.linearRampToValueAtTime(amp * 1.15, t + 0.006);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  s2.connect(lpF);
  lpF.connect(g2);
  g2.connect(MG);
  s2.start(t, Math.random() * 0.8, 0.15);
}

export function aUpd() {
  if (!AC || !eng) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastUpdTime) / 1000);
  lastUpdTime = now;
  crackleCD = Math.max(0, crackleCD - dt);

  const t = AC.currentTime;
  const c = car();
  const x = cl((P.rpm - 900) / (c.rev - 900), 0, 1);
  const f0 = Math.max(20, (P.rpm / 60) * (c.cyl / 2));
  const E = eng;
  const sp = Math.abs(P.spd);
  const on = state.mode == 'drive' || state.mode == 'menu' || state.mode == 'garage';

  E.sub.o.frequency.setTargetAtTime(Math.max(28, f0 * 0.5), t, 0.025);
  E.comb.o.frequency.setTargetAtTime(f0, t, 0.025);
  E.h5.o.frequency.setTargetAtTime(f0 * 1.5, t, 0.025);
  E.h8.o.frequency.setTargetAtTime(f0 * 2.0, t, 0.025);

  const isV8 = c.cyl == 8;
  const isV10 = c.cyl == 10;
  E.sub.g.gain.setTargetAtTime(isV8 ? 0.82 : 0.75, t, 0.06);
  E.comb.g.gain.setTargetAtTime(0.5 + 0.18 * state.Pth, t, 0.06);
  E.h5.g.gain.setTargetAtTime(isV10 ? 0.24 + 0.12 * x : 0.22 + 0.08 * x, t, 0.08);
  E.h8.g.gain.setTargetAtTime(isV10 ? 0.22 + 0.13 * x : (isV8 ? 0.16 + 0.08 * x : 0.18 + 0.1 * x), t, 0.08);

  const rawCutoff = 180 + x * 780 + state.Pth * 490;
  const cutoff = Math.min(1450, rawCutoff) * (state.camMode == 1 ? 0.78 : 1) * (P.limiterCut ? 0.62 : 1);
  E.lpf.frequency.setTargetAtTime(cutoff, t, 0.03);

  E.lf.frequency.setTargetAtTime(Math.max(8, (P.rpm / 60) * 1.5), t, 0.08);
  const shiftDip = P.shift > 0 ? 0.42 : (P.limiterCut ? 0.22 : 1);
  const masterLvl = on ? (0.14 + 0.24 * (0.28 + 0.72 * state.Pth)) * shiftDip : 0;
  E.out.gain.setTargetAtTime(masterLvl, t, P.limiterCut ? 0.014 : 0.04);

  if (state.mode == 'drive') {
    const lifted = prevPth > 0.32 && state.Pth < 0.1;
    const highOverrun = state.Pth < 0.1 && P.rpm > 4500;
    const highShift = P.shift > 0.1 && prevShift == 0 && P.rpm > 4800;

    if (P.limiterCut && crackleCD <= 0) {
      cracklePop(0, isV8 ? 0.18 : 0.14);
      crackleCD = 0.085 + Math.random() * 0.05;
    } else if ((highShift || (highOverrun && (lifted || crackleCD <= 0))) && crackleCD <= 0) {
      const baseAmp = isV8 ? 0.22 : 0.17;
      cracklePop(0, baseAmp);
      if (Math.random() < 0.65) cracklePop(0.065 + Math.random() * 0.04, baseAmp * 0.78);
      if (lifted && Math.random() < 0.5) cracklePop(0.15 + Math.random() * 0.06, baseAmp * 0.6);
      crackleCD = highShift ? 0.22 : 0.34 + Math.random() * 0.35;
    }
  }
  prevPth = state.Pth;
  prevShift = P.shift;

  if (c.tb) {
    E.tb.frequency.setTargetAtTime(1400 + P.boost * 1200, t, 0.05);
    E.tg.gain.setTargetAtTime(on ? P.boost * 0.008 : 0, t, 0.05);
    if (pBoost > 0.6 && P.boost < 0.48 && state.Pth < 0.15 && state.mode == 'drive') {
      burst('bandpass', 1450, 0.12, 0.28);
    }
    pBoost = P.boost;
  } else {
    E.tg.gain.setTargetAtTime(0, t, 0.05);
  }

  wnd.g.gain.setTargetAtTime(on ? Math.pow(cl(sp / 75, 0, 1), 1.5) * 0.22 : 0, t, 0.1);
  wnd.fl.frequency.setTargetAtTime(Math.min(550, 180 + cl(sp / 85, 0, 1) * 370), t, 0.1);

  sq.g.gain.setTargetAtTime(state.mode == 'drive' && !P.offroad ? P.sq * 0.095 : 0, t, 0.05);
  const rumBoost = P.offroad ? 1.45 : 1;
  rum.g.gain.setTargetAtTime(state.mode == 'drive' ? cl(sp / 50, 0, 1) * 0.09 * rumBoost : 0, t, 0.1);
}
