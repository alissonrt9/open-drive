/* global THREE */

import { $, TAU, cl, lp, sm, rnd, TOD, BIOMES, set, state, P, biome } from './config.js';

// ---------- funções matemáticas do mundo (rodovia principal, bioma e relevo multifractal)
export const cx = z => Math.sin(z / 320) * 90 + Math.sin(z / 157 + 1.3) * 19 + Math.sin(z / 1100) * 110;
export const ry = z => Math.sin(z / 260) * 2.2 + Math.sin(z / 731) * 5;
export const zone = z => 0.5 + 0.5 * Math.sin(z / 2600 + 1);

function hash2D(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function vnoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return lp(lp(a, b, ux), lp(c, d, ux), uz);
}

function fbm2D(x, z, octaves = 3) {
  let v = 0;
  let amp = 0.5;
  let freq = 1.0;
  let px = x;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    v += amp * vnoise2D(px * freq, pz * freq);
    const nx = px * 0.8 - pz * 0.6;
    const nz = px * 0.6 + pz * 0.8;
    px = nx + 17.3;
    pz = nz + 9.7;
    freq *= 2.04;
    amp *= 0.5;
  }
  return v;
}

function ridged2D(x, z, octaves = 3) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1.0;
  let weight = 1.0;
  let px = x;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    const n = vnoise2D(px * freq, pz * freq);
    let signal = 1.0 - Math.abs(n * 2.0 - 1.0);
    signal = signal * signal * weight;
    weight = cl(signal * 1.85, 0.0, 1.0);
    sum += signal * amp;
    const nx = px * 0.8 - pz * 0.6;
    const nz = px * 0.6 + pz * 0.8;
    px = nx + 23.1;
    pz = nz - 14.9;
    freq *= 2.12;
    amp *= 0.48;
  }
  return sum;
}

export function th(x, z, o) {
  const ao = Math.abs(o);
  const bIdx = set.biome || 0;
  const shoulder = sm(8.5, 12.6, ao);
  const ditch = -Math.sin(cl((ao - 10.0) / 7.2, 0, 1) * Math.PI) * 0.44 * sm(9.4, 12.2, ao);
  let e = cl((ao - 16) / 290, 0, 1);
  e = e * e * (2.15 - 1.15 * e);

  const zn = zone(z);
  const ridgeVal = ridged2D(x * 0.0024, z * 0.0024, 3);
  const valleyVal = fbm2D(x * 0.0038 + 4.1, z * 0.0038 - 2.7, 3);

  // Cidade: bacia urbana plana ao longo da via expressa para sustentar arranha-céus e postes
  if (bIdx === 2) {
    const urbanFlat = sm(175, 420, ao);
    const farHills = urbanFlat * e * (18 + zn * 90) * valleyVal * 0.72;
    const sidewalkCurb = sm(9.2, 11.2, ao) * 0.16;
    return sidewalkCurb - 0.10 * shoulder + farHills;
  }

  // Deserto Dourado: dunas onduladas suaves + platôs/cânions escalonados ao longe
  if (bIdx === 1) {
    const dunes = (Math.sin(x * 0.026 + z * 0.015) * 0.55 + Math.cos(x * 0.014 - z * 0.022) * 0.45) * 4.8 * sm(14, 70, ao);
    const mesaRaw = cl(ridgeVal * 1.1, 0, 1);
    const mesa = Math.floor(mesaRaw * 4.2) / 4.2 + cl((mesaRaw * 4.2) % 1, 0, 0.25) * 0.18;
    const canyonMacro = e * (16 + zn * 165) * lp(valleyVal * 0.75, mesa, cl(zn * 1.15, 0, 1)) * 0.85;
    return shoulder * -0.09 + ditch * 0.6 + dunes + canyonMacro;
  }

  // Montanhas Nevadas: picos alpinos mais altos e dramáticos
  if (bIdx === 4) {
    const mountainMix = cl(0.35 + zn * 0.85, 0, 1);
    const terrainShape = lp(valleyVal * 0.9, ridgeVal * 1.32, mountainMix);
    const macro = e * (36 + zn * 255) * terrainShape * 0.88;
    const midUndulation = (fbm2D(x * 0.018, z * 0.018, 2) - 0.45) * 8.5 * sm(14, 52, ao);
    const micro = (Math.sin(x * 0.068 + z * 0.044) * 0.42 + Math.cos(x * 0.14 - z * 0.095) * 0.22) * sm(11, 34, ao);
    return shoulder * -0.09 + ditch + macro + midUndulation + micro;
  }

  // Santuário Sakura: encostas suaves e harmônicas
  if (bIdx === 3) {
    const terrainShape = lp(valleyVal * 0.88, ridgeVal * 0.95, cl(zn * 0.9, 0, 1));
    const macro = e * (18 + zn * 150) * terrainShape * 0.76;
    const midUndulation = (fbm2D(x * 0.016, z * 0.016, 2) - 0.46) * 5.8 * sm(14, 52, ao);
    const micro = Math.sin(x * 0.06 + z * 0.04) * 0.35 * sm(11, 34, ao);
    return shoulder * -0.09 + ditch * 0.8 + macro + midUndulation + micro;
  }

  // Vale Alpino (padrão refinado)
  const mountainMix = cl(zn * 1.12, 0, 1);
  const terrainShape = lp(valleyVal * 0.85, ridgeVal * 1.15, mountainMix);
  const macro = e * (22 + zn * 210) * terrainShape * 0.82;
  const midUndulation = (fbm2D(x * 0.018, z * 0.018, 2) - 0.45) * 7.5 * sm(14, 52, ao);
  const micro = (Math.sin(x * 0.068 + z * 0.044) * 0.48 + Math.cos(x * 0.14 - z * 0.095) * 0.24) * sm(11, 34, ao);
  return shoulder * -0.09 + ditch + macro + midUndulation + micro;
}

export function getGroundY(x, z) {
  const c0 = cx(z);
  const y0 = ry(z);
  const o = x - c0;
  const ao = Math.abs(o);
  if (ao <= 8.5) return y0 + 0.06;
  const groundY = y0 + th(x, z, o);
  if (ao < 9.6) {
    return lp(y0 + 0.06, groundY, sm(8.5, 9.6, ao));
  }
  return groundY;
}

// ---------- renderer PBR / cena / otimização estilo GTA V + conforto visual
export const R = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
R.outputEncoding = THREE.sRGBEncoding;
R.toneMapping = THREE.ACESFilmicToneMapping;
R.toneMappingExposure = 0.92;
R.physicallyCorrectLights = false;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;

export const S = new THREE.Scene();
export const cam = new THREE.PerspectiveCamera(50, 1, 0.2, 2900);
S.fog = new THREE.FogExp2(0x9ec0e0, 0.00034);

// ---------- Atmosfera Física Calibrada (sem estouro branco) + Nuvens FBM Otimizadas
export const sky = typeof THREE.Sky === 'function' ? new THREE.Sky() : null;
if (sky) {
  sky.scale.setScalar(2200);
  sky.frustumCulled = false;
  sky.renderOrder = -102;
  if (sky.material) {
    sky.material.depthWrite = false;
    sky.material.depthTest = false;
    const su = sky.material.uniforms;
    if (su.turbidity) su.turbidity.value = 3.2;
    if (su.rayleigh) su.rayleigh.value = 2.25;
    if (su.mieCoefficient) su.mieCoefficient.value = 0.0022;
    if (su.mieDirectionalG) su.mieDirectionalG.value = 0.74;

    // Calibração suave no shader do THREE.Sky para evitar azul estourado/branco cegante
    if (typeof sky.material.fragmentShader === 'string' && sky.material.fragmentShader.includes('gl_FragColor')) {
      su.uSoftTop = { value: new THREE.Color(0x4a7ab5) };
      su.uSoftHor = { value: new THREE.Color(0x9ec0e0) };
      su.uSoftWeight = { value: 0.42 };
      sky.material.fragmentShader = sky.material.fragmentShader
        .replace(
          'uniform vec3 sunPosition;',
          `uniform vec3 sunPosition;
          uniform vec3 uSoftTop;
          uniform vec3 uSoftHor;
          uniform float uSoftWeight;`
        )
        .replace(
          /gl_FragColor\s*=\s*vec4\(\s*retColor\s*,\s*1\.0\s*\)\s*;/,
          `vec3 skyDirNorm = normalize( vWorldPosition - cameraPosition );
          float skyElev = clamp( skyDirNorm.y, 0.0, 1.0 );
          vec3 restfulSky = mix( uSoftHor, uSoftTop, pow( skyElev, 0.56 ) );
          vec3 dampedSky = min( retColor, vec3( 0.88 ) );
          vec3 finalSky = mix( dampedSky, restfulSky, uSoftWeight );
          gl_FragColor = vec4( finalSky, 1.0 );`
        );
      sky.material.needsUpdate = true;
    }
  }
  S.add(sky);
}

export const dm = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: false,
  fog: false,
  uniforms: {
    top: { value: new THREE.Color(0x4a7ab5) },
    hor: { value: new THREE.Color(0x9ec0e0) },
    bot: { value: new THREE.Color(0x3a4d63) },
    sc: { value: new THREE.Color(0xfff5e6) },
    sd: { value: new THREE.Vector3(0, 1, 0) },
    sg: { value: 1 },
    cld: { value: 0.35 },
    tm: { value: 0 }
  },
  vertexShader: 'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
  fragmentShader: `
  uniform vec3 top,hor,bot,sc,sd;uniform float sg,cld,tm;varying vec3 d;
  void main(){
    vec3 n=normalize(d);float h=n.y;
    vec3 c=h>0.0?mix(hor,top,pow(h,0.52)):mix(hor,bot,pow(-h,0.38));
    float s=max(dot(n,normalize(sd)),0.0);
    float halo=pow(1.0-abs(h),5.0)*pow(s,2.4)*0.24*sg;
    c+=sc*(pow(s,950.0)*1.8+pow(s,18.0)*0.14*sg+halo);
    gl_FragColor=vec4(c,1.0);
  }`
});

export const dome = new THREE.Mesh(new THREE.SphereGeometry(2050, 24, 12), dm);
dome.renderOrder = -101;
dome.frustumCulled = false;
dome.visible = !sky;
S.add(dome);

