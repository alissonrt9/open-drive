import { $, TAU, cl, lp, sm, wrap, car, biome, set, tuning, state, P, IN, K } from './config.js';
import { cx, getGroundY, applyEnv } from './world.js';
import { TR, spawn, co } from './vehicles.js';
import { burst } from './audio.js';

export const FIXED_DT = 1 / 120;
const GEAR_RATIOS = [3.45, 2.28, 1.66, 1.28, 1.04, 0.88, 0.76];
const DEG2RAD = Math.PI / 180;

let uiCallbacks = {
  show: () => {},
  syncSettings: () => {},
  showToast: () => {},
  toggleTuning: () => {},
  cycleBiome: () => {},
  toggleDebug: () => {}
};

export function initInput(callbacks) {
  uiCallbacks = { ...uiCallbacks, ...callbacks };

  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'].includes(e.code)) {
      e.preventDefault();
    }
    if (K[e.code]) return;
    K[e.code] = 1;
    key(e.code);
  });

  addEventListener('keyup', e => {
    K[e.code] = 0;
  });

  addEventListener('blur', () => {
    Object.keys(K).forEach(code => { K[code] = 0; });
  });
}

// ---------- troca de marchas (Manual Q/E e Automático)
export function shiftUp() {
  if (state.mode != 'drive' || set.tx != 1) return false;
  if (P.gear < 7) {
    P.gear++;
    P.shift = 0.16;
    P.limiterCut = false;
    burst('bandpass', 1550, 0.06, 0.09);
    return true;
  }
  return false;
}

export function shiftDown() {
  if (state.mode != 'drive' || set.tx != 1) return false;
  if (P.gear > 1) {
    P.gear--;
    P.shift = 0.13;
    P.limiterCut = false;
    // Punta-tacco / rev-match na reduzida
    const c = car();
    const activeObj = co();
    const rw = (activeObj && activeObj.wheelR) || (c.t == 2 ? 0.35 : 0.34);
    const nextWr = (Math.abs(P.spd) / rw) * ovr(c, P.gear) * 60 / TAU;
    P.rpm = Math.min(c.rev * 1.01, Math.max(P.rpm * 1.16, nextWr));
    burst('bandpass', 920, 0.07, 0.12);
    return true;
  }
  return false;
}

// ---------- input teclado e gamepad
export function key(c) {
  if (c == 'Escape') {
    if (state.tuningOpen) {
      uiCallbacks.toggleTuning(false);
      return;
    }
    if (state.mode == 'drive') uiCallbacks.show('pause');
    else if (state.mode == 'pause') uiCallbacks.show('drive');
    else if (state.mode != 'menu') uiCallbacks.show('menu');
  }
  if (c == 'KeyC') state.camMode = (state.camMode + 1) % 4;
  if (c == 'KeyR' && state.mode == 'drive') resetCar();
  if (c == 'KeyE') shiftUp();
  if (c == 'KeyQ') shiftDown();
  if (c == 'KeyH') uiCallbacks.toggleTuning();
  if (c == 'KeyB') uiCallbacks.cycleBiome();
  if (c == 'F3') uiCallbacks.toggleDebug();
  if (c == 'KeyM') {
    set.tx = set.tx ? 0 : 1;
    uiCallbacks.syncSettings();
    uiCallbacks.showToast(set.tx ? 'Câmbio Manual ativado (Q desce · E sobe)' : 'Câmbio Automático ativado');
  }
  if (c == 'KeyF') {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }
  if (c == 'KeyU') {
    set.hud = set.hud ? 0 : 1;
    $('#hud').style.display = set.hud && (state.mode == 'drive' || state.mode == 'pause') ? 'block' : 'none';
  }
  if (c == 'KeyT') {
    set.tod = (set.tod + 1) % 6;
    applyEnv();
    uiCallbacks.syncSettings();
  }
  if (c == 'KeyV') {
    set.wx = (set.wx + 1) % 4;
    applyEnv();
    uiCallbacks.syncSettings();
  }
}

