function showBootError(title, message) {
  document.querySelectorAll('.scr').forEach(el => el.classList.remove('on'));
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = 'none';

  let overlay = document.getElementById('bootError');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bootError';
    overlay.setAttribute('role', 'alert');
    document.body.appendChild(overlay);
  }

  const card = document.createElement('div');
  card.className = 'be-card';

  const heading = document.createElement('h1');
  heading.textContent = title;

  const body = document.createElement('p');
  body.textContent = message;

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'pill pri';
  retryBtn.textContent = 'TENTAR NOVAMENTE';
  retryBtn.addEventListener('click', () => location.reload());

  card.append(heading, body, retryBtn);
  overlay.replaceChildren(card);
}

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;

  // ---------- verificação de suporte WebGL e carregamento dos módulos ES
  const glCanvas = document.getElementById('gl');
  const glCheck = glCanvas && (glCanvas.getContext('webgl2') || glCanvas.getContext('webgl'));
  if (!glCheck) {
    showBootError(
      'WebGL indisponível',
      'Não foi possível inicializar o contexto gráfico 3D neste navegador ou dispositivo. Verifique se a aceleração de hardware / WebGL está ativada.'
    );
    return;
  }

  let modules;
  try {
    modules = await Promise.all([
      import('./config.js'),
      import('./world.js'),
      import('./vehicles.js'),
      import('./physics.js'),
      import('./audio.js'),
      import('./fx.js'),
      import('./ui.js'),
      import('./qa.js')
    ]);
  } catch (err) {
    console.error('Erro ao inicializar módulos 3D / WebGL:', err);
    showBootError(
      'Erro de inicialização 3D',
      'Não foi possível carregar os módulos gráficos do OpenDrive neste navegador. Recarregue a página ou verifique o console.'
    );
    return;
  }

  const [
    { car, set, state, P },
    { cx, cam, applyEnv, rows, IM, rainUpd, updateSkyPos, updateCSM, renderWorld },
    { TR, trafficUpd, placeCar, camUpd, setCockpitOffset, importVehicleFiles },
    { initInput, readIn, advancePhysics, startDrive },
    { aUpd },
    { updateFx, resetFx },
    { fxDraw, hudUpd, show, setCar, qual, resize, syncSettings, initUI, fillGarage, showToast, hideToast, toggleTuning, cycleBiome },
    { initQA, toggleDebug, updateDebugOverlay }
  ] = modules;

  // ---------- inicialização explícita dos módulos e listeners globais
  initUI();
  initQA();
  initInput({ show, syncSettings, showToast, toggleTuning, cycleBiome, toggleDebug });
  setCockpitOffset({ eyeX: -0.18, eyeY: 0.06, eyeZ: 0.0, lookPitch: -1.65 });
  addEventListener('resize', resize);

  // ---------- suporte Drag-and-Drop instantâneo para modelos .glb / .gltf e texturas
  window.addEventListener('dragover', e => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    showToast('Solte arquivos .glb / .gltf ou texturas para carregar no veículo', false, 0);
  });

  window.addEventListener('dragleave', e => {
    if (e.relatedTarget === null) {
      hideToast();
    }
  });

  window.addEventListener('drop', async e => {
    e.preventDefault();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) {
      showToast('Nenhum arquivo válido detectado', true);
      return;
    }
    showToast('Importando modelo 3D e texturas...', false, 0);
    try {
      const res = await importVehicleFiles(files, state.ci);
      placeCar(0, state.mode != 'drive');
      if (state.mode == 'garage') fillGarage();
      showToast(res.message);
    } catch (err) {
      showToast((err && err.message) || 'Não foi possível ler este arquivo .glb / textura', true);
    }
  });

  // ---------- loop principal
  let last = performance.now();

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    state.T += dt;

    if (state.mode == 'drive') {
      readIn(dt);
      advancePhysics(dt);
      trafficUpd(dt);
      placeCar(dt, 0);
    } else if (state.mode == 'pause') {
      state.physAcc = 0;
      state.renderAlpha = 1;
      placeCar(0, 0);
    } else {
      state.physAcc = 0;
      state.renderAlpha = 1;
      P.z -= 14 * dt;
      P.x = cx(P.z) + 1.9;
      P.yaw = Math.atan2(cx(P.z) - cx(P.z - 2), 2);
      P.vx = -Math.sin(P.yaw) * 14;
      P.vz = -Math.cos(P.yaw) * 14;
      P.spd = 14;
      P.steer = P.yr = P.pit = P.rol = P.sq = P.slipAngle = 0;
      P.offroad = P.drifting = P.tractionLoss = false;
      P.surface = 'asphalt';
      P.brk = 0;
      P.rpm += (900 + state.revKick * (car().rev * 0.55 - 900) + (1 - state.revKick) * 1300 - P.rpm) * (1 - Math.exp(-6 * dt));
      state.revKick = Math.max(0, state.revKick - dt * 0.9);
      state.Pth = state.revKick > 0.1 ? 0.8 : 0.15;
      P.shift = 0;
      placeCar(dt, 1);
    }

    camUpd(dt);
    rows(P.z);
    IM.forEach(m => m.upd(P.z));
    updateFx(dt);
    rainUpd(dt);

    updateSkyPos(cam.position, state.T);
    updateCSM();

    aUpd();
    hudUpd();
    fxDraw();
    const speedKmh = Math.hypot(P.vx, P.vz) * 3.6;
    const lateralG = (P.yr * P.spd) / 9.81;
    renderWorld(state.T, speedKmh, lateralG, set.wx == 3, dt);
    updateDebugOverlay(dt);
  }

  // ---------- estado inicial
  resize();
  qual();
  applyEnv(true);
  show('menu');
  startDrive();
  resetFx();
  setCar();
  TR.forEach(t => { t.o.root.visible = false; });
  requestAnimationFrame(loop);
}

boot();