// Cúpula de nuvens FBM rápida (3 oitavas, tom suave para conforto visual)
const cloudMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  fog: false,
  toneMapped: false,
  uniforms: {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 0.7, -0.7) },
    uSunCol: { value: new THREE.Color(0xfff5e6) },
    uSkyHor: { value: new THREE.Color(0x9ec0e0) },
    uSkyTop: { value: new THREE.Color(0x4a7ab5) },
    uCoverage: { value: 0.38 },
    uNight: { value: 0.0 }
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position.z = gl_Position.w;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunCol;
    uniform vec3 uSkyHor;
    uniform vec3 uSkyTop;
    uniform float uCoverage;
    uniform float uNight;
    varying vec3 vDir;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    float fbm3(vec2 p) {
      float v = 0.0;
      float a = 0.52;
      mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p = rot * p * 2.06 + vec2(13.7, 7.2);
        a *= 0.48;
      }
      return v;
    }

    void main() {
      vec3 d = normalize(vDir);
      if (d.y < 0.02) discard;

      vec2 proj = d.xz / (d.y + 0.18);
      vec2 wind = vec2(uTime * 0.0085, uTime * 0.0038);
      float baseFbm = fbm3(proj * 1.18 + wind);
      float detail = noise(proj * 4.2 - wind * 1.5);
      float densityRaw = baseFbm * 0.78 + detail * 0.22;

      float thr = mix(0.66, 0.36, clamp(uCoverage, 0.0, 1.0));
      float cloudAlpha = smoothstep(thr, thr + 0.26, densityRaw) * smoothstep(0.02, 0.17, d.y);
      if (cloudAlpha < 0.005) discard;

      vec3 sDir = normalize(uSunDir);
      vec2 sunStep = sDir.xz / max(0.25, sDir.y + 0.35) * 0.12;
      float shadowSample = fbm3((proj + sunStep) * 1.18 + wind);
      float selfShadow = clamp(1.0 - (shadowSample - baseFbm) * 2.2, 0.40, 1.0);

      float sunDot = max(dot(d, sDir), 0.0);
      float silverLining = pow(sunDot, 10.0) * (1.0 - cloudAlpha * 0.45) * 0.52;
      float forwardScatter = pow(sunDot, 3.0) * 0.20;

      vec3 ambientCloud = mix(uSkyHor * 0.76, uSkyTop * 0.58 + vec3(0.24), 0.55);
      vec3 litCloud = mix(ambientCloud, min(uSunCol * 0.92 + vec3(0.14), vec3(0.88)), selfShadow * 0.65 + forwardScatter);
      litCloud += uSunCol * silverLining * (1.0 - uNight * 0.78);
      if (uNight > 0.5) litCloud *= 0.26;

      float horizonFade = smoothstep(0.02, 0.14, d.y);
      gl_FragColor = vec4(litCloud, cloudAlpha * horizonFade * mix(0.65, 0.85, uCoverage));
    }
  `
});

export const cloudDome = new THREE.Mesh(new THREE.SphereGeometry(1950, 24, 12), cloudMat);
cloudDome.renderOrder = -99;
cloudDome.frustumCulled = false;
S.add(cloudDome);

// Cena de captura PMREMGenerator com reflexão PBR equilibrada
const ES = new THREE.Scene();
const esSky = typeof THREE.Sky === 'function' ? new THREE.Sky() : null;
if (esSky) {
  esSky.scale.setScalar(100);
  if (esSky.material && esSky.material.uniforms) {
    esSky.material.uniforms.turbidity.value = 3.4;
    esSky.material.uniforms.rayleigh.value = 2.1;
    esSky.material.uniforms.mieCoefficient.value = 0.0028;
    esSky.material.uniforms.mieDirectionalG.value = 0.76;
  }
  ES.add(esSky);
}
const esSkyMat = new THREE.MeshBasicMaterial({ color: 0x7ea7d4, side: THREE.BackSide });
const esSkyFallback = new THREE.Mesh(new THREE.SphereGeometry(40, 14, 7), esSkyMat);
esSkyFallback.visible = !esSky;
ES.add(esSkyFallback);

const esGroundMat = new THREE.MeshBasicMaterial({ color: 0x26381b, side: THREE.DoubleSide });
const esGroundDisc = new THREE.Mesh(new THREE.CircleGeometry(45, 16), esGroundMat);
esGroundDisc.rotation.x = -Math.PI / 2;
esGroundDisc.position.y = -1.5;
ES.add(esGroundDisc);

const esSunMat = new THREE.MeshBasicMaterial({ color: 0xfff5e6 });
const esSunDisc = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 6), esSunMat);
ES.add(esSunDisc);

const PM = new THREE.PMREMGenerator(R);
let envT = null;

const stG = new THREE.BufferGeometry();
const sp = new Float32Array(2100);
for (let i = 0; i < 700; i++) {
  const a = Math.random() * TAU;
  const b = Math.acos(Math.random() * 0.96);
  const r = 1800;
  sp.set([Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r], i * 3);
}
stG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
export const stars = new THREE.Points(
  stG,
  new THREE.PointsMaterial({ size: 2.0, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, opacity: 0 })
);
stars.frustumCulled = false;
stars.renderOrder = -98;
S.add(stars);

// Iluminação física calibrada (confortável aos olhos, sem estouro)
export const hemi = new THREE.HemisphereLight(0x8bb8e6, 0x242e1c, 0.62);
export const sun = new THREE.DirectionalLight(0xfff4e2, 2.25);
export const amb = new THREE.AmbientLight(0xffffff, 0.14);
S.add(hemi, sun, sun.target, amb);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 10, far: 220 });
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.024;

export const spot = new THREE.SpotLight(0xfff1d6, 0, 195, 0.56, 0.65, 1.15);
export const headFill = new THREE.PointLight(0xffe9c4, 0, 58, 1.35);
S.add(spot, spot.target, headFill);
export const sdir = new THREE.Vector3(0, 1, 0);

// ---------- Pós-processamento estilo Forza (ativado somente no modo Alta)
export const ForzaFilmicCameraShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uSpeedNorm: { value: 0.0 },
    uGForce: { value: 0.0 },
    uTime: { value: 0.0 },
    uWet: { value: 0.0 },
    uExposure: { value: 0.92 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uSpeedNorm;
    uniform float uGForce;
    uniform float uTime;
    uniform float uWet;
    uniform float uExposure;
    varying vec2 vUv;

    vec3 acesFilmic(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 sampleScene(vec2 uv) {
      return texture2D(tDiffuse, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
    }

    void main() {
      vec2 toCenter = vUv - vec2(0.5);
      float dist = length(toCenter);
      vec2 dir = dist > 0.0001 ? toCenter / dist : vec2(0.0);
      float edgeFactor = smoothstep(0.20, 0.80, dist);

      float caStrength = (uSpeedNorm * 0.0020 + min(abs(uGForce), 1.8) * 0.00045 * uSpeedNorm) * (dist * dist * 2.0);
      vec2 caOffset = dir * caStrength;

      vec3 col;
      if (uSpeedNorm > 0.01) {
        float blurAmp = uSpeedNorm * edgeFactor * 0.016;
        vec3 accR = vec3(0.0);
        vec3 accG = vec3(0.0);
        vec3 accB = vec3(0.0);
        for (int i = 0; i < 6; i++) {
          float fi = float(i) / 5.0;
          vec2 tapUv = vUv - dir * (fi * blurAmp);
          accR.r += sampleScene(tapUv + caOffset).r;
          accG.g += sampleScene(tapUv).g;
          accB.b += sampleScene(tapUv - caOffset).b;
        }
        col = vec3(accR.r, accG.g, accB.b) / 6.0;
      } else {
        col = sampleScene(vUv);
      }

      col = max(col, vec3(0.0)) * uExposure;
      col = acesFilmic(col);

      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, 1.04 + uWet * 0.03);
      col += vec3(-0.006, 0.0, 0.010) * (1.0 - lum) * 0.35;
      col += vec3(0.008, 0.004, -0.004) * lum * 0.25;

      float vig = 1.0 - smoothstep(0.45, 0.96, dist) * (0.16 + uSpeedNorm * 0.10);
      col *= vig;
      col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export let composer = null;
export let renderPass = null;
export let bloomPass = null;
export let forzaPass = null;

if (typeof THREE.EffectComposer === 'function' && typeof THREE.RenderPass === 'function' && typeof THREE.ShaderPass === 'function') {
  const isWebGL2 = !!(R.capabilities && R.capabilities.isWebGL2);
  let rt;
  if (isWebGL2 && typeof THREE.WebGLMultisampleRenderTarget === 'function') {
    rt = new THREE.WebGLMultisampleRenderTarget(Math.max(1, innerWidth), Math.max(1, innerHeight), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType || THREE.UnsignedByteType
    });
    rt.samples = 4;
  } else {
    rt = new THREE.WebGLRenderTarget(Math.max(1, innerWidth), Math.max(1, innerHeight), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: isWebGL2 && THREE.HalfFloatType ? THREE.HalfFloatType : THREE.UnsignedByteType
    });
  }
  composer = new THREE.EffectComposer(R, rt);
  renderPass = new THREE.RenderPass(S, cam);
  composer.addPass(renderPass);

  if (typeof THREE.UnrealBloomPass === 'function') {
    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(innerWidth * 0.5)), Math.max(1, Math.floor(innerHeight * 0.5))),
      0.22,
      0.55,
      0.92
    );
    composer.addPass(bloomPass);
  }

  forzaPass = new THREE.ShaderPass(ForzaFilmicCameraShader);
  if (forzaPass.material) forzaPass.material.toneMapped = false;
  forzaPass.renderToScreen = true;
  composer.addPass(forzaPass);
}

export function resizeComposer(w, h, pr) {
  if (!composer) return;
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  if (bloomPass) bloomPass.setSize(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
  if (forzaPass && forzaPass.uniforms.uResolution) {
    forzaPass.uniforms.uResolution.value.set(w * pr, h * pr);
  }
}

// ---------- Terreno com espaçamento progressivo (140 faixas)
const NR = 140;
const ROW_Z = new Float32Array(NR);
{
  let accZ = 78;
  for (let r = 0; r < NR; r++) {
    ROW_Z[r] = accZ;
    const t = r / (NR - 1);
    const dz = t < 0.25 ? 6.5 : lp(6.5, 26.0, Math.pow((t - 0.25) / 0.75, 1.35));
    accZ -= dz;
  }
}

const GO = [
  -2200, -1400, -860, -520, -320, -210, -145,
  -115, -92, -74, -58, -45, -34, -25, -18, -13.2, -9.8, -8.5,
  8.5, 9.8, 13.2, 18, 25, 34, 45, 58, 74, 92, 115,
  145, 210, 320, 520, 860, 1400, 2200
];
const GC = GO.length;

function ribbon(C, mat) {
  const g = new THREE.BufferGeometry();
  const n = NR * C;
  const idx = [];
  for (let r = 0; r < NR - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c;
      const b = a + 1;
      const d = a + C;
      const e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) nor[i * 3 + 1] = 1;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  S.add(m);
  return { m, g, pos, col, uv };
}

function prepTex(tex, srgb = true) {
  if (srgb) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = Math.min(16, R.capabilities.getMaxAnisotropy());
  if (THREE.LinearMipmapLinearFilter) tex.minFilter = THREE.LinearMipmapLinearFilter;
  if (THREE.LinearFilter) tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function roadTex() {
  const W = 2048;
  const H = 1024;
  const cAlb = document.createElement('canvas');
  const cRgh = document.createElement('canvas');
  const cBmp = document.createElement('canvas');
  cAlb.width = cRgh.width = cBmp.width = W;
  cAlb.height = cRgh.height = cBmp.height = H;

  const xa = cAlb.getContext('2d');
  const xr = cRgh.getContext('2d');
  const xb = cBmp.getContext('2d');
  const u = o => (o + 9.6) / 19.2 * W;

  xa.fillStyle = '#292e36';
  xa.fillRect(0, 0, W, H);
  xr.fillStyle = 'rgb(208,208,208)';
  xr.fillRect(0, 0, W, H);
  xb.fillStyle = 'rgb(128,128,128)';
  xb.fillRect(0, 0, W, H);

  const gL = xa.createLinearGradient(0, 0, u(-8.1), 0);
  gL.addColorStop(0, '#5a5042');
  gL.addColorStop(0.62, '#413b33');
  gL.addColorStop(1, 'rgba(41,46,54,0)');
  xa.fillStyle = gL;
  xa.fillRect(0, 0, u(-8.1), H);

  const gR = xa.createLinearGradient(u(8.1), 0, W, 0);
  gR.addColorStop(0, 'rgba(41,46,54,0)');
  gR.addColorStop(0.38, '#413b33');
  gR.addColorStop(1, '#5a5042');
  xa.fillStyle = gR;
  xa.fillRect(u(8.1), 0, W - u(8.1), H);

  xr.fillStyle = 'rgb(242,242,242)';
  xr.fillRect(0, 0, u(-8.3), H);
  xr.fillRect(u(8.3), 0, W - u(8.3), H);

  for (let i = 0; i < 42000; i++) {
    const px = Math.random() * W;
    const py = Math.random() * H;
    const sw = 1.6 + Math.random() * 2.4;
    const sh = 1.4 + Math.random() * 2.0;
    const tone = 34 + (Math.random() * 19 | 0);
    const hi = Math.random() < 0.12 ? 12 : 0;
    const v = tone + hi;
    xa.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    xa.fillRect(px, py, sw, sh);

    const b = 104 + (Math.random() * 48 | 0);
    xb.fillStyle = `rgb(${b},${b},${b})`;
    xb.fillRect(px, py, sw, sh);

    const r = 178 + (Math.random() * 54 | 0);
    xr.fillStyle = `rgb(${r},${r},${r})`;
    xr.fillRect(px, py, sw, sh);
  }

  for (let i = 0; i < 30; i++) {
    const px = u(-7.6 + Math.random() * 15.2);
    const py = Math.random() * H;
    const rw = 32 + Math.random() * 80;
    const rh = 48 + Math.random() * 150;
    xa.fillStyle = i % 2 ? 'rgba(58,64,74,0.14)' : 'rgba(18,21,26,0.20)';
    xa.fillRect(px, py, rw, rh);
    xr.fillStyle = i % 2 ? 'rgba(176,176,176,0.22)' : 'rgba(144,144,144,0.26)';
    xr.fillRect(px, py, rw, rh);
  }

  for (let i = 0; i < 10; i++) {
    let cxp = u(-7.1 + Math.random() * 14.2);
    let cyp = Math.random() * H;
    const segs = 5 + (Math.random() * 5 | 0);
    xa.strokeStyle = 'rgba(16,18,22,0.55)';
    xa.lineWidth = 2.4;
    xr.strokeStyle = 'rgb(112,112,112)';
    xr.lineWidth = 2.8;
    xb.strokeStyle = 'rgb(92,92,92)';
    xb.lineWidth = 2.2;

    [xa, xr, xb].forEach(ctx => { ctx.beginPath(); ctx.moveTo(cxp, cyp); });
    for (let s = 0; s < segs; s++) {
      cxp += (Math.random() - 0.5) * 34;
      cyp += 14 + Math.random() * 24;
      [xa, xr, xb].forEach(ctx => ctx.lineTo(cxp, cyp));
    }
    [xa, xr, xb].forEach(ctx => ctx.stroke());
  }

  const tr = (o, w) => {
    const a = u(o);
    const g = xa.createLinearGradient(a - w, 0, a + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(12,14,18,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    xa.fillStyle = g;
    xa.fillRect(a - w, 0, w * 2, H);

    const gr = xr.createLinearGradient(a - w, 0, a + w, 0);
    gr.addColorStop(0, 'rgba(145,145,145,0)');
    gr.addColorStop(0.5, 'rgba(122,122,122,0.56)');
    gr.addColorStop(1, 'rgba(145,145,145,0)');
    xr.fillStyle = gr;
    xr.fillRect(a - w, 0, w * 2, H);
  };
  [-5.6, -1.9, 1.9, 5.6].forEach(o => {
    tr(o - 0.85, 64);
    tr(o + 0.85, 64);
  });

  xa.fillStyle = 'rgba(16,18,22,0.5)';
  xb.fillStyle = 'rgb(68,68,68)';
  for (let y = 0; y < H; y += 20) {
    xa.fillRect(u(-7.95), y, 32, 7);
    xa.fillRect(u(7.65), y, 32, 7);
    xb.fillRect(u(-7.95), y, 32, 7);
    xb.fillRect(u(7.65), y, 32, 7);
  }

  const paintLine = (px, py, pw, ph, rgb) => {
    const g = xa.createLinearGradient(px - 1.5, 0, px + pw + 1.5, 0);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.14, `rgba(${rgb},0.96)`);
    g.addColorStop(0.86, `rgba(${rgb},0.96)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    xa.fillStyle = g;
    xa.fillRect(px - 1.5, py, pw + 3, ph);
    xr.fillStyle = 'rgb(126,126,126)';
    xr.fillRect(px, py, pw, ph);
    xb.fillStyle = 'rgb(166,166,166)';
    xb.fillRect(px, py, pw, ph);
  };
  paintLine(u(-7.42), 0, 15, H, '244,244,238');
  paintLine(u(7.42) - 15, 0, 15, H, '244,244,238');
  paintLine(u(-0.17), 0, 11, H, '255,202,40');
  paintLine(u(0.17) - 11, 0, 11, H, '255,202,40');
  [-3.75, 3.75].forEach(o => {
    paintLine(u(o) - 6, 48, 12, 360, '244,244,240');
    paintLine(u(o) - 6, 560, 12, 360, '244,244,240');
  });

  const map = prepTex(new THREE.CanvasTexture(cAlb), true);
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const roughnessMap = prepTex(new THREE.CanvasTexture(cRgh), false);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = prepTex(new THREE.CanvasTexture(cBmp), false);
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, bumpMap };
}