export function readIn(dt) {
  const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean);
  let g = (K.KeyW || K.ArrowUp) ? 1 : 0;
  let b = (K.KeyS || K.ArrowDown) ? 1 : 0;
  let s = ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
  let hb = K.Space ? 1 : 0;

  if (gp) {
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.12) s = ax;
    g = Math.max(g, gp.buttons[7] ? gp.buttons[7].value : 0);
    b = Math.max(b, gp.buttons[6] ? gp.buttons[6].value : 0);
    if (gp.buttons[1] && gp.buttons[1].pressed) hb = 1;

    const lb = !!(gp.buttons[4] && gp.buttons[4].pressed);
    if (lb && !state.gpLB) shiftDown();
    state.gpLB = lb;

    const rb = !!(gp.buttons[5] && gp.buttons[5].pressed);
    if (rb && !state.gpRB) shiftUp();
    state.gpRB = rb;

    const y = !!(gp.buttons[3] && gp.buttons[3].pressed);
    if (y && !state.gpY) key('KeyC');
    state.gpY = y;

    const st = !!(gp.buttons[9] && gp.buttons[9].pressed);
    if (st && !state.gpS) key('Escape');
    state.gpS = st;
  }

  IN.g = g;
  IN.b = b;
  IN.hb = hb;
  // Suavização adaptativa à velocidade para evitar movimentos bruscos no teclado em alta velocidade
  const speedRatio = cl(Math.abs(P.spd) / 60, 0, 1);
  const riseRate = lp(9.2, 4.6, speedRatio) * cl(tuning.steerSens / 100, 0.75, 1.25);
  const returnRate = lp(13.0, 9.5, speedRatio);
  IN.s += (s - IN.s) * (1 - Math.exp(-(s ? riseRate : returnRate) * dt));
  state.Pth = g;
}

// ---------- relação de marchas realista de 7 velocidades + regulagem de relação final
export const ovr = (c, g) => {
  const idx = cl(Math.round(g) - 1, 0, GEAR_RATIOS.length - 1);
  const ratioRel = GEAR_RATIOS[idx] / GEAR_RATIOS[6];
  // gearRatio: 0 (curta/aceleração +18%) .. 50 (padrão 1.0) .. 100 (longa/vel.final -16%)
  const finalDriveMul = lp(1.18, 0.84, cl(tuning.gearRatio / 100, 0, 1));
  const topOv = (c.rev * 0.955 * TAU * 0.34) / (60 * (c.top / 3.6));
  return topOv * ratioRel * finalDriveMul;
};

export function hit(v) {
  if (state.hitCD > 0) return;
  state.hitCD = 0.35;
  if (v > 4) {
    burst('lowpass', 480, Math.min(1, v / 16), 0.4);
    P.sh = Math.min(0.65, v / 28);
  }
}

// ---------- Curva Pacejka-Lite progressiva para aderência lateral natural sem perda brusca
function pacejkaLatFactor(absSlip, peakSlip, shapeC = 1.38) {
  if (absSlip <= 0.001) return 1.0;
  const B = 1.0 / Math.max(0.06, peakSlip);
  const x = B * absSlip;
  const E = 0.45;
  const magic = Math.sin(shapeC * Math.atan(x - E * (x - Math.atan(x))));
  // Retorna razão efetiva normalizada para o modelo linear vLat mantendo pico alto e cauda progressiva
  const effective = Math.max(0.28, (magic / Math.max(0.18, absSlip)) * peakSlip * 0.95);
  return cl(effective, 0.34, 1.12);
}

// ---------- Integrador Runge-Kutta de 4ª Ordem (RK4) para o corpo rígido veicular [x, z, yaw, vx, vz, yr]
function evalVehicleDeriv(sx, sz, syaw, svx, svz, syr, params, out) {
  const f0 = -Math.sin(syaw);
  const f1 = -Math.cos(syaw);
  const r0 = Math.cos(syaw);
  const r1 = -Math.sin(syaw);

  const u = svx * f0 + svz * f1;
  const vLat = svx * r0 + svz * r1;
  const absU = Math.abs(u);
  const spd = Math.hypot(u, vLat);
  const slip = spd > 2.6 ? Math.atan2(vLat, Math.max(absU, 2.2)) : 0;
  const absSlip = Math.abs(slip);

  // Alvo de yaw rate + contra-esterço assistido inteligente + ESC
  let yrT = -u * Math.tan(params.steer) / params.wheelbaseEff;
  if (!params.hb && Math.abs(yrT * u) > params.maxLatAccel) {
    yrT = Math.sign(yrT) * params.maxLatAccel / Math.max(absU, 1.4);
  }
  if (params.hb) {
    yrT *= params.isAWD ? 1.30 : 1.48;
  }

  // Saída de traseira progressiva quando há excesso de torque em curva
  if (u > 3.2 && params.th > 0.25 && params.overTorque > 0.06) {
    const driftDir = absSlip > 0.10
      ? Math.sign(slip)
      : (Math.abs(params.inSteer) > 0.08 ? -Math.sign(params.inSteer) : 0);
    if (driftDir !== 0) {
      const lowSpeedLaunch = cl(1.12 - absU / 44, 0.28, 1.12);
      yrT += driftDir * params.overTorque * params.drFactor * lowSpeedLaunch;
    }
  }

  // ESC / Estabilidade: amortece sobresterço excessivo sem matar o controle do piloto
  if (params.escFactor > 0.02 && absU > 3.5 && !params.hb) {
    const slipFade = cl((absSlip - 0.035) / 0.14, 0, 1);
    const counterYaw = cl(-slip * lp(0.28, params.isAWD ? 1.15 : 1.02, params.escFactor) * slipFade, -0.68, 0.68);
    yrT += counterYaw;
  }

  const dYr = params.yawResp * (yrT - syr);
  const dYaw = syr;

  // Forças longitudinais suaves (C1 via tanh perto de 0 m/s para zero oscilações)
  const fAero = 0.5 * 1.2 * 0.66 * u * absU;
  const fRoll = params.surfaceRoll * params.m * params.g * Math.tanh(u / 0.35);
  const fSlope = params.m * params.g * params.slopeSin * 0.58;
  const fBrake = params.brakeDecel * params.m * Math.tanh(u / 0.22);
  const fScrub = params.m * Math.tanh(u / 0.45) * Math.min(absU * 0.16, Math.abs(vLat) * 0.38);

  const aLong = (params.driveF - fAero - fRoll - fSlope - fBrake - fScrub) / params.m;

  // Curva Pacejka-Lite progressiva para força lateral do pneu
  const peakSlip = lp(0.16, 0.22, params.suspNorm) * (params.isAWD ? 1.08 : 1.0);
  const latCurve = pacejkaLatFactor(absSlip, peakSlip, params.isAWD ? 1.32 : 1.42);
  const powerSlideLoss = params.overTorque > 0.14 ? cl(1 - params.overTorque * (params.isAWD ? 0.10 : 0.24), 0.62, 1) : 1;
  const absLateralRetention = params.absActive ? 0.92 : (params.braking ? 0.72 : 1.0);
  const escLatBoost = 1 + params.escFactor * cl(absSlip * 0.35, 0, 0.28);

  const grp = 10.2 * params.carGr * params.totalGripMul * latCurve * powerSlideLoss * absLateralRetention * escLatBoost
    * (params.hb ? 0.22 : 1)
    * (params.ws ? (params.isAWD ? 0.90 : 0.76) : 1);

  const aLat = -grp * vLat;

  out[0] = svx;
  out[1] = svz;
  out[2] = dYaw;
  out[3] = aLong * f0 + aLat * r0;
  out[4] = aLong * f1 + aLat * r1;
  out[5] = dYr;
}

const _rk1 = new Float64Array(6);
const _rk2 = new Float64Array(6);
const _rk3 = new Float64Array(6);
const _rk4 = new Float64Array(6);