export function terrainTex() {
  const S512 = 512;
  const c = document.createElement('canvas');
  c.width = S512;
  c.height = S512;
  const x = c.getContext('2d');
  x.fillStyle = '#4e6338';
  x.fillRect(0, 0, S512, S512);

  for (let i = 0; i < 480; i++) {
    const r = 8 + Math.random() * 26;
    const px = Math.random() * S512;
    const py = Math.random() * S512;
    const p = Math.random();
    const rr = lp(58, 102, p) | 0;
    const gg = lp(84, 124, p) | 0;
    const bb = lp(38, 66, p) | 0;
    x.fillStyle = `rgba(${rr},${gg},${bb},0.32)`;
    x.beginPath();
    x.arc(px, py, r, 0, TAU);
    x.fill();
  }

  for (let i = 0; i < 18000; i++) {
    const px = Math.random() * S512;
    const py = Math.random() * S512;
    const t = Math.random();
    const rr = lp(62, 112, t) | 0;
    const gg = lp(88, 134, t) | 0;
    const bb = lp(40, 72, t) | 0;
    x.fillStyle = `rgb(${rr},${gg},${bb})`;
    x.fillRect(px, py, 2.5, 2.5);
  }

  const tex = prepTex(new THREE.CanvasTexture(c), true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  return tex;
}

const rMaps = roadTex();
const roadM = new THREE.MeshStandardMaterial({
  map: rMaps.map,
  color: 0xffffff,
  bumpMap: rMaps.bumpMap,
  bumpScale: 0.032,
  roughnessMap: rMaps.roughnessMap,
  roughness: 0.74,
  metalness: 0.0,
  envMapIntensity: 0.36
});

const tTex = terrainTex();
const terrainUniforms = {
  uWetTerrain: { value: 0.0 },
  uBiome: { value: set.biome || 0 }
};

// Material do terreno multi-bioma com filtragem anti-serrilhada por distância
const groundM = new THREE.MeshStandardMaterial({
  vertexColors: true,
  bumpMap: tTex,
  bumpScale: 0.28,
  roughness: 0.92,
  metalness: 0.0,
  envMapIntensity: 0.14
});

groundM.onBeforeCompile = shader => {
  shader.uniforms.uWetTerrain = terrainUniforms.uWetTerrain;
  shader.uniforms.uBiome = terrainUniforms.uBiome;

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uWetTerrain;
      uniform float uBiome;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float trHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float trNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(trHash(i), trHash(i + vec2(1.0, 0.0)), f.x),
          mix(trHash(i + vec2(0.0, 1.0)), trHash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float trFbm2(vec2 p) {
        return trNoise(p) * 0.65 + trNoise(p * 2.13 + vec2(11.3, 5.7)) * 0.35;
      }
      float roadCenterX(float z) {
        return sin(z / 320.0) * 90.0 + sin(z / 157.0 + 1.3) * 19.0 + sin(z / 1100.0) * 110.0;
      }`
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 wNorm = normalize(vWorldNormal);
      float slopeY = clamp(wNorm.y, 0.0, 1.0);
      float distToRoad = abs(vWorldPos.x - roadCenterX(vWorldPos.z));
      float camDist = length(vWorldPos - cameraPosition);
      float microAtten = smoothstep(125.0, 18.0, camDist);
      float midAtten   = smoothstep(680.0, 95.0, camDist);

      float nMicro = mix(0.5, trNoise(vWorldPos.xz * 1.45), microAtten);
      float nMid   = mix(0.5, trFbm2(vWorldPos.xz * 0.14), midAtten);
      float nMacro = trFbm2(vWorldPos.xz * 0.022);

      vec3 blendW = pow(abs(wNorm), vec3(4.0));
      blendW /= max(dot(blendW, vec3(1.0)), 0.0001);
      float triNoise = mix(0.5, trNoise(vWorldPos.zy * 0.19) * blendW.x + nMid * blendW.y + trNoise(vWorldPos.xy * 0.19) * blendW.z, midAtten);

      vec3 finalTerrain;
      if (uBiome < 0.5) {
        // 0: Vale Alpino
        vec3 colForest = vec3(0.017, 0.052, 0.009);
        vec3 colOlive  = vec3(0.048, 0.098, 0.018);
        vec3 colDry    = vec3(0.135, 0.112, 0.032);
        vec3 colDirt   = vec3(0.088, 0.068, 0.044);
        vec3 colGravel = vec3(0.106, 0.096, 0.076);
        vec3 colRockA  = vec3(0.056, 0.060, 0.068);
        vec3 colRockB  = vec3(0.112, 0.082, 0.058);

        float meadowMix = smoothstep(0.28, 0.72, nMacro * 0.65 + nMid * 0.35);
        vec3 grassCol = mix(colForest, colOlive, meadowMix);
        float dryMask = smoothstep(0.55, 0.84, nMid * 0.58 + nMacro * 0.42);
        grassCol = mix(grassCol, colDry, dryMask * 0.78);
        grassCol *= mix(0.84, 1.16, nMicro);

        float gravelMask = 1.0 - smoothstep(8.7, 11.4, distToRoad);
        float dirtMask = (1.0 - smoothstep(10.0, 15.0, distToRoad)) * smoothstep(0.32, 0.72, nMid + nMicro * 0.2);
        vec3 fieldCol = mix(grassCol, colDirt, dirtMask * 0.76);
        fieldCol = mix(fieldCol, colGravel, gravelMask * 0.86);

        float strata = sin(vWorldPos.y * 1.45 + triNoise * 4.0) * 0.5 + 0.5;
        vec3 cliffCol = mix(colRockA, colRockB, strata * 0.72 + triNoise * 0.28) * mix(0.80, 1.20, nMicro * 0.4 + triNoise * 0.6);
        finalTerrain = mix(fieldCol, cliffCol, smoothstep(0.78, 0.64, slopeY));
      } else if (uBiome < 1.5) {
        // 1: Deserto Dourado (Dunas & Cânions Terracota #b87344 / #8c4a27)
        vec3 colSandLight = vec3(0.34, 0.21, 0.095);
        vec3 colSandWarm  = vec3(0.26, 0.145, 0.065);
        vec3 colTerracotta = vec3(0.24, 0.105, 0.042);
        vec3 colCanyonDark = vec3(0.145, 0.055, 0.024);
        vec3 colRoadDust  = vec3(0.29, 0.19, 0.098);

        float ripple = sin(vWorldPos.x * 0.65 + vWorldPos.z * 0.35 + nMid * 4.5) * 0.5 + 0.5;
        vec3 sandCol = mix(colSandWarm, colSandLight, smoothstep(0.25, 0.78, nMacro * 0.6 + ripple * 0.4));
        sandCol *= mix(0.88, 1.12, nMicro);

        float dustMask = 1.0 - smoothstep(8.6, 13.5, distToRoad);
        vec3 desertGround = mix(sandCol, colRoadDust, dustMask * 0.82);

        float strata = sin(vWorldPos.y * 1.85 + triNoise * 3.5) * 0.5 + 0.5;
        vec3 canyonCol = mix(colCanyonDark, colTerracotta, strata * 0.78 + triNoise * 0.22) * mix(0.84, 1.16, nMicro * 0.4 + triNoise * 0.6);
        float cliffMask = smoothstep(0.82, 0.66, slopeY);
        finalTerrain = mix(desertGround, canyonCol, cliffMask);
      } else if (uBiome < 2.5) {
        // 2: Cidade / Metrópole Costeira
        vec3 colConcrete = vec3(0.072, 0.078, 0.088);
        vec3 colSidewalk = vec3(0.115, 0.122, 0.132);
        vec3 colParkGrass = vec3(0.026, 0.064, 0.022);
        vec3 colHarborRock = vec3(0.055, 0.062, 0.075);

        float gridX = abs(fract(vWorldPos.x * 0.04) - 0.5);
        float gridZ = abs(fract(vWorldPos.z * 0.04) - 0.5);
        float blockCheck = step(0.36, max(gridX, gridZ));
        float parkPatch = smoothstep(0.62, 0.82, nMacro);
        vec3 urbanFloor = mix(colConcrete, colSidewalk, 1.0 - smoothstep(8.6, 14.0, distToRoad));
        urbanFloor = mix(urbanFloor, colParkGrass, parkPatch * (1.0 - blockCheck) * smoothstep(14.0, 26.0, distToRoad) * 0.75);
        urbanFloor *= mix(0.90, 1.10, nMicro);
        finalTerrain = mix(urbanFloor, colHarborRock, smoothstep(0.82, 0.65, slopeY));
      } else if (uBiome < 3.5) {
        // 3: Santuário Sakura
        vec3 colMoss     = vec3(0.026, 0.064, 0.018);
        vec3 colLawn     = vec3(0.052, 0.095, 0.028);
        vec3 colPetal    = vec3(0.32, 0.125, 0.195);
        vec3 colPath     = vec3(0.096, 0.092, 0.088);
        vec3 colShrineRock = vec3(0.068, 0.072, 0.082);

        vec3 baseTurf = mix(colMoss, colLawn, smoothstep(0.3, 0.75, nMacro * 0.6 + nMid * 0.4));
        float petalPatch = smoothstep(0.56, 0.86, nMid * 0.65 + nMicro * 0.35);
        baseTurf = mix(baseTurf, colPetal, petalPatch * 0.44);
        baseTurf *= mix(0.86, 1.14, nMicro);

        float gravelMask = 1.0 - smoothstep(8.7, 11.8, distToRoad);
        vec3 shrineGround = mix(baseTurf, colPath, gravelMask * 0.84);
        finalTerrain = mix(shrineGround, colShrineRock, smoothstep(0.78, 0.63, slopeY));
      } else {
        // 4: Montanhas Nevadas (tons azul-acinzentados suaves calibrados para NUNCA estourar o branco)
        vec3 colSnowSoft  = vec3(0.34, 0.39, 0.46);
        vec3 colSnowShade = vec3(0.24, 0.29, 0.37);
        vec3 colSlush     = vec3(0.11, 0.125, 0.145);
        vec3 colGraniteA  = vec3(0.048, 0.054, 0.066);
        vec3 colGraniteB  = vec3(0.088, 0.096, 0.112);

        vec3 snowCol = mix(colSnowShade, colSnowSoft, smoothstep(0.25, 0.78, nMid * 0.55 + nMacro * 0.45));
        snowCol *= mix(0.92, 1.08, nMicro);

        float slushMask = 1.0 - smoothstep(8.6, 12.2, distToRoad);
        vec3 winterGround = mix(snowCol, colSlush, slushMask * 0.88);

        float strata = sin(vWorldPos.y * 1.6 + triNoise * 4.0) * 0.5 + 0.5;
        vec3 cliffCol = mix(colGraniteA, colGraniteB, strata * 0.65 + triNoise * 0.35);
        float cliffMask = smoothstep(0.76, 0.60, slopeY);
        finalTerrain = mix(winterGround, cliffCol, cliffMask);
      }

      if (uWetTerrain > 0.5) finalTerrain *= 0.80;
      diffuseColor.rgb = finalTerrain;`
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      float rSlope = clamp(normalize(vWorldNormal).y, 0.0, 1.0);
      float rCamDist = length(vWorldPos - cameraPosition);
      float rMicro = mix(0.5, trNoise(vWorldPos.xz * 1.45), smoothstep(125.0, 18.0, rCamDist));
      float rCliff = smoothstep(0.78, 0.64, rSlope);
      float terrainRough = mix(0.88, 0.96, rMicro);
      terrainRough = mix(terrainRough, mix(0.78, 0.90, rMicro), rCliff);
      if (uWetTerrain > 0.5 || uBiome > 3.5) terrainRough = mix(terrainRough, 0.60, 0.45);
      roughnessFactor = clamp(terrainRough, 0.56, 0.98);`
    );
};

const RD = ribbon(2, roadM);
const GR = ribbon(GC, groundM);
RD.m.receiveShadow = true;
GR.m.receiveShadow = true;

export function rows(pz) {
  const b = Math.floor(pz / 6.5) * 6.5;
  if (b === state.lastB) return;
  state.lastB = b;
  for (let r = 0; r < NR; r++) {
    const z = b + ROW_Z[r];
    const c0 = cx(z);
    const y0 = ry(z);

    for (let k = 0; k < 2; k++) {
      const i = r * 2 + k;
      RD.pos.set([c0 + (k ? 9.6 : -9.6), y0 + 0.06, z], i * 3);
      RD.uv[i * 2] = k;
      RD.uv[i * 2 + 1] = z / 28;
    }

    for (let k = 0; k < GC; k++) {
      const o = GO[k];
      const x = c0 + o;
      const rd = Math.abs(o) <= 8.5;
      const h = rd ? -0.09 : th(x, z, o);
      const i = r * GC + k;
      GR.pos.set([x, y0 + h, z], i * 3);
      GR.uv[i * 2] = x * 0.0025;
      GR.uv[i * 2 + 1] = z * 0.0025;
      GR.col.set([1, 1, 1], i * 3);
    }
  }
  for (const q of [RD, GR]) {
    q.g.attributes.position.needsUpdate = true;
    q.g.attributes.uv.needsUpdate = true;
  }
  GR.g.attributes.color.needsUpdate = true;
  GR.g.computeVertexNormals();
}

// ---------- Gerenciamento dinâmico de InstancedMesh por bioma (Zero Memory Leak)
const D = new THREE.Object3D();
export const IM = [];
const biomeExtraMeshes = [];
const biomeOwnedMats = [];
const biomeOwnedGeos = [];
const biomeEmissives = {
  houseWinM: null,
  catReflectorMat: null,
  kmSignMat: null,
  skyscraperBodyM: null,
  streetlightBulbM: null,
  streetlightPoolM: null,
  gantrySignM: null,
  lanternFlameM: null
};
let fujiBackdropMesh = null;

export function inst(geo, mat, n, span, fn, castSh, customDepthMat = null, zAhead = 120, isBiomeAsset = false) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.frustumCulled = false;
  m.isBiomeAsset = isBiomeAsset;
  if (castSh) {
    m.castShadow = true;
    m.receiveShadow = true;
    if (customDepthMat) m.customDepthMaterial = customDepthMat;
  } else {
    m.receiveShadow = true;
  }
  S.add(m);
  const last = new Float64Array(n).fill(1e12);
  m.reset = () => last.fill(1e12);
  m.upd = pz => {
    let ch = 0;
    for (let i = 0; i < n; i++) {
      const b = -i * span / n;
      const k = Math.floor((pz + zAhead - b) / span);
      if (k !== last[i]) {
        last[i] = k;
        D.position.set(0, -999, 0);
        D.scale.set(1, 1, 1);
        D.rotation.set(0, 0, 0);
        fn(D, i, k, b + k * span, m);
        D.updateMatrix();
        m.setMatrixAt(i, D.matrix);
        ch = 1;
      }
    }
    if (ch) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };
  IM.push(m);
  return m;
}

function trackGeo(g) {
  biomeOwnedGeos.push(g);
  return g;
}

function trackMat(m) {
  biomeOwnedMats.push(m);
  return m;
}

function mergeSimpleGeos(geos) {
  let totalV = 0;
  let totalI = 0;
  geos.forEach(g => {
    totalV += g.attributes.position.count;
    totalI += g.index ? g.index.count : g.attributes.position.count;
  });
  const pos = new Float32Array(totalV * 3);
  const nor = new Float32Array(totalV * 3);
  const uv = new Float32Array(totalV * 2);
  const idx = totalV > 65535 ? new Uint32Array(totalI) : new Uint16Array(totalI);
  let vOff = 0;
  let iOff = 0;
  geos.forEach(g => {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const u = g.attributes.uv ? g.attributes.uv.array : null;
    const vc = g.attributes.position.count;
    pos.set(p, vOff * 3);
    nor.set(n, vOff * 3);
    if (u) uv.set(u, vOff * 2);
    if (g.index) {
      const ia = g.index.array;
      for (let j = 0; j < ia.length; j++) idx[iOff + j] = ia[j] + vOff;
      iOff += ia.length;
    } else {
      for (let j = 0; j < vc; j++) idx[iOff + j] = vOff + j;
      iOff += vc;
    }
    vOff += vc;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ---------- Texturas botânicas e urbanas procedurais cacheadas (reuso entre trocas de bioma)
function pineBoughTex(snowy = false) {
  const S512 = 512;
  const c = document.createElement('canvas');
  c.width = S512;
  c.height = S512;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S512, S512);

  const drawSubTwig = (x0, y0, ang, len, depth) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;

    x.strokeStyle = depth === 0 ? '#3a2a1d' : '#4a3727';
    x.lineWidth = Math.max(1.5, 6 - depth * 2);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
    x.stroke();

    const steps = Math.floor(len / 4.2);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const bx = lp(x0, x1, t);
      const by = lp(y0, y1, t);
      const needleLen = (14 + (1 - t) * 14) * (depth === 0 ? 1.15 : 0.85);
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < 2; k++) {
          const nAng = ang + side * (0.45 + Math.random() * 0.55);
          const nx = bx + Math.cos(nAng) * needleLen * (0.7 + Math.random() * 0.45);
          const ny = by + Math.sin(nAng) * needleLen * (0.7 + Math.random() * 0.45);
          const tipLight = t > 0.62 || k === 1;
          if (snowy && t > 0.52 && Math.random() < 0.58) {
            x.strokeStyle = Math.random() < 0.5 ? '#c6d2df' : '#aab8c8';
          } else {
            x.strokeStyle = tipLight
              ? (snowy ? '#4a7054' : (Math.random() < 0.5 ? '#689948' : '#538239'))
              : (snowy ? '#243d2b' : (Math.random() < 0.5 ? '#2d5322' : '#3a662b'));
          }
          x.lineWidth = 2.6;
          x.beginPath();
          x.moveTo(bx, by);
          x.lineTo(nx, ny);
          x.stroke();
        }
      }
    }

    if (depth < 2) {
      const branches = depth === 0 ? 5 : 2;
      for (let b = 0; b < branches; b++) {
        const bt = 0.25 + (b / branches) * 0.62;
        const bx = lp(x0, x1, bt);
        const by = lp(y0, y1, bt);
        const side = b % 2 === 0 ? -1 : 1;
        drawSubTwig(bx, by, ang + side * (0.48 + Math.random() * 0.25), len * (0.58 - bt * 0.25), depth + 1);
      }
    }
  };

  drawSubTwig(256, 492, -Math.PI / 2, 430, 0);
  drawSubTwig(256, 470, -Math.PI / 2 - 0.34, 335, 1);
  drawSubTwig(256, 470, -Math.PI / 2 + 0.34, 335, 1);

  return prepTex(new THREE.CanvasTexture(c), true);
}

function leafClusterTex(mode = 'green') {
  const S512 = 512;
  const c = document.createElement('canvas');
  c.width = S512;
  c.height = S512;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S512, S512);

  const twigs = [
    [256, 490, 256, 175],
    [256, 390, 145, 220],
    [256, 360, 370, 210],
    [256, 270, 175, 115],
    [256, 255, 345, 125]
  ];
  x.strokeStyle = mode === 'sakura' ? '#432c2d' : '#3c2b1e';
  x.lineCap = 'round';
  twigs.forEach(([x0, y0, x1, y1], idx) => {
    x.lineWidth = idx === 0 ? 7 : 4.5;
    x.beginPath();
    x.moveTo(x0, y0);
    x.quadraticCurveTo((x0 + x1) * 0.5 + (idx % 2 ? 12 : -12), (y0 + y1) * 0.5, x1, y1);
    x.stroke();
  });

  const drawBlossomOrLeaf = (lx, ly, ang, lw, lh, col) => {
    x.save();
    x.translate(lx, ly);
    x.rotate(ang);
    x.fillStyle = col;
    x.beginPath();
    if (mode === 'sakura') {
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * TAU;
        x.ellipse(Math.cos(pa) * lw * 0.58, Math.sin(pa) * lw * 0.58, lw * 0.55, lw * 0.36, pa, 0, TAU);
      }
    } else {
      x.moveTo(0, 0);
      x.quadraticCurveTo(lw, -lh * 0.38, 0, -lh);
      x.quadraticCurveTo(-lw, -lh * 0.38, 0, 0);
    }
    x.fill();
    x.restore();
  };

  const palettes = mode === 'sakura'
    ? ['#dc7696', '#e588a3', '#f4a7bb', '#f8c8d8', '#fbe0e9']
    : ['#274b1e', '#366427', '#487e31', '#5c943c', '#74aa48'];

  const count = mode === 'sakura' ? 210 : 165;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const rad = Math.pow(Math.random(), 0.62) * 195;
    const lx = 256 + Math.cos(a) * rad;
    const ly = 248 + Math.sin(a) * rad * 0.96;
    const shadeIdx = cl(Math.floor((rad / 195) * 3.8 + Math.random() * 1.4), 0, palettes.length - 1);
    const sz = 14 + Math.random() * 16;
    drawBlossomOrLeaf(lx, ly, a + (Math.random() - 0.5) * 1.1, sz * 0.58, sz * 1.5, palettes[shadeIdx]);
  }

  return prepTex(new THREE.CanvasTexture(c), true);
}

function grassTuftTex() {
  const S256 = 256;
  const c = document.createElement('canvas');
  c.width = S256;
  c.height = S256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S256, S256);

  const cols = ['#2f5420', '#416c29', '#558032', '#748838', '#8d8c3e'];
  for (let i = 0; i < 68; i++) {
    const bx = 56 + Math.random() * 144;
    const h = 95 + Math.random() * 135;
    const bend = (bx - 128) * 0.65 + (Math.random() - 0.5) * 58;
    x.strokeStyle = cols[i % cols.length];
    x.lineWidth = 2.6 + Math.random() * 3.2;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(bx, 254);
    x.quadraticCurveTo(bx + bend * 0.45, 254 - h * 0.55, bx + bend, 254 - h);
    x.stroke();
  }

  return prepTex(new THREE.CanvasTexture(c), true);
}

function rockTex() {
  const S256 = 256;
  const c = document.createElement('canvas');
  c.width = S256;
  c.height = S256;
  const x = c.getContext('2d');
  x.fillStyle = '#625d56';
  x.fillRect(0, 0, S256, S256);
  for (let i = 0; i < 4800; i++) {
    const px = Math.random() * S256;
    const py = Math.random() * S256;
    const v = 64 + (Math.random() * 62 | 0);
    x.fillStyle = `rgb(${v + 6},${v + 2},${v - 4})`;
    x.fillRect(px, py, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const tex = prepTex(new THREE.CanvasTexture(c), true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function barkTex() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#412e20';
  x.fillRect(0, 0, 128, 256);

  for (let i = 0; i < 200; i++) {
    const px = Math.random() * 128;
    const py = Math.random() * 256;
    const h = 18 + Math.random() * 48;
    const w = 1.5 + Math.random() * 3.5;
    x.fillStyle = i % 3 === 0 ? '#271b13' : (i % 2 === 0 ? '#553e2b' : '#37261a');
    x.fillRect(px, py, w, h);
  }

  const t = prepTex(new THREE.CanvasTexture(c), true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Textura procedural reflexiva de fachadas de arranha-céus (janelas diurnas + brilho noturno)
function skyscraperTex() {
  const W = 256;
  const H = 512;
  const cAlb = document.createElement('canvas');
  const cEm = document.createElement('canvas');
  cAlb.width = cEm.width = W;
  cAlb.height = cEm.height = H;
  const xa = cAlb.getContext('2d');
  const xe = cEm.getContext('2d');

  xa.fillStyle = '#253242';
  xa.fillRect(0, 0, W, H);
  xe.fillStyle = '#000000';
  xe.fillRect(0, 0, W, H);

  const cols = 8;
  const rowsCnt = 24;
  const cw = W / cols;
  const ch = H / rowsCnt;
  for (let r = 0; r < rowsCnt; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * cw + 4;
      const py = r * ch + 4;
      const ww = cw - 8;
      const wh = ch - 7;
      const rndVal = rnd(c, r, 41);
      const glassTone = rndVal < 0.35 ? '#486684' : (rndVal < 0.7 ? '#344c66' : '#587898');
      xa.fillStyle = glassTone;
      xa.fillRect(px, py, ww, wh);

      if (rndVal > 0.38) {
        const warm = rnd(c, r, 73) < 0.72;
        xe.fillStyle = warm ? (rndVal > 0.7 ? '#ffd699' : '#c99c5e') : '#9ecdf5';
        xe.fillRect(px + 1, py + 1, ww - 2, wh - 2);
      }
    }
    xa.fillStyle = '#1b222c';
    xa.fillRect(0, r * ch, W, 3);
  }

  const map = prepTex(new THREE.CanvasTexture(cAlb), true);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const emissiveMap = prepTex(new THREE.CanvasTexture(cEm), true);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  return { map, emissiveMap };
}

function lightPoolTex() {
  const S128 = 128;
  const c = document.createElement('canvas');
  c.width = S128;
  c.height = S128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255, 208, 138, 0.85)');
  g.addColorStop(0.42, 'rgba(255, 194, 110, 0.36)');
  g.addColorStop(1, 'rgba(255, 190, 100, 0.0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S128, S128);
  return prepTex(new THREE.CanvasTexture(c), true);
}

function particleSoftTex() {
  const S64 = 64;
  const c = document.createElement('canvas');
  c.width = S64;
  c.height = S64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  g.addColorStop(0.55, 'rgba(255, 255, 255, 0.65)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S64, S64);
  return prepTex(new THREE.CanvasTexture(c), true);
}

const barkT = barkTex();
const pineLeafT = pineBoughTex(false);
const snowPineLeafT = pineBoughTex(true);
const broadLeafT = leafClusterTex('green');
const sakuraLeafT = leafClusterTex('sakura');
const grassTuftT = grassTuftTex();
const rockT = rockTex();
const skyScrTex = skyscraperTex();
const poolTex = lightPoolTex();
const ambPartTex = particleSoftTex();
const useA2C = !!(R.capabilities && R.capabilities.isWebGL2);

// ---------- Construtores de geometria procedural para todos os biomas
function buildOrganicTrunk(height, baseR, topR, branchCount) {
  const parts = [];
  const lower = new THREE.CylinderGeometry(topR * 1.25, baseR, height * 0.58, 7);
  lower.translate(0, height * 0.29, 0);
  parts.push(lower);

  const upper = new THREE.CylinderGeometry(topR * 0.48, topR * 1.2, height * 0.48, 6);
  upper.rotateZ(0.06);
  upper.translate(0.09, height * 0.76, 0);
  parts.push(upper);

  for (let b = 0; b < branchCount; b++) {
    const ang = (b / branchCount) * TAU + 0.4;
    const bLen = height * (0.34 + (b % 2) * 0.08);
    const br = new THREE.CylinderGeometry(topR * 0.22, topR * 0.58, bLen, 5);
    br.translate(0, bLen * 0.5, 0);
    br.rotateZ(0.62);
    br.rotateY(ang);
    br.translate(0, height * (0.55 + (b % 2) * 0.1), 0);
    parts.push(br);
  }
  return mergeSimpleGeos(parts);
}

function createCurvedFoliageCard(w, h, bend = 0.22) {
  const g = new THREE.PlaneGeometry(w, h, 2, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const nx = px / (w * 0.5);
    const ny = py / (h * 0.5);
    const zCurve = -(nx * nx * 0.65 + ny * ny * 0.35) * bend;
    pos.setXYZ(i, px, py, zCurve);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function buildPineCrownGeo() {
  const parts = [];
  const levels = [
    { y: 2.8, w: 3.1, h: 2.3, r: 0.9, tilt: 0.78, count: 4 },
    { y: 4.1, w: 2.65, h: 2.15, r: 0.76, tilt: 0.72, count: 4 },
    { y: 5.35, w: 2.15, h: 1.95, r: 0.58, tilt: 0.66, count: 4 },
    { y: 6.55, w: 1.55, h: 1.75, r: 0.38, tilt: 0.56, count: 3 },
    { y: 7.7, w: 1.05, h: 1.6, r: 0.08, tilt: 0.22, count: 2 }
  ];
  levels.forEach((lv, li) => {
    for (let k = 0; k < lv.count; k++) {
      const ang = (k / lv.count) * TAU + li * 0.78;
      const card = createCurvedFoliageCard(lv.w, lv.h, 0.26);
      card.rotateX(-lv.tilt);
      card.translate(0, 0, lv.r);
      card.rotateY(ang);
      card.translate(0, lv.y, 0);
      card.computeVertexNormals();
      parts.push(card);
    }
  });
  return mergeSimpleGeos(parts);
}

function buildBroadCrownGeo() {
  const clusters = [
    [0.0, 5.25, 0.0, 2.85, 2.7],
    [1.35, 4.45, 0.85, 2.35, 2.25],
    [-1.3, 4.6, -0.75, 2.4, 2.3],
    [0.35, 4.75, -1.25, 2.2, 2.15],
    [-0.55, 5.85, 0.95, 2.15, 2.05]
  ];
  const parts = [];
  clusters.forEach(([cxp, cyp, czp, cw, ch], ci) => {
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI + ci * 0.55;
      const card = createCurvedFoliageCard(cw, ch, 0.22);
      card.rotateX((k - 1) * 0.32);
      card.rotateY(ang);
      card.translate(cxp, cyp, czp);
      card.computeVertexNormals();
      parts.push(card);
    }
  });
  return mergeSimpleGeos(parts);
}

function buildGrassClumpGeo() {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const g = createCurvedFoliageCard(1.35, 1.05, 0.14);
    g.translate(0, 0.48, 0);
    g.rotateX(0.14);
    g.rotateY((k / 3) * Math.PI);
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeSimpleGeos(parts);
}

function buildOrganicRockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n1 = Math.sin(x * 2.7 + z * 1.9) * Math.cos(y * 2.3 - x * 1.1);
    const n2 = Math.sin(z * 4.5 - y * 3.1) * 0.4;
    const f = 1 + (n1 * 0.22 + n2 * 0.12);
    const flatY = y < 0 ? y * 0.55 : y * 0.85;
    pos.setXYZ(i, x * f * 1.15, flatY * f, z * f);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// Cacto Saguaro procedural com braços orgânicos (Deserto Dourado)
function buildSaguaroGeo() {
  const parts = [];
  const main = new THREE.CylinderGeometry(0.22, 0.28, 4.4, 8);
  main.translate(0, 2.2, 0);
  parts.push(main);

  const cap = new THREE.SphereGeometry(0.22, 8, 6);
  cap.translate(0, 4.4, 0);
  parts.push(cap);

  const addArm = (side, yStart, armH) => {
    const elbow = new THREE.CylinderGeometry(0.15, 0.17, 0.9, 7);
    elbow.rotateZ(side * 1.25);
    elbow.translate(side * 0.48, yStart, 0);
    parts.push(elbow);

    const vert = new THREE.CylinderGeometry(0.14, 0.16, armH, 7);
    vert.translate(side * 0.88, yStart + armH * 0.5 + 0.12, 0);
    parts.push(vert);

    const tip = new THREE.SphereGeometry(0.14, 7, 5);
    tip.translate(side * 0.88, yStart + armH + 0.12, 0);
    parts.push(tip);
  };

  addArm(-1, 2.1, 1.5);
  addArm(1, 2.6, 1.35);
  return mergeSimpleGeos(parts);
}

// Portal Torii tradicional japonês (Santuário Sakura)
function buildToriiParts() {
  const pL = new THREE.CylinderGeometry(0.22, 0.28, 5.6, 10);
  pL.rotateZ(-0.04);
  pL.translate(-2.25, 2.8, 0);
  const pR = new THREE.CylinderGeometry(0.22, 0.28, 5.6, 10);
  pR.rotateZ(0.04);
  pR.translate(2.25, 2.8, 0);

  const kasagi = new THREE.BoxGeometry(6.8, 0.36, 0.56);
  kasagi.translate(0, 5.65, 0);
  const kasagiL = new THREE.BoxGeometry(0.95, 0.34, 0.56);
  kasagiL.rotateZ(-0.18);
  kasagiL.translate(-3.65, 5.76, 0);
  const kasagiR = new THREE.BoxGeometry(0.95, 0.34, 0.56);
  kasagiR.rotateZ(0.18);
  kasagiR.translate(3.65, 5.76, 0);

  const nuki = new THREE.BoxGeometry(5.6, 0.26, 0.32);
  nuki.translate(0, 4.45, 0);
  const gakuzuka = new THREE.BoxGeometry(0.32, 1.0, 0.36);
  gakuzuka.translate(0, 5.05, 0);

  const baseL = new THREE.CylinderGeometry(0.36, 0.44, 0.72, 10);
  baseL.translate(-2.34, 0.36, 0);
  const baseR = new THREE.CylinderGeometry(0.36, 0.44, 0.72, 10);
  baseR.translate(2.34, 0.36, 0);

  return {
    red: mergeSimpleGeos([pL, pR, kasagi, kasagiL, kasagiR, nuki, gakuzuka]),
    stone: mergeSimpleGeos([baseL, baseR])
  };
}

// Lanterna de pedra japonesa Tōrō (Santuário Sakura)
function buildStoneLanternParts() {
  const post = new THREE.CylinderGeometry(0.14, 0.22, 1.35, 6);
  post.translate(0, 0.67, 0);
  const cap = new THREE.ConeGeometry(0.42, 0.32, 6);
  cap.translate(0, 1.92, 0);
  const box = new THREE.BoxGeometry(0.32, 0.36, 0.32);
  box.translate(0, 1.56, 0);
  return {
    stone: mergeSimpleGeos([post, cap]),
    flame: box
  };
}

// Barreira New Jersey de concreto urbano (Cidade)
function buildNewJerseyBarrierGeo(len = 6.0) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0);
  shape.lineTo(0.32, 0);
  shape.lineTo(0.24, 0.24);
  shape.lineTo(0.11, 0.88);
  shape.lineTo(-0.11, 0.88);
  shape.lineTo(-0.24, 0.24);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len + 0.08, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -len * 0.5);
  g.computeVertexNormals();
  return g;
}

// Poste de iluminação pública urbano (Cidade — a cada 35m)
function buildStreetlightParts() {
  const mast = new THREE.CylinderGeometry(0.08, 0.14, 7.6, 8);
  mast.translate(0, 3.8, 0);
  const arm = new THREE.CylinderGeometry(0.06, 0.07, 2.8, 6);
  arm.rotateZ(-1.32);
  arm.translate(1.25, 7.75, 0);
  const hood = new THREE.BoxGeometry(0.72, 0.14, 0.36);
  hood.translate(2.55, 8.05, 0);

  const bulb = new THREE.BoxGeometry(0.54, 0.08, 0.26);
  bulb.translate(2.55, 7.96, 0);

  const pool = new THREE.PlaneGeometry(11.5, 11.5);
  pool.rotateX(-Math.PI / 2);
  pool.translate(2.8, 0.09, 0);

  return {
    pole: mergeSimpleGeos([mast, arm, hood]),
    bulb,
    pool
  };
}

// Pórtico aéreo de sinalização rodoviária iluminado (Cidade)
function buildGantryParts() {
  const colL = new THREE.CylinderGeometry(0.24, 0.28, 7.4, 8);
  colL.translate(-9.8, 3.7, 0);
  const colR = new THREE.CylinderGeometry(0.24, 0.28, 7.4, 8);
  colR.translate(9.8, 3.7, 0);
  const beam = new THREE.BoxGeometry(20.2, 0.42, 0.44);
  beam.translate(0, 7.2, 0);

  const signA = new THREE.BoxGeometry(4.8, 1.55, 0.14);
  signA.translate(-3.6, 7.1, 0.26);
  const signB = new THREE.BoxGeometry(4.8, 1.55, 0.14);
  signB.translate(3.6, 7.1, 0.26);

  return {
    frame: mergeSimpleGeos([colL, colR, beam]),
    signs: mergeSimpleGeos([signA, signB])
  };
}

function buildFarmhouseParts() {
  const body = new THREE.BoxGeometry(10.0, 4.0, 8.0);
  body.translate(0, 2.0, 0);
  const wing = new THREE.BoxGeometry(4.5, 3.2, 5.2);
  wing.translate(6.8, 1.6, 0.8);

  const roofL = new THREE.BoxGeometry(11.0, 0.24, 5.2);
  roofL.rotateX(0.46);
  roofL.translate(0, 4.95, 2.25);

  const roofR = new THREE.BoxGeometry(11.0, 0.24, 5.2);
  roofR.rotateX(-0.46);
  roofR.translate(0, 4.95, -2.25);

  const wingRoof = new THREE.BoxGeometry(5.0, 0.22, 6.0);
  wingRoof.rotateZ(-0.34);
  wingRoof.translate(6.8, 3.85, 0.8);

  const gableL = new THREE.CylinderGeometry(0, 4.0, 1.85, 4);
  gableL.rotateY(Math.PI / 4);
  gableL.scale(1.38, 1, 1.0);
  gableL.translate(0, 4.92, 0);

  const win1 = new THREE.BoxGeometry(1.4, 1.1, 0.12);
  win1.translate(-2.4, 2.1, 4.04);
  const win2 = new THREE.BoxGeometry(1.4, 1.1, 0.12);
  win2.translate(2.4, 2.1, 4.04);
  const win3 = new THREE.BoxGeometry(0.12, 1.1, 1.4);
  win3.translate(-5.04, 2.1, 0);

  return {
    walls: mergeSimpleGeos([body, wing]),
    roofs: mergeSimpleGeos([roofL, roofR, wingRoof, gableL]),
    windows: mergeSimpleGeos([win1, win2, win3])
  };
}

function buildMergedGuardrailGeo(len = 6.0) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.045, 0.14);
  shape.lineTo(0.035, 0.105);
  shape.lineTo(0.035, 0.045);
  shape.lineTo(-0.025, 0.0);
  shape.lineTo(0.035, -0.045);
  shape.lineTo(0.035, -0.105);
  shape.lineTo(-0.045, -0.14);
  shape.lineTo(-0.065, -0.14);
  shape.lineTo(0.015, -0.10);
  shape.lineTo(0.015, -0.04);
  shape.lineTo(-0.045, 0.0);
  shape.lineTo(0.015, 0.04);
  shape.lineTo(0.015, 0.10);
  shape.lineTo(-0.065, 0.14);
  shape.closePath();

  const rail = new THREE.ExtrudeGeometry(shape, { depth: len + 0.15, bevelEnabled: false, steps: 1 });
  rail.translate(0, 0.62, -len * 0.5);
  rail.computeVertexNormals();

  const postA = new THREE.BoxGeometry(0.11, 0.86, 0.08);
  postA.translate(0.07, 0.40, -len * 0.25);
  const postB = new THREE.BoxGeometry(0.11, 0.86, 0.08);
  postB.translate(0.07, 0.40, len * 0.25);

  return mergeSimpleGeos([rail, postA, postB]);
}

// Monte Fuji majestoso no horizonte do Santuário Sakura
function createMountFuji() {
  const group = new THREE.Group();
  const baseCone = new THREE.ConeGeometry(540, 290, 28, 1, false);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3b495c, roughness: 0.94, metalness: 0.0 });
  const mBase = new THREE.Mesh(baseCone, baseMat);
  mBase.position.y = 140;

  const snowCone = new THREE.ConeGeometry(225, 122, 28, 1, false);
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xbcc7d6, roughness: 0.86, metalness: 0.0 });
  const mSnow = new THREE.Mesh(snowCone, snowMat);
  mSnow.position.y = 228;

  group.add(mBase, mSnow);
  group.frustumCulled = false;
  return { group, geos: [baseCone, snowCone], mats: [baseMat, snowMat] };
}

// Geometrias base reutilizáveis cacheadas (evita recriação pesada de canvas textures)
const pineDepthMat = typeof THREE.MeshDepthMaterial === 'function'
  ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: pineLeafT, alphaTest: 0.42 })
  : null;
const snowPineDepthMat = typeof THREE.MeshDepthMaterial === 'function'
  ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: snowPineLeafT, alphaTest: 0.42 })
  : null;
const broadDepthMat = typeof THREE.MeshDepthMaterial === 'function'
  ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: broadLeafT, alphaTest: 0.42 })
  : null;
const sakuraDepthMat = typeof THREE.MeshDepthMaterial === 'function'
  ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: sakuraLeafT, alphaTest: 0.40 })
  : null;

const colr = new THREE.Color();
const colLeafPalette = [new THREE.Color(0x98ad8e), new THREE.Color(0xb2c29d), new THREE.Color(0x889e7d)];
const colPinePalette = [new THREE.Color(0x88a484), new THREE.Color(0x9ab592), new THREE.Color(0x7c9678)];
const colSnowPinePalette = [new THREE.Color(0xa6b7c4), new THREE.Color(0xb8c7d4), new THREE.Color(0x98a8b8)];
const colSakuraPalette = [new THREE.Color(0xf4a7bb), new THREE.Color(0xf8c8d8), new THREE.Color(0xe588a3)];
const colGrassPalette = [new THREE.Color(0x9ab082), new THREE.Color(0xb5bd82), new THREE.Color(0x869e70)];
const colDesertShrubPalette = [new THREE.Color(0xb89258), new THREE.Color(0x99844c), new THREE.Color(0xc29e68)];
const dens = z => (0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(z / 850 + 2), 1.35)) * (1 - 0.22 * zone(z));

const treePos = (i, k, z, sd, pw, minOff = 14.5, maxOff = 210) => {
  const r1 = rnd(i, k, sd);
  const r2 = rnd(i, k, sd + 1);
  const r3 = rnd(i, k, sd + 2);
  const r4 = rnd(i, k, sd + 3);
  if (r1 > dens(z) * state.qT * pw) return null;
  const s = r2 < 0.5 ? -1 : 1;
  const o = minOff + Math.pow(r3, 1.6) * maxOff;
  const x = cx(z) + s * o;
  const h = th(x, z, s * o);
  if (h > 70) return null;
  const sc = 0.88 + r4 * 1.1;
  return { x, y: ry(z) + h - 0.22, z, sc, sy: sc * (0.9 + r2 * 0.38), rot: r3 * TAU, r2, r3 };
};

function isGuardRailZone(z) {
  return zone(z) >= 0.36 || Math.abs(cx(z + 8) - cx(z - 8)) > 2.2;
}

// ---------- Limpeza segura e regeneração completa de ativos 3D por bioma (zero memory leak)
export function clearBiomeAssets() {
  for (let i = IM.length - 1; i >= 0; i--) {
    const m = IM[i];
    if (m.isBiomeAsset) {
      S.remove(m);
      if (typeof m.dispose === 'function') m.dispose();
      IM.splice(i, 1);
    }
  }
  while (biomeExtraMeshes.length) {
    const obj = biomeExtraMeshes.pop();
    S.remove(obj);
  }
  fujiBackdropMesh = null;

  while (biomeOwnedGeos.length) {
    const g = biomeOwnedGeos.pop();
    if (g && typeof g.dispose === 'function') g.dispose();
  }
  while (biomeOwnedMats.length) {
    const mat = biomeOwnedMats.pop();
    if (mat && typeof mat.dispose === 'function') mat.dispose();
  }
  Object.keys(biomeEmissives).forEach(k => {
    biomeEmissives[k] = null;
  });
}

export function rebuildBiome(biomeIdx = set.biome) {
  clearBiomeAssets();

  const bIdx = cl(Math.round(biomeIdx), 0, BIOMES.length - 1);
  terrainUniforms.uBiome.value = bIdx;

  // --- Materiais e geometrias compartilhadas desta instância de bioma ---
  const trunkMat = trackMat(new THREE.MeshStandardMaterial({
    map: barkT,
    color: bIdx === 3 ? 0xc2b2b4 : 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.12
  }));

  const bollardBodyMat = trackMat(new THREE.MeshStandardMaterial({
    color: bIdx === 4 ? 0xeb8434 : 0xd8dce2,
    roughness: 0.45
  }));
  const catReflectorMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xffd2a0,
    emissive: 0xff9429,
    emissiveIntensity: 1.4,
    roughness: 0.25
  }));
  biomeEmissives.catReflectorMat = catReflectorMat;

  const kmSignMat = trackMat(new THREE.MeshStandardMaterial({
    color: bIdx === 2 ? 0x15528a : 0x1b6b3a,
    emissive: bIdx === 2 ? 0x267ec9 : 0x2ca85a,
    emissiveIntensity: 0.55,
    roughness: 0.35
  }));
  biomeEmissives.kmSignMat = kmSignMat;

  const bollardGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.072, 0.92, 10));
  const reflectorCapGeo = trackGeo(new THREE.CylinderGeometry(0.062, 0.062, 0.14, 10));
  const kmSignGeo = trackGeo((() => {
    const pole = new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8);
    pole.translate(0, 0.65, 0);
    const board = new THREE.BoxGeometry(0.06, 0.52, 0.46);
    board.translate(0, 1.25, 0);
    return mergeSimpleGeos([pole, board]);
  })());

  // Balizadores e marcos quilométricos (todos os biomas)
  inst(bollardGeo, bollardBodyMat, 110, 1100, (obj, i, k, z) => {
    const s = i % 2 ? 1 : -1;
    obj.position.set(cx(z) + s * 9.3, ry(z) + 0.42, z);
  }, false, null, 120, true);

  inst(reflectorCapGeo, catReflectorMat, 110, 1100, (obj, i, k, z) => {
    const s = i % 2 ? 1 : -1;
    obj.position.set(cx(z) + s * 9.3, ry(z) + 0.76, z);
  }, false, null, 120, true);

  inst(kmSignGeo, kmSignMat, 12, 3000, (obj, i, k, z) => {
    obj.position.set(cx(z) + 10.6, ry(z), z);
    obj.rotation.y = Math.atan2(cx(z - 5) - cx(z + 5), -10);
  }, false, null, 120, true);

  // Barreiras laterais adaptadas (New Jersey na Cidade, W-Beam nos demais)
  if (bIdx === 2) {
    const njGeo = trackGeo(buildNewJerseyBarrierGeo(6.0));
    const njMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x767d87, roughness: 0.88, metalness: 0.05 }));
    inst(njGeo, njMat, 240, 720, (obj, i, k, z) => {
      const s = i % 2 ? 1 : -1;
      obj.position.set(cx(z) + s * 9.95, ry(z), z);
      obj.rotation.y = Math.atan2(cx(z - 4) - cx(z + 4), -8);
    }, false, null, 120, true);
  } else {
    const railGeo = trackGeo(buildMergedGuardrailGeo(6.0));
    const railMat = trackMat(new THREE.MeshStandardMaterial({
      color: bIdx === 1 ? 0x8f6b4b : 0xa4abb5,
      metalness: bIdx === 1 ? 0.35 : 0.78,
      roughness: bIdx === 1 ? 0.65 : 0.32
    }));
    inst(railGeo, railMat, 240, 720, (obj, i, k, z) => {
      if (!isGuardRailZone(z)) { obj.scale.setScalar(0); return; }
      const s = i % 2 ? 1 : -1;
      obj.position.set(cx(z) + s * 9.85, ry(z), z);
      obj.rotation.y = Math.atan2(cx(z - 4) - cx(z + 4), -8);
      obj.scale.set(s, 1, 1);
    }, false, null, 120, true);
  }

  // ==================== BIOMA 0: VALE ALPINO ====================
  if (bIdx === 0) {
    const pineCrownGeo = trackGeo(buildPineCrownGeo());
    const pineTrunkGeo = trackGeo(buildOrganicTrunk(6.4, 0.32, 0.11, 4));
    const broadCrownGeo = trackGeo(buildBroadCrownGeo());
    const broadTrunkGeo = trackGeo(buildOrganicTrunk(4.0, 0.34, 0.16, 4));
    const grassClumpGeo = trackGeo(buildGrassClumpGeo());
    const organicRockGeo = trackGeo(buildOrganicRockGeo());
    const houseParts = buildFarmhouseParts();
    trackGeo(houseParts.walls);
    trackGeo(houseParts.roofs);
    trackGeo(houseParts.windows);

    const pineMat = trackMat(new THREE.MeshStandardMaterial({
      map: pineLeafT, alphaTest: useA2C ? 0.28 : 0.42, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.82, envMapIntensity: 0.18
    }));
    const broadMat = trackMat(new THREE.MeshStandardMaterial({
      map: broadLeafT, alphaTest: useA2C ? 0.28 : 0.42, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.80, envMapIntensity: 0.18
    }));
    const grassMat = trackMat(new THREE.MeshStandardMaterial({
      map: grassTuftT, alphaTest: useA2C ? 0.24 : 0.36, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.90, envMapIntensity: 0.14
    }));
    const rockMat = trackMat(new THREE.MeshStandardMaterial({ map: rockT, color: 0xffffff, roughness: 0.92 }));
    const houseWallM = trackMat(new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.88 }));
    const houseRoofM = trackMat(new THREE.MeshStandardMaterial({ color: 0x7d3a27, roughness: 0.82 }));
    const houseWinM = trackMat(new THREE.MeshStandardMaterial({ color: 0x263242, emissive: 0xffb85c, emissiveIntensity: 0, roughness: 0.25 }));
    biomeEmissives.houseWinM = houseWinM;

    inst(pineCrownGeo, pineMat, 220, 1150, (obj, i, k, z, m) => {
      const p = treePos(i, k, z, 1, 1);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc, p.sy, p.sc);
      const cIdx = (i + Math.abs(k)) % 3;
      m.setColorAt(i, colr.copy(colPinePalette[cIdx]).lerp(colPinePalette[(cIdx + 1) % 3], p.r2 * 0.5));
    }, true, pineDepthMat, 120, true);

    inst(pineTrunkGeo, trunkMat, 220, 1150, (obj, i, k, z) => {
      const p = treePos(i, k, z, 1, 1);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc, p.sy, p.sc);
    }, true, null, 120, true);

    inst(broadCrownGeo, broadMat, 200, 1150, (obj, i, k, z, m) => {
      const p = treePos(i, k, z, 7, 0.92);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc * 1.1, p.sy * 0.98, p.sc * 1.1);
      const cIdx = (i + Math.abs(k)) % 3;
      m.setColorAt(i, colr.copy(colLeafPalette[cIdx]).lerp(colLeafPalette[(cIdx + 1) % 3], p.r2));
    }, true, broadDepthMat, 120, true);

    inst(broadTrunkGeo, trunkMat, 200, 1150, (obj, i, k, z) => {
      const p = treePos(i, k, z, 7, 0.92);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc * 1.08, p.sy * 0.98, p.sc * 1.08);
    }, true, null, 120, true);

    inst(grassClumpGeo, grassMat, 900, 420, (obj, i, k, z, m) => {
      const r1 = rnd(i, k, 13);
      const r2 = rnd(i, k, 14);
      const r3 = rnd(i, k, 15);
      if (r1 > (0.48 + 0.52 * dens(z)) * state.qT) { obj.scale.setScalar(0); return; }
      const s = r2 < 0.5 ? -1 : 1;
      const o = 10.3 + Math.pow(r3, 2.0) * 62;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      if (h > 48) { obj.scale.setScalar(0); return; }
      obj.position.set(x, ry(z) + h - 0.08, z);
      obj.rotation.y = r3 * TAU;
      const sc = 0.72 + rnd(i, k, 16) * 0.95;
      obj.scale.set(sc, sc * (0.85 + r2 * 0.45), sc);
      m.setColorAt(i, colr.copy(colGrassPalette[i % 3]).lerp(colGrassPalette[(i + 1) % 3], r2));
    }, false, null, 70, true);

    inst(organicRockGeo, rockMat, 110, 1100, (obj, i, k, z, m) => {
      if (rnd(i, k, 3) > 0.45 * (0.35 + zone(z)) * state.qT) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 4) < 0.5 ? -1 : 1;
      const o = 11.8 + Math.pow(rnd(i, k, 5), 1.4) * 190;
      const x = cx(z) + s * o;
      const q = 0.7 + rnd(i, k, 6) * 2.8;
      obj.position.set(x, ry(z) + th(x, z, s * o) - q * 0.16, z);
      obj.scale.set(q * (1.1 + rnd(i, k, 7) * 0.5), q * (0.75 + rnd(i, k, 8) * 0.4), q * (1 + rnd(i, k, 9) * 0.5));
      obj.rotation.set((rnd(i, k, 10) - 0.5) * 0.45, rnd(i, k, 8) * TAU, (rnd(i, k, 11) - 0.5) * 0.45);
      const shade = 0.55 + rnd(i, k, 12) * 0.22;
      m.setColorAt(i, colr.setRGB(shade * 1.03, shade, shade * 0.96));
    }, false, null, 120, true);

    const houseTransform = (obj, i, k, z) => {
      if (rnd(i, k, 3) > 0.34) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 4) < 0.5 ? -1 : 1;
      const o = 72 + rnd(i, k, 5) * 320;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      if (h > 42) { obj.scale.setScalar(0); return; }
      const sc = 0.85 + rnd(i, k, 6) * 0.45;
      obj.position.set(x, ry(z) + h - 0.25, z);
      obj.scale.set(sc, sc, sc);
      obj.rotation.y = rnd(i, k, 10) * TAU;
    };
    inst(houseParts.walls, houseWallM, 28, 2200, houseTransform, false, null, 120, true);
    inst(houseParts.roofs, houseRoofM, 28, 2200, houseTransform, false, null, 120, true);
    inst(houseParts.windows, houseWinM, 28, 2200, houseTransform, false, null, 120, true);
  }

  // ==================== BIOMA 1: DESERTO DOURADO ====================
  if (bIdx === 1) {
    const saguaroGeo = trackGeo(buildSaguaroGeo());
    const shrubGeo = trackGeo(buildGrassClumpGeo());
    const rockGeo = trackGeo(buildOrganicRockGeo());
    const cactusMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4b7440, roughness: 0.84, metalness: 0.0 }));
    const shrubMat = trackMat(new THREE.MeshStandardMaterial({
      map: grassTuftT, alphaTest: useA2C ? 0.24 : 0.36, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.92
    }));
    const canyonRockMat = trackMat(new THREE.MeshStandardMaterial({ map: rockT, color: 0xc2774a, roughness: 0.90 }));

    inst(saguaroGeo, cactusMat, 260, 1150, (obj, i, k, z, m) => {
      const r1 = rnd(i, k, 21);
      if (r1 > 0.72 * state.qT) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 22) < 0.5 ? -1 : 1;
      const o = 13.5 + Math.pow(rnd(i, k, 23), 1.5) * 195;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      if (h > 55) { obj.scale.setScalar(0); return; }
      const sc = 0.78 + rnd(i, k, 24) * 1.15;
      obj.position.set(x, ry(z) + h - 0.18, z);
      obj.rotation.y = rnd(i, k, 25) * TAU;
      obj.scale.set(sc, sc * (0.85 + rnd(i, k, 26) * 0.4), sc);
      const tone = 0.85 + rnd(i, k, 27) * 0.28;
      m.setColorAt(i, colr.setRGB(tone * 0.92, tone * 1.05, tone * 0.88));
    }, true, null, 120, true);

    inst(shrubGeo, shrubMat, 620, 440, (obj, i, k, z, m) => {
      if (rnd(i, k, 31) > 0.68 * state.qT) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 32) < 0.5 ? -1 : 1;
      const o = 10.6 + Math.pow(rnd(i, k, 33), 1.8) * 75;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      if (h > 40) { obj.scale.setScalar(0); return; }
      const sc = 0.65 + rnd(i, k, 34) * 0.9;
      obj.position.set(x, ry(z) + h - 0.1, z);
      obj.rotation.y = rnd(i, k, 35) * TAU;
      obj.scale.set(sc * 1.2, sc * 0.85, sc * 1.2);
      m.setColorAt(i, colr.copy(colDesertShrubPalette[i % 3]));
    }, false, null, 75, true);

    inst(rockGeo, canyonRockMat, 180, 1150, (obj, i, k, z, m) => {
      if (rnd(i, k, 41) > 0.65 * state.qT) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 42) < 0.5 ? -1 : 1;
      const o = 13.0 + Math.pow(rnd(i, k, 43), 1.35) * 230;
      const x = cx(z) + s * o;
      const q = 0.9 + rnd(i, k, 44) * 4.5;
      obj.position.set(x, ry(z) + th(x, z, s * o) - q * 0.22, z);
      obj.scale.set(q * 1.4, q * (0.7 + rnd(i, k, 45) * 0.6), q * 1.25);
      obj.rotation.set((rnd(i, k, 46) - 0.5) * 0.25, rnd(i, k, 47) * TAU, (rnd(i, k, 48) - 0.5) * 0.25);
      const sh = 0.72 + rnd(i, k, 49) * 0.35;
      m.setColorAt(i, colr.setRGB(sh * 1.05, sh * 0.82, sh * 0.65));
    }, true, null, 120, true);
  }

  // ==================== BIOMA 2: CIDADE / METRÓPOLE COSTEIRA ====================
  if (bIdx === 2) {
    const towerBodyGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
    towerBodyGeo.translate(0, 0.5, 0);
    const towerCrownGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.14, 0.68));
    towerCrownGeo.translate(0, 1.07, 0);

    const skyscraperMat = trackMat(new THREE.MeshStandardMaterial({
      map: skyScrTex.map,
      emissive: 0xffffff,
      emissiveMap: skyScrTex.emissiveMap,
      emissiveIntensity: 0.22,
      roughness: 0.20,
      metalness: 0.62,
      envMapIntensity: 1.05
    }));
    const towerCrownMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x38424d,
      roughness: 0.45,
      metalness: 0.55
    }));
    biomeEmissives.skyscraperBodyM = skyscraperMat;

    const towerTransform = (obj, i, k, z, m) => {
      const r1 = rnd(i, k, 51);
      if (r1 > 0.88 * state.qT) { obj.scale.setScalar(0); return; }
      const s = i % 2 === 0 ? -1 : 1;
      const tier = Math.floor(rnd(i, k, 52) * 3);
      const o = 24 + tier * 26 + rnd(i, k, 53) * 18;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      const w = 12 + rnd(i, k, 54) * 14;
      const d = 12 + rnd(i, k, 55) * 14;
      const bh = 28 + rnd(i, k, 56) * 76 + tier * 14;
      obj.position.set(x, ry(z) + h - 0.3, z);
      obj.scale.set(w, bh, d);
      obj.rotation.y = Math.atan2(cx(z - 6) - cx(z + 6), -12);
      if (m && m.setColorAt) {
        const tint = rnd(i, k, 57);
        if (tint < 0.33) m.setColorAt(i, colr.setHex(0x88a8c8));
        else if (tint < 0.66) m.setColorAt(i, colr.setHex(0x9cb4c8));
        else m.setColorAt(i, colr.setHex(0x6e8296));
      }
    };
    inst(towerBodyGeo, skyscraperMat, 160, 1280, towerTransform, true, null, 140, true);
    inst(towerCrownGeo, towerCrownMat, 160, 1280, towerTransform, false, null, 140, true);

    // Postes de iluminação pública a cada 35m (span 2240m / 64 = 35m exatos)
    const lampParts = buildStreetlightParts();
    trackGeo(lampParts.pole);
    trackGeo(lampParts.bulb);
    trackGeo(lampParts.pool);
    const poleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x454e59, metalness: 0.80, roughness: 0.30 }));
    const bulbMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffcf87,
      emissive: 0xffcf87,
      emissiveIntensity: 1.8,
      roughness: 0.2
    }));
    const poolMat = trackMat(new THREE.MeshBasicMaterial({
      map: poolTex,
      color: 0xffcf87,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    biomeEmissives.streetlightBulbM = bulbMat;
    biomeEmissives.streetlightPoolM = poolMat;

    const lampTransform = (obj, i, k, z) => {
      const s = i % 2 === 0 ? -1 : 1;
      obj.position.set(cx(z) + s * 10.1, ry(z), z);
      const roadYaw = Math.atan2(cx(z - 4) - cx(z + 4), -8);
      obj.rotation.y = roadYaw + (s < 0 ? 0 : Math.PI);
    };
    inst(lampParts.pole, poleMat, 64, 2240, lampTransform, false, null, 120, true);
    inst(lampParts.bulb, bulbMat, 64, 2240, lampTransform, false, null, 120, true);
    inst(lampParts.pool, poolMat, 64, 2240, lampTransform, false, null, 120, true);

    // Pórticos com placas aéreas de trânsito iluminadas
    const gantryParts = buildGantryParts();
    trackGeo(gantryParts.frame);
    trackGeo(gantryParts.signs);
    const gantryFrameMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x626b75, metalness: 0.72, roughness: 0.36 }));
    const gantrySignMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0x165e3a,
      emissive: 0x269e60,
      emissiveIntensity: 0.65,
      roughness: 0.3
    }));
    biomeEmissives.gantrySignM = gantrySignMat;

    const gantryTransform = (obj, i, k, z) => {
      obj.position.set(cx(z), ry(z), z);
      obj.rotation.y = Math.atan2(cx(z - 5) - cx(z + 5), -10);
    };
    inst(gantryParts.frame, gantryFrameMat, 8, 2000, gantryTransform, false, null, 140, true);
    inst(gantryParts.signs, gantrySignMat, 8, 2000, gantryTransform, false, null, 140, true);

    // Árvores urbanas esparsas ao longo dos passeios
    const broadCrownGeo = trackGeo(buildBroadCrownGeo());
    const broadTrunkGeo = trackGeo(buildOrganicTrunk(4.0, 0.32, 0.15, 4));
    const broadMat = trackMat(new THREE.MeshStandardMaterial({
      map: broadLeafT, alphaTest: useA2C ? 0.28 : 0.42, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.80
    }));
    inst(broadCrownGeo, broadMat, 90, 1150, (obj, i, k, z, m) => {
      const p = treePos(i, k, z, 63, 0.65, 13.5, 16);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc * 0.9, p.sy * 0.9, p.sc * 0.9);
      m.setColorAt(i, colr.copy(colLeafPalette[i % 3]));
    }, false, broadDepthMat, 120, true);
    inst(broadTrunkGeo, trunkMat, 90, 1150, (obj, i, k, z) => {
      const p = treePos(i, k, z, 63, 0.65, 13.5, 16);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc * 0.9, p.sy * 0.9, p.sc * 0.9);
    }, false, null, 120, true);
  }

  // ==================== BIOMA 3: SANTUÁRIO SAKURA ====================
  if (bIdx === 3) {
    const sakuraCrownGeo = trackGeo(buildBroadCrownGeo());
    const sakuraTrunkGeo = trackGeo(buildOrganicTrunk(4.1, 0.34, 0.16, 4));
    const grassClumpGeo = trackGeo(buildGrassClumpGeo());
    const toriiParts = buildToriiParts();
    trackGeo(toriiParts.red);
    trackGeo(toriiParts.stone);
    const lanternParts = buildStoneLanternParts();
    trackGeo(lanternParts.stone);
    trackGeo(lanternParts.flame);

    const sakuraMat = trackMat(new THREE.MeshStandardMaterial({
      map: sakuraLeafT, alphaTest: useA2C ? 0.26 : 0.40, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.78, envMapIntensity: 0.20
    }));
    const grassMat = trackMat(new THREE.MeshStandardMaterial({
      map: grassTuftT, alphaTest: useA2C ? 0.24 : 0.36, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.90
    }));
    const toriiRedMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc82a24, roughness: 0.42, metalness: 0.08 }));
    const shrineStoneMat = trackMat(new THREE.MeshStandardMaterial({ map: rockT, color: 0x7e838a, roughness: 0.88 }));
    const lanternFlameMat = trackMat(new THREE.MeshStandardMaterial({
      color: 0xffd08a, emissive: 0xffa640, emissiveIntensity: 1.5, roughness: 0.3
    }));
    biomeEmissives.lanternFlameM = lanternFlameMat;

    inst(sakuraCrownGeo, sakuraMat, 260, 1150, (obj, i, k, z, m) => {
      const p = treePos(i, k, z, 71, 1.0);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc * 1.16, p.sy * 0.96, p.sc * 1.16);
      const cIdx = (i + Math.abs(k)) % 3;
      m.setColorAt(i, colr.copy(colSakuraPalette[cIdx]).lerp(colSakuraPalette[(cIdx + 1) % 3], p.r2));
    }, true, sakuraDepthMat, 120, true);

    inst(sakuraTrunkGeo, trunkMat, 260, 1150, (obj, i, k, z) => {
      const p = treePos(i, k, z, 71, 1.0);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc * 1.08, p.sy * 0.96, p.sc * 1.08);
    }, true, null, 120, true);

    // Portais Torii vermelhos tradicionais ao longo da rota
    const toriiTransform = (obj, i, k, z) => {
      if (rnd(i, k, 79) > 0.62) { obj.scale.setScalar(0); return; }
      const s = i % 2 === 0 ? -1 : 1;
      const o = 17.5 + rnd(i, k, 80) * 14;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      obj.position.set(x, ry(z) + h - 0.15, z);
      obj.rotation.y = Math.atan2(cx(z - 5) - cx(z + 5), -10) + (s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      const sc = 0.88 + rnd(i, k, 81) * 0.25;
      obj.scale.setScalar(sc);
    };
    inst(toriiParts.red, toriiRedMat, 22, 1650, toriiTransform, true, null, 120, true);
    inst(toriiParts.stone, shrineStoneMat, 22, 1650, toriiTransform, false, null, 120, true);

    // Lanternas de pedra Tōrō
    const lanternTransform = (obj, i, k, z) => {
      const s = i % 2 === 0 ? -1 : 1;
      const o = 11.4;
      const x = cx(z) + s * o;
      obj.position.set(x, ry(z) + th(x, z, s * o) - 0.08, z);
    };
    inst(lanternParts.stone, shrineStoneMat, 48, 1200, lanternTransform, false, null, 120, true);
    inst(lanternParts.flame, lanternFlameMat, 48, 1200, lanternTransform, false, null, 120, true);

    inst(grassClumpGeo, grassMat, 600, 420, (obj, i, k, z, m) => {
      if (rnd(i, k, 83) > 0.72 * state.qT) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 84) < 0.5 ? -1 : 1;
      const o = 10.4 + Math.pow(rnd(i, k, 85), 2.0) * 58;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      if (h > 40) { obj.scale.setScalar(0); return; }
      obj.position.set(x, ry(z) + h - 0.08, z);
      obj.rotation.y = rnd(i, k, 86) * TAU;
      const sc = 0.7 + rnd(i, k, 87) * 0.8;
      obj.scale.setScalar(sc);
      m.setColorAt(i, colr.copy(i % 4 === 0 ? colSakuraPalette[0] : colGrassPalette[i % 3]));
    }, false, null, 70, true);

    // Monte Fuji majestoso no horizonte
    const fuji = createMountFuji();
    fuji.geos.forEach(trackGeo);
    fuji.mats.forEach(trackMat);
    fujiBackdropMesh = fuji.group;
    S.add(fujiBackdropMesh);
    biomeExtraMeshes.push(fujiBackdropMesh);
  }

  // ==================== BIOMA 4: MONTANHAS NEVADAS ====================
  if (bIdx === 4) {
    const pineCrownGeo = trackGeo(buildPineCrownGeo());
    const pineTrunkGeo = trackGeo(buildOrganicTrunk(6.5, 0.32, 0.11, 4));
    const rockGeo = trackGeo(buildOrganicRockGeo());
    const houseParts = buildFarmhouseParts();
    trackGeo(houseParts.walls);
    trackGeo(houseParts.roofs);
    trackGeo(houseParts.windows);

    const snowPineMat = trackMat(new THREE.MeshStandardMaterial({
      map: snowPineLeafT, alphaTest: useA2C ? 0.28 : 0.42, alphaToCoverage: useA2C,
      side: THREE.DoubleSide, roughness: 0.84, envMapIntensity: 0.18
    }));
    const snowRockMat = trackMat(new THREE.MeshStandardMaterial({ map: rockT, color: 0xaab6c4, roughness: 0.88 }));
    const chaletWallM = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4332, roughness: 0.88 }));
    const chaletRoofM = trackMat(new THREE.MeshStandardMaterial({ color: 0xa6b4c4, roughness: 0.84 }));
    const chaletWinM = trackMat(new THREE.MeshStandardMaterial({ color: 0x263242, emissive: 0xffb85c, emissiveIntensity: 0.35, roughness: 0.25 }));
    biomeEmissives.houseWinM = chaletWinM;

    inst(pineCrownGeo, snowPineMat, 280, 1150, (obj, i, k, z, m) => {
      const p = treePos(i, k, z, 91, 1.0);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc, p.sy, p.sc);
      m.setColorAt(i, colr.copy(colSnowPinePalette[i % 3]));
    }, true, snowPineDepthMat, 120, true);

    inst(pineTrunkGeo, trunkMat, 280, 1150, (obj, i, k, z) => {
      const p = treePos(i, k, z, 91, 1.0);
      if (!p) { obj.scale.setScalar(0); return; }
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.set(p.sc, p.sy, p.sc);
    }, true, null, 120, true);

    inst(rockGeo, snowRockMat, 150, 1150, (obj, i, k, z, m) => {
      if (rnd(i, k, 95) > 0.52 * state.qT) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 96) < 0.5 ? -1 : 1;
      const o = 12.2 + Math.pow(rnd(i, k, 97), 1.4) * 200;
      const x = cx(z) + s * o;
      const q = 0.8 + rnd(i, k, 98) * 3.1;
      obj.position.set(x, ry(z) + th(x, z, s * o) - q * 0.18, z);
      obj.scale.set(q * 1.2, q * 0.85, q * 1.1);
      obj.rotation.set((rnd(i, k, 99) - 0.5) * 0.4, rnd(i, k, 100) * TAU, 0);
      const sh = 0.72 + rnd(i, k, 101) * 0.22;
      m.setColorAt(i, colr.setRGB(sh * 0.94, sh * 0.98, sh * 1.04));
    }, false, null, 120, true);

    const chaletTransform = (obj, i, k, z) => {
      if (rnd(i, k, 105) > 0.34) { obj.scale.setScalar(0); return; }
      const s = rnd(i, k, 106) < 0.5 ? -1 : 1;
      const o = 70 + rnd(i, k, 107) * 300;
      const x = cx(z) + s * o;
      const h = th(x, z, s * o);
      if (h > 45) { obj.scale.setScalar(0); return; }
      const sc = 0.85 + rnd(i, k, 108) * 0.42;
      obj.position.set(x, ry(z) + h - 0.25, z);
      obj.scale.set(sc, sc, sc);
      obj.rotation.y = rnd(i, k, 109) * TAU;
    };
    inst(houseParts.walls, chaletWallM, 26, 2200, chaletTransform, false, null, 120, true);
    inst(houseParts.roofs, chaletRoofM, 26, 2200, chaletTransform, false, null, 120, true);
    inst(houseParts.windows, chaletWinM, 26, 2200, chaletTransform, false, null, 120, true);
  }

  // Atualiza posição inicial do terreno e instâncias imediatamente
  state.lastB = 1e9;
  rows(P.z);
  IM.forEach(m => m.upd(P.z));
}

export function setBiome(biomeIdx) {
  const nextIdx = ((Math.round(biomeIdx) % BIOMES.length) + BIOMES.length) % BIOMES.length;
  set.biome = nextIdx;
  rebuildBiome(nextIdx);
  applyEnv();
}

// ---------- chuva e partículas ambientais de bioma (pétalas de sakura, flocos de neve, poeira)
const RN = 750;
const rl = new Float32Array(RN * 3);
const rpA = new Float32Array(RN * 6);
for (let i = 0; i < RN * 3; i++) rl[i] = Math.random() * 100;

export const rain = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xaab4c8, transparent: true, opacity: 0.38 })
);
rain.geometry.setAttribute('position', new THREE.BufferAttribute(rpA, 3));
rain.frustumCulled = false;
rain.visible = false;
S.add(rain);

const APN = 650;
const apBase = new Float32Array(APN * 3);
const apPos = new Float32Array(APN * 3);
for (let i = 0; i < APN; i++) {
  apBase[i * 3] = Math.random() * 64;
  apBase[i * 3 + 1] = Math.random() * 26;
  apBase[i * 3 + 2] = Math.random() * 64;
}
const ambPartGeo = new THREE.BufferGeometry();
ambPartGeo.setAttribute('position', new THREE.BufferAttribute(apPos, 3));
export const ambientParticles = new THREE.Points(
  ambPartGeo,
  new THREE.PointsMaterial({
    map: ambPartTex,
    color: 0xf6b8cb,
    size: 0.34,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  })
);
ambientParticles.frustumCulled = false;
ambientParticles.visible = false;
S.add(ambientParticles);

export function rainUpd(dt) {
  const c = cam.position;
  if (rain.visible) {
    for (let i = 0; i < RN; i++) {
      rl[i * 3 + 1] -= 38 * dt;
      const x = c.x + ((rl[i * 3] - c.x) % 40 + 40) % 40 - 20;
      const y = c.y + (((rl[i * 3 + 1]) % 25) + 25) % 25 - 6;
      const z = c.z + ((rl[i * 3 + 2] - c.z) % 40 + 40) % 40 - 20;
      rpA.set([x, y, z, x + P.vx * 0.012, y + 0.8, z + P.vz * 0.012], i * 6);
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }

  const bm = biome();
  const mode = bm.particle;
  if (mode === 'sakura' || mode === 'snow' || mode === 'dust') {
    ambientParticles.visible = true;
    const fallVel = mode === 'snow' ? 3.8 : (mode === 'sakura' ? 1.55 : 0.45);
    const swayAmp = mode === 'sakura' ? 1.85 : (mode === 'snow' ? 0.9 : 2.6);
    const t = state.T;
    for (let i = 0; i < APN; i++) {
      apBase[i * 3] += Math.sin(t * 0.9 + i * 0.7) * swayAmp * dt;
      apBase[i * 3 + 1] -= fallVel * dt;
      apBase[i * 3 + 2] += Math.cos(t * 0.75 + i * 1.1) * swayAmp * 0.7 * dt;
      const x = c.x + ((apBase[i * 3] - c.x) % 56 + 56) % 56 - 28;
      const y = c.y + ((apBase[i * 3 + 1] - c.y) % 24 + 24) % 24 - 6;
      const z = c.z + ((apBase[i * 3 + 2] - c.z) % 56 + 56) % 56 - 28;
      apPos[i * 3] = x;
      apPos[i * 3 + 1] = y;
      apPos[i * 3 + 2] = z;
    }
    ambPartGeo.attributes.position.needsUpdate = true;
  } else {
    ambientParticles.visible = false;
  }
}

export function updateSkyPos(camPos, timeSec) {
  if (sky) sky.position.copy(camPos);
  dome.position.copy(camPos);
  cloudDome.position.copy(camPos);
  stars.position.copy(camPos);
  if (fujiBackdropMesh) {
    fujiBackdropMesh.position.set(cx(camPos.z - 1350) + 290, ry(camPos.z - 1350) - 22, camPos.z - 1380);
  }
  dm.uniforms.tm.value = timeSec;
  cloudMat.uniforms.uTime.value = timeSec;
}

export function renderWorld(timeSec = 0, speedKmh = 0, lateralG = 0, isWet = false) {
  if (set.q >= 2 && composer && forzaPass) {
    const u = forzaPass.uniforms;
    u.uSpeedNorm.value = cl((speedKmh - 120) / 200, 0, 1);
    u.uGForce.value = cl(lateralG, -2.5, 2.5);
    u.uTime.value = timeSec;
    u.uWet.value = isWet ? 1.0 : 0.0;
    composer.render();
  } else {
    R.render(S, cam);
  }
}

// ---------- iluminação e ambiente PBR dinâmico (paleta harmônica e sem ofuscamento)
const envListeners = [];
export function onEnvChange(fn) {
  envListeners.push(fn);
}

export function envUpdate() {
  const o = envT;
  try {
    envT = PM.fromScene(ES, 0.03);
    S.environment = envT && envT.texture ? envT.texture : null;
  } catch {
    envT = null;
    S.environment = null;
  }
  if (o) o.dispose();
}

export function applyEnv() {
  const [, tp, hr, el, az, sc, si] = TOD[set.tod];
  const bm = biome();
  const g = [0, 0.35, 0.62, 0.78][set.wx];
  const night = set.tod == 5;
  const lowSun = set.tod == 4 || set.tod == 0 || set.tod == 3;
  const gray = new THREE.Color(night ? 0x141d2e : 0x727c88);

  // Mistura harmônica com paleta do bioma ativo
  const baseTop = new THREE.Color(tp).lerp(new THREE.Color(bm.skyTop), night ? 0.15 : 0.48);
  const baseHor = new THREE.Color(hr).lerp(new THREE.Color(bm.skyHor), night ? 0.12 : 0.45);
  const Tc = baseTop.lerp(gray, g);
  const H = baseHor.lerp(gray, g * 0.85);
  const u = dm.uniforms;

  u.top.value.copy(Tc);
  u.hor.value.copy(H);
  u.bot.value.copy(H).multiplyScalar(0.45);
  u.sc.value.set(sc);
  u.sg.value = 1 - g * 0.85;
  u.cld.value = [0.36, 0.25, 0.85, 0.95][set.wx];

  sdir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  u.sd.value.copy(sdir);

  if (sky) {
    sky.visible = !night;
    dome.visible = night;
    if (sky.material && sky.material.uniforms) {
      const su = sky.material.uniforms;
      su.turbidity.value = lp(3.2, 6.8, g) + (lowSun ? 1.5 : 0);
      su.rayleigh.value = lp(2.25, 0.95, g) + (set.tod == 4 ? 0.55 : 0);
      su.mieCoefficient.value = lp(0.0022, 0.009, g);
      su.mieDirectionalG.value = 0.74;
      if (su.uSoftTop) su.uSoftTop.value.copy(Tc);
      if (su.uSoftHor) su.uSoftHor.value.copy(H);
      if (su.uSoftWeight) su.uSoftWeight.value = lowSun ? 0.34 : 0.46;
      if (su.sunPosition) su.sunPosition.value.copy(sdir).multiplyScalar(1000);
    }
  } else {
    dome.visible = true;
  }

  cloudMat.uniforms.uSunDir.value.copy(sdir);
  cloudMat.uniforms.uSunCol.value.set(sc);
  cloudMat.uniforms.uSkyHor.value.copy(H);
  cloudMat.uniforms.uSkyTop.value.copy(Tc);
  cloudMat.uniforms.uCoverage.value = [0.38, 0.28, 0.78, 0.9][set.wx];
  cloudMat.uniforms.uNight.value = night ? 1.0 : 0.0;

  const wxAtten = [1, 0.72, 0.54, 0.48][set.wx];
  const daySun = night ? 0.56 : (set.tod == 4 ? Math.max(1.25, si * 0.65) : 2.25);
  sun.color.set(night ? sc : 0xfff4e2).lerp(new THREE.Color(sc), lowSun ? 0.42 : 0.0);
  sun.intensity = daySun * wxAtten;

  hemi.color.set(bm.skyHor).lerp(Tc, night ? 0.75 : 0.35);
  hemi.groundColor.set(bm.groundCol);
  const baseHemi = night ? 0.36 : (lowSun ? 0.56 : 0.64);
  hemi.intensity = Math.max(0.32, baseHemi * (1 - 0.14 * g));
  amb.intensity = night ? 0.09 : 0.14;

  if (esSky && esSky.material && esSky.material.uniforms) {
    esSky.visible = !night;
    esSkyFallback.visible = night;
    const esu = esSky.material.uniforms;
    esu.turbidity.value = 3.4 + g * 3.0;
    esu.rayleigh.value = 2.1;
    esu.mieCoefficient.value = 0.0028;
    esu.mieDirectionalG.value = 0.76;
    if (esu.sunPosition) esu.sunPosition.value.copy(sdir).multiplyScalar(100);
  }
  esSkyMat.color.copy(Tc).lerp(H, 0.45);
  if (night) esSkyMat.color.lerp(new THREE.Color(0x1f2b44), 0.6);
  esGroundMat.color.set(bm.groundCol);
  esSunDisc.position.copy(sdir).multiplyScalar(32);
  esSunMat.color.set(sc).multiplyScalar(night ? 0.4 : 1.8);

  S.fog.color.copy(H);
  const baseFog = bm.fogDensity || 0.00036;
  S.fog.density = [baseFog, 0.0020, 0.00084, 0.00125][set.wx];
  R.setClearColor(H);

  stars.material.opacity = night ? 1 - g * 0.65 : 0;

  if (biomeEmissives.houseWinM) {
    biomeEmissives.houseWinM.emissiveIntensity = night ? 1.45 : (lowSun || bm.id === 'snow' ? 0.35 : 0);
  }
  if (biomeEmissives.catReflectorMat) {
    biomeEmissives.catReflectorMat.emissiveIntensity = night ? 2.8 : (lowSun ? 1.8 : 1.0);
  }
  if (biomeEmissives.kmSignMat) {
    biomeEmissives.kmSignMat.emissiveIntensity = night ? 0.95 : 0.45;
  }
  if (biomeEmissives.skyscraperBodyM) {
    biomeEmissives.skyscraperBodyM.emissiveIntensity = night ? 1.25 : (lowSun ? 0.45 : 0.10);
  }
  if (biomeEmissives.streetlightBulbM) {
    biomeEmissives.streetlightBulbM.emissiveIntensity = night ? 2.6 : (lowSun ? 1.35 : 0.2);
  }
  if (biomeEmissives.streetlightPoolM) {
    biomeEmissives.streetlightPoolM.opacity = night ? 0.36 : (lowSun ? 0.18 : 0.0);
  }
  if (biomeEmissives.gantrySignM) {
    biomeEmissives.gantrySignM.emissiveIntensity = night ? 1.15 : 0.55;
  }
  if (biomeEmissives.lanternFlameM) {
    biomeEmissives.lanternFlameM.emissiveIntensity = night ? 2.2 : (lowSun ? 1.1 : 0.35);
  }

  // Partículas ambientais do bioma
  if (bm.particle === 'sakura') {
    ambientParticles.material.color.setHex(0xf4a7bb);
    ambientParticles.material.size = 0.34;
    ambientParticles.material.opacity = 0.85;
  } else if (bm.particle === 'snow') {
    ambientParticles.material.color.setHex(0xdce6f2);
    ambientParticles.material.size = 0.28;
    ambientParticles.material.opacity = 0.82;
  } else if (bm.particle === 'dust') {
    ambientParticles.material.color.setHex(0xdcb88a);
    ambientParticles.material.size = 0.24;
    ambientParticles.material.opacity = 0.42;
  }

  const wet = set.wx == 3;
  const snowyRoad = bm.id === 'snow';
  terrainUniforms.uWetTerrain.value = wet ? 1.0 : 0.0;
  roadM.roughness = wet ? 0.22 : (snowyRoad ? 0.46 : (bm.id === 'desert' ? 0.84 : 0.74));
  roadM.metalness = 0.0;
  roadM.envMapIntensity = wet ? 0.92 : (snowyRoad ? 0.58 : (bm.id === 'city' ? 0.44 : 0.34));
  roadM.color.set(wet ? 0xc4ccd8 : (bm.id === 'desert' ? 0xf2e7d8 : (snowyRoad ? 0xd2dae4 : 0xffffff)));

  rain.visible = wet;
  spot.intensity = night ? 6.8 : (lowSun || wet ? 3.2 : 0.75);
  headFill.intensity = night ? 2.2 : (lowSun || wet ? 1.0 : 0.25);

  envListeners.forEach(fn => fn({ night, lowSun, wet, g, biome: bm }));
  envUpdate();
}

// Constrói o bioma inicial
rebuildBiome(set.biome || 0);