export function step(dt) {
  // Guarda snapshot anterior para interpolação sub-frame em qualquer taxa de FPS
  P.prevX = P.x;
  P.prevZ = P.z;
  P.prevYaw = P.yaw;
  P.prevWAngF = P.wAngF;
  P.prevWAngR = P.wAngR;

  const c = car();
  const bm = biome();
  const activeObj = co();
  const m = c.kg;
  const g = 9.81;
  const Rw = (activeObj && activeObj.wheelR) || (c.t == 2 ? 0.35 : 0.34);
  const wet = set.wx == 3 ? 0.78 : (bm.id === 'snow' ? 0.96 : 1.0);
  const off = P.x - cx(P.z);
  const ao = Math.abs(off);
  const onAsphalt = ao <= 8.6;
  const offr = !onAsphalt;
  const isAWD = c.dr === 'AWD';

  const tuningGrip = cl(tuning.grip / 100, 0.7, 1.3);
  const escFactor = cl(tuning.esc / 100, 0, 1);
  const tcsFactor = cl(tuning.tcs / 100, 0, 1);
  const brakeMul = cl(tuning.brakeForce / 100, 0.7, 1.3);
  const suspNorm = cl(tuning.suspStiff / 100, 0, 1);
  const steerSens = cl(tuning.steerSens / 100, 0.5, 1.5);

  const surface = onAsphalt ? 'asphalt' : 'offroad';
  const surfaceGrip = onAsphalt ? 1.0 : (isAWD ? 0.80 : 0.66);
  const totalGripMul = wet * surfaceGrip * bm.gripMul * tuningGrip;
  const mu = c.gr * 1.16 * totalGripMul;

  let f0 = -Math.sin(P.yaw);
  let f1 = -Math.cos(P.yaw);
  let r0 = Math.cos(P.yaw);
  let r1 = -Math.sin(P.yaw);
  let vx = P.vx * f0 + P.vz * f1;
  let vy = P.vx * r0 + P.vz * r1;
  const vo = vx;
  let as = Math.abs(vx);
  const preSpeed = Math.hypot(P.vx, P.vz);
  const preSlip = preSpeed > 2.6 ? Math.atan2(vy, Math.max(as, 2.2)) : 0;
  const absPreSlip = Math.abs(preSlip);

  let th = IN.g;
  let br = IN.b;
  let rev = 0;
  if (IN.b > 0 && vx < 0.8 && IN.g < 0.05) { rev = IN.b; br = 0; }
  if (IN.g > 0 && vx < -0.8) { br = IN.g; th = 0; }

  const ov = ovr(c, P.gear);
  const wr = rev ? (as / Rw) * ovr(c, 1) * 60 / TAU : (as / Rw) * ov * 60 / TAU;
  let rt = Math.max(900, wr);
  if (as < 5 && !rev) rt = Math.max(rt, 900 + th * (c.rev * 0.62 - 900) * (1 - as / 5));
  if (P.shift > 0) rt *= 0.84;

  // Troca de marchas automática (tx == 0) vs Manual estrita (tx == 1)
  P.shift = Math.max(0, P.shift - dt);
  if (set.tx == 0 && P.shift == 0 && !rev) {
    if (P.rpm > c.rev * 0.93 && P.gear < 7 && th > 0) {
      P.gear++;
      P.shift = 0.18;
      burst('bandpass', 1500, 0.05, 0.1);
    } else if (P.gear > 1 && wr < c.rev * 0.40) {
      P.gear--;
      P.shift = 0.14;
    }
  }

  // Corte de giro realista (corte de combustível/ignição no redline da marcha atual)
  const hitRedline = !rev && (wr >= c.rev * 0.985 || P.rpm >= c.rev * 0.985) && th > 0.05;
  const overRev = !rev && wr > c.rev * 1.004;

  if (hitRedline || overRev) {
    P.limiterPhase = (P.limiterPhase + dt * 16.5) % 1;
    P.limiterCut = P.limiterPhase < 0.62 || wr >= c.rev * 0.996;
    rt = P.limiterCut ? c.rev * 0.962 : c.rev * 1.002;
  } else {
    P.limiterPhase = 0;
    P.limiterCut = false;
  }

  P.rpm += (rt - P.rpm) * (1 - Math.exp(-(P.rpm < rt ? 12.5 : (P.limiterCut ? 18 : 7)) * dt));

  // Curva de torque e limitação de velocidade na marcha atual
  const tq = c.tq * Math.max(0.38, 1 - 0.52 * Math.pow(P.rpm / (c.rev * 0.62) - 1, 2));
  let F = th * tq * ov * 0.94 / Rw;
  F = Math.min(F, th * c.hp * 745.7 * 0.95 / Math.max(as, 4));

  if (P.shift > 0) {
    F = 0;
  } else if (overRev) {
    const overRatio = cl((wr - c.rev) / (c.rev * 0.45), 0.08, 1.0);
    F = -m * 4.2 * overRatio;
  } else if (hitRedline) {
    if (P.limiterCut) {
      F = 0;
    } else {
      const redlineWindow = cl((c.rev * 0.996 - wr) / (c.rev * 0.025), 0, 1);
      F *= redlineWindow;
    }
  }

  // Modelo de tração progressiva + Controle de Tração (TCS) regulável (0%..100%)
  const slipTractionPenalty = isAWD
    ? cl(1 - absPreSlip * 0.20, 0.78, 1)
    : cl(1 - absPreSlip * 0.45, 0.52, 1);
  const Ft = mu * m * g * c.tr * (isAWD && offr ? 1.10 : 1) * slipTractionPenalty;
  const overTorque = Ft > 1 ? cl((F - Ft * 0.78) / Ft, 0, 1.35) : 0;

  let ws = 0;
  P.tcsActive = false;
  if (F > Ft) {
    if (tcsFactor > 0.05) {
      P.tcsActive = true;
      const tcsLimit = Ft * lp(0.91, 0.99, tcsFactor);
      F = lp(F * 0.93, tcsLimit, tcsFactor);
      ws = tcsFactor < 0.45 || (!isAWD && th > 0.9 && absPreSlip > 0.22) || (offr && th > 0.85) ? 1 : 0;
    } else {
      ws = 1;
      F = Ft * (isAWD ? 0.96 : 0.91);
    }
  }
  if (rev) F = vx < -10 ? 0 : -Math.min(m * 2.8, Ft) * rev;

  // Direção Sensível à Velocidade (34° <60 km/h -> 11° >180 km/h) + curva não-linear + contra-esterço assistido
  const kmh = as * 3.6;
  const highSpeedT = sm(60, 180, kmh);
  const ultraSpeedT = sm(180, 290, kmh);
  const maxSteerDeg = lp(34, 11, highSpeedT) - ultraSpeedT * 1.5;
  const maxSteerRad = maxSteerDeg * DEG2RAD * steerSens;

  // Curva não-linear na entrada (suaviza micro-toques em alta velocidade sem perder agilidade no vértice)
  const curveExp = lp(1.05, 1.68, highSpeedT);
  const shapedInput = Math.sign(IN.s) * Math.pow(Math.abs(IN.s), curveExp);

  // Contra-esterço assistido inteligente (Counter-Steer Assist)
  let counterSteer = 0;
  if (vx > 4.0 && absPreSlip > 0.045 && !IN.hb) {
    const assistWeight = lp(0.18, 0.72, escFactor);
    const slipGain = cl((absPreSlip - 0.045) / 0.24, 0, 1);
    counterSteer = cl(preSlip * assistWeight * slipGain, -0.26, 0.26);
  }

  const targetSteer = cl(shapedInput * maxSteerRad + counterSteer, -0.66, 0.66);
  const steerResp = lp(11.5, 7.8, highSpeedT) * lp(0.92, 1.18, suspNorm);
  P.steer += (targetSteer - P.steer) * (1 - Math.exp(-steerResp * dt));

  // Frenagem com ABS real modulada no limite de aderência
  const rawBrakeDemand = br * 1.12 * mu * g * brakeMul;
  const peakBrakeDecel = mu * g * 1.05 * brakeMul;
  const absTriggered = br > 0.25 && as > 3.5 && rawBrakeDemand >= peakBrakeDecel * 0.86;
  P.absActive = absTriggered;
  const absPulse = absTriggered ? (0.93 + 0.07 * Math.sin(P.t * 88)) : 1.0;
  const brakeDecel = (absTriggered ? peakBrakeDecel * absPulse : rawBrakeDemand)
    + (IN.hb && vx > 0 ? 0.36 * g : 0);

  const hFwd = getGroundY(P.x + f0 * 1.6, P.z + f1 * 1.6);
  const hBack = getGroundY(P.x - f0 * 1.6, P.z - f1 * 1.6);
  const slopeSin = cl((hFwd - hBack) / 3.2, -0.32, 0.32);

  const rkParams = {
    m,
    g,
    carGr: c.gr,
    totalGripMul,
    surfaceRoll: onAsphalt ? 0.015 : (bm.id === 'snow' ? 0.095 : 0.084),
    slopeSin,
    driveF: F,
    brakeDecel,
    braking: br > 0.15,
    absActive: absTriggered,
    steer: P.steer,
    inSteer: IN.s,
    hb: IN.hb,
    th,
    ws,
    overTorque,
    isAWD,
    escFactor,
    suspNorm,
    wheelbaseEff: c.L * 0.62,
    maxLatAccel: mu * g * lp(1.06, 1.24, 1 - escFactor) * lp(0.96, 1.08, suspNorm),
    drFactor: isAWD ? lp(0.28, 0.08, escFactor) : lp(1.02, 0.38, escFactor),
    yawResp: lp(6.4, 9.6, suspNorm) * lp(0.92, 1.12, escFactor)
  };

  // --- Executa os 4 estágios RK4 (t, t+dt/2, t+dt/2, t+dt) ---
  const x0 = P.x, z0 = P.z, y0 = P.yaw, vx0 = P.vx, vz0 = P.vz, yr0 = P.yr;
  const h2 = dt * 0.5;
  const h6 = dt / 6;

  evalVehicleDeriv(x0, z0, y0, vx0, vz0, yr0, rkParams, _rk1);
  evalVehicleDeriv(
    x0 + _rk1[0] * h2, z0 + _rk1[1] * h2, y0 + _rk1[2] * h2,
    vx0 + _rk1[3] * h2, vz0 + _rk1[4] * h2, yr0 + _rk1[5] * h2,
    rkParams, _rk2
  );
  evalVehicleDeriv(
    x0 + _rk2[0] * h2, z0 + _rk2[1] * h2, y0 + _rk2[2] * h2,
    vx0 + _rk2[3] * h2, vz0 + _rk2[4] * h2, yr0 + _rk2[5] * h2,
    rkParams, _rk3
  );
  evalVehicleDeriv(
    x0 + _rk3[0] * dt, z0 + _rk3[1] * dt, y0 + _rk3[2] * dt,
    vx0 + _rk3[3] * dt, vz0 + _rk3[4] * dt, yr0 + _rk3[5] * dt,
    rkParams, _rk4
  );

  P.x   = x0  + (_rk1[0] + 2 * _rk2[0] + 2 * _rk3[0] + _rk4[0]) * h6;
  P.z   = z0  + (_rk1[1] + 2 * _rk2[1] + 2 * _rk3[1] + _rk4[1]) * h6;
  P.yaw = wrap(y0 + (_rk1[2] + 2 * _rk2[2] + 2 * _rk3[2] + _rk4[2]) * h6);
  P.vx  = vx0 + (_rk1[3] + 2 * _rk2[3] + 2 * _rk3[3] + _rk4[3]) * h6;
  P.vz  = vz0 + (_rk1[4] + 2 * _rk2[4] + 2 * _rk3[4] + _rk4[4]) * h6;
  P.yr  = yr0 + (_rk1[5] + 2 * _rk2[5] + 2 * _rk3[5] + _rk4[5]) * h6;

  // Zona morta limpa quando parado com freio
  if (Math.hypot(P.vx, P.vz) < 0.12 && br > 0.05 && th < 0.05 && !rev) {
    P.vx = 0;
    P.vz = 0;
  }

  f0 = -Math.sin(P.yaw);
  f1 = -Math.cos(P.yaw);
  r0 = Math.cos(P.yaw);
  r1 = -Math.sin(P.yaw);
  vx = P.vx * f0 + P.vz * f1;
  vy = P.vx * r0 + P.vz * r1;
  as = Math.abs(vx);

  const postSpeed = Math.hypot(vx, vy);
  const absSlip = postSpeed > 2.6 ? Math.abs(Math.atan2(vy, Math.max(as, 2.2))) : 0;
  P.slipAngle = postSpeed > 2.6 ? Math.atan2(vy, Math.max(as, 2.2)) : 0;
  P.offroad = offr;
  P.surface = surface;
  P.tractionLoss = ws > 0 || (tcsFactor < 0.3 && overTorque > 0.45 && th > 0.6);
  P.drifting = as > 4.5 && (absSlip > 0.14 || (IN.hb && as > 6));
  P.brk = br > 0.1 || IN.hb || rev > 0 ? 1 : 0;
  P.boost += ((c.tb ? th * cl((P.rpm - 2500) / 3500, 0, 1) : 0) - P.boost) * (1 - Math.exp(-3.5 * dt));

  P.sq = as > 2
    ? cl(
        Math.abs(vy) / 3.8
        + (ws ? 0.48 : 0)
        + (!isAWD && overTorque > 0.35 && absSlip > 0.1 ? 0.32 : 0)
        + (absTriggered ? 0.18 : br * as / 280)
        + (IN.hb && as > 5 ? 0.65 : 0),
        0,
        1
      )
    : 0;
  P.ax += ((vx - vo) / dt - P.ax) * (1 - Math.exp(-7 * dt));
  P.spd = vx;

  // Sincronização das rodas com atrito do solo e modulação do ABS
  const wGround = vx / Rw;
  const isSpinningRear = ws > 0 || (tcsFactor < 0.45 && overTorque > 0.22 && th > 0.5 && as < c.top / 3.6);
  const slipSpin = isSpinningRear
    ? th * (0.35 + overTorque * 0.80) * (1.2 / Math.max(0.45, totalGripMul)) * (c.rev / 7000) * 24
    : 0;
  const brakeSlipRatio = br > 0.25 && as > 1.5
    ? (absTriggered ? 0.14 : cl((br * brakeMul - mu * 0.78) * 0.55, 0, 0.58))
    : 0;

  let targetWFront = wGround * (1 - brakeSlipRatio);
  const targetWRear = IN.hb
    ? 0
    : wGround * (1 - brakeSlipRatio * 0.85) + (isAWD ? slipSpin * 0.65 : slipSpin);
  if (isAWD && !IN.hb && slipSpin > 0) {
    targetWFront += slipSpin * 0.65;
  }

  const frontBlend = 1 - Math.exp(-(brakeSlipRatio > 0.1 ? 18 : 30) * dt);
  const rearBlend = 1 - Math.exp(-(IN.hb ? 28 : (slipSpin > 0 ? 16 : 30)) * dt);
  P.wFront += (targetWFront - P.wFront) * frontBlend;
  P.wRear += (targetWRear - P.wRear) * rearBlend;
  P.wAngF = wrap(P.wAngF - P.wFront * dt);
  P.wAngR = wrap(P.wAngR - P.wRear * dt);

  // Fronteira ampla do mundo aberto em ±900m com repulsão elástica suave
  const o2 = P.x - cx(P.z);
  if (Math.abs(o2) > 900) {
    const s = Math.sign(o2);
    const pen = Math.abs(o2) - 900;
    const vw = P.vx * s;
    P.x -= s * Math.min(pen, 0.25);
    if (vw > 0) {
      P.vx -= s * vw * 1.15;
      hit(vw);
    }
    P.vx *= 0.99;
    P.vz *= 0.99;
  }

  // Colisão contínua com tráfego (zero teleporte)
  const hitHalfW = c.W * 0.5 + 0.85;
  const hitHalfL = c.L * 0.5 + 2.05;
  for (const t of TR) {
    const dz = P.z - t.z;
    if (Math.abs(dz) < hitHalfL) {
      const tx = cx(t.z) + t.l;
      const dx = P.x - tx;
      if (Math.abs(dx) < hitHalfW) {
        const px = hitHalfW - Math.abs(dx);
        const pz = hitHalfL - Math.abs(dz);
        const tVz = -t.v;
        const rel = Math.hypot(P.vx, P.vz - tVz);

        if (px < pz) {
          const sx = dx === 0 ? 1 : Math.sign(dx);
          P.x += sx * Math.min(px, 0.08);
          const pushV = P.vx * sx;
          if (pushV < 0) P.vx -= sx * pushV * 1.2;
          P.vx *= 0.992;
          P.vz *= 0.994;
          P.yr += sx * -0.18 * cl(rel / 20, 0, 1);
          hit(rel * 0.45);
        } else {
          const sz = dz === 0 ? 1 : Math.sign(dz);
          P.z += sz * Math.min(pz, 0.11);
          const relZ = P.vz - tVz;
          if (sz * relZ < 0) {
            P.vz -= sz * (sz * relZ) * 0.72;
            t.v = cl(t.v - sz * relZ * 0.22, 6, 42);
          }
          P.vx *= 0.988;
          hit(rel * 0.75);
        }
      }
    }
  }

  state.hitCD = Math.max(0, state.hitCD - dt);
  P.sh = Math.max(0, P.sh - dt * 2.8);
  P.dist += as * dt;
  P.t += dt;

  // Rigidez da suspensão regula amplitude de pitch/roll e resposta de amortecimento
  const bodyCompliance = lp(1.32, 0.56, suspNorm);
  const bodyDamp = lp(5.5, 10.5, suspNorm);
  P.pit += (cl(P.ax * 0.007 * bodyCompliance, -0.055, 0.055) - P.pit) * (1 - Math.exp(-bodyDamp * dt));
  P.rol += (cl(P.yr * vx * 0.0036 * bodyCompliance, -0.075, 0.075) - P.rol) * (1 - Math.exp(-bodyDamp * dt));
  P.eng = (hitRedline || overRev || P.rpm > c.rev * 0.97)
    ? 'CORTE DE GIRO'
    : P.absActive
      ? 'ABS ATIVO'
      : P.tcsActive
        ? 'TCS ATIVO'
        : as < 1 && th < 0.05
          ? 'MARCHA LENTA'
          : P.shift > 0
            ? 'TROCA'
            : 'MOTOR OK';
}

// Acumulador de passo fixo (fixedTimestep) com interpolação temporal suave para qualquer taxa de FPS
export function advancePhysics(frameDt) {
  const safeDt = Math.min(0.05, Math.max(0, frameDt));
  state.physAcc += safeDt;
  let substeps = 0;
  const maxSubsteps = 8;
  while (state.physAcc >= FIXED_DT && substeps < maxSubsteps) {
    step(FIXED_DT);
    state.physAcc -= FIXED_DT;
    substeps++;
  }
  if (substeps >= maxSubsteps && state.physAcc > FIXED_DT) {
    state.physAcc = FIXED_DT * 0.5;
  }
  state.renderAlpha = cl(state.physAcc / FIXED_DT, 0, 1);
}

export function resetCar() {
  P.x = cx(P.z) + 1.9;
  P.yaw = Math.atan2(cx(P.z) - cx(P.z - 2), 2);
  P.prevX = P.x;
  P.prevZ = P.z;
  P.prevYaw = P.yaw;
  P.vx = P.vz = P.spd = P.yr = P.steer = P.sq = P.slipAngle = P.wFront = P.wRear = P.wAngF = P.wAngR = P.prevWAngF = P.prevWAngR = P.ax = P.pit = P.rol = P.sh = 0;
  P.limiterCut = false;
  P.limiterPhase = 0;
  P.absActive = false;
  P.tcsActive = false;
  P.offroad = P.drifting = P.tractionLoss = false;
  P.surface = 'asphalt';
  P.cy = P.yaw;
  state.physAcc = 0;
  state.renderAlpha = 1;
}

export function startDrive() {
  P.yaw = Math.atan2(cx(P.z) - cx(P.z - 2), 2);
  P.x = cx(P.z) + 1.9;
  P.prevX = P.x;
  P.prevZ = P.z;
  P.prevYaw = P.yaw;
  const v = 12;
  const activeObj = co();
  const rw0 = (activeObj && activeObj.wheelR) || (car().t == 2 ? 0.35 : 0.34);
  P.vx = -Math.sin(P.yaw) * v;
  P.vz = -Math.cos(P.yaw) * v;
  P.spd = v;
  P.wFront = v / rw0;
  P.wRear = v / rw0;
  P.wAngF = 0;
  P.wAngR = 0;
  P.prevWAngF = 0;
  P.prevWAngR = 0;
  P.rpm = 2400;
  P.gear = 2;
  P.shift = 0;
  P.limiterCut = false;
  P.limiterPhase = 0;
  P.absActive = false;
  P.tcsActive = false;
  P.dist = 0;
  P.t = 0;
  P.steer = P.yr = P.sq = P.slipAngle = P.ax = P.pit = P.rol = P.sh = 0;
  P.offroad = P.drifting = P.tractionLoss = false;
  P.surface = 'asphalt';
  P.cy = P.yaw;
  state.physAcc = 0;
  state.renderAlpha = 1;
  TR.forEach(t => spawn(t, 0));
}
