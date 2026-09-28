/* Hero 3D scene: a laptop that types a short "about me" in code, with floating keycaps.
   Source file. Bundled to assets/js/hero-3d.js by `npm run build` (esbuild + three.js). */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D,
  MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, BoxGeometry,
  DirectionalLight, PointLight, AmbientLight, CanvasTexture, PMREMGenerator,
  SRGBColorSpace, ACESFilmicToneMapping, Color, MathUtils
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.querySelector('.hero-3d');
if (canvas) start(canvas);

function start(canvas) {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = canvas.closest('.hero');

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    canvas.closest('.hero-visual')?.classList.add('no-webgl');
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 2.4, 8.4);
  camera.lookAt(0, 0.55, 0);

  /* ── Theme ────────────────────────────────────────────────────────────── */
  const isLight = () => root.dataset.theme
    ? root.dataset.theme === 'light'
    : window.matchMedia('(prefers-color-scheme: light)').matches;

  const palette = () => isLight()
    ? { body: '#c9ccd3', deck: '#b7bac2', keys: '#e9eaee', accent: '#00a866', cap: '#f4f4f5', shadow: 0.22 }
    : { body: '#3a3c44', deck: '#2c2e35', keys: '#1d1e23', accent: '#00d982', cap: '#26272d', shadow: 0.55 };

  /* ── Materials ────────────────────────────────────────────────────────── */
  const mBody = new MeshStandardMaterial({ metalness: 0.75, roughness: 0.32 });
  const mDeck = new MeshStandardMaterial({ metalness: 0.6, roughness: 0.45 });
  const mKeys = new MeshStandardMaterial({ metalness: 0.1, roughness: 0.7 });
  const mCap = new MeshStandardMaterial({ metalness: 0.2, roughness: 0.4 });
  const mAccent = new MeshStandardMaterial({ metalness: 0.3, roughness: 0.3, emissiveIntensity: 0.25 });

  function applyTheme() {
    const p = palette();
    mBody.color.set(p.body);
    mDeck.color.set(p.deck);
    mKeys.color.set(p.keys);
    mCap.color.set(p.cap);
    mAccent.color.set(p.accent);
    mAccent.emissive = new Color(p.accent);
    shadowMat.opacity = p.shadow;
    rim.color.set(p.accent);
  }

  /* ── Laptop ───────────────────────────────────────────────────────────── */
  const W = 3.3, D = 2.25, T = 0.14;
  const laptop = new Group();
  scene.add(laptop);

  const base = new Mesh(new RoundedBoxGeometry(W, T, D, 4, 0.07), mBody);
  laptop.add(base);

  const deck = new Mesh(new PlaneGeometry(W - 0.25, D - 0.3), mDeck);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = T / 2 + 0.002;
  laptop.add(deck);

  // Keyboard: one instanced mesh, 13 × 5 keys plus a space bar.
  const keyGeo = new BoxGeometry(0.19, 0.035, 0.19);
  const cols = 13, rows = 5, pitch = 0.225;
  const keys = new InstancedMesh(keyGeo, mKeys, cols * rows);
  const tmp = new Object3D();
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tmp.position.set((c - (cols - 1) / 2) * pitch, T / 2 + 0.02, -0.72 + r * pitch);
      tmp.scale.set(r === rows - 1 && c > 3 && c < 9 ? 0 : 1, 1, 1); // gap for the space bar
      tmp.updateMatrix();
      keys.setMatrixAt(k++, tmp.matrix);
    }
  }
  laptop.add(keys);
  const space = new Mesh(new BoxGeometry(pitch * 5 - 0.035, 0.035, 0.19), mKeys);
  space.position.set(0, T / 2 + 0.02, -0.72 + (rows - 1) * pitch);
  laptop.add(space);

  const pad = new Mesh(new PlaneGeometry(1.1, 0.5), mBody);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, T / 2 + 0.004, 0.72);
  laptop.add(pad);

  // Lid pivots on the back edge of the base.
  const lidPivot = new Group();
  lidPivot.position.set(0, T / 2, -D / 2 + 0.04);
  laptop.add(lidPivot);

  const LH = 2.15;
  const lid = new Mesh(new RoundedBoxGeometry(W, LH, 0.09, 4, 0.05), mBody);
  lid.position.set(0, LH / 2, 0);
  lidPivot.add(lid);

  const screenTex = makeScreenTexture();
  const screen = new Mesh(
    new PlaneGeometry(W - 0.26, LH - 0.24),
    new MeshBasicMaterial({ map: screenTex.texture, toneMapped: false })
  );
  screen.position.set(0, LH / 2, 0.047);
  lidPivot.add(screen);

  /* ── Floating keycaps ─────────────────────────────────────────────────── */
  const capGeo = new RoundedBoxGeometry(0.62, 0.3, 0.62, 3, 0.09);
  const caps = [
    { label: '</>', pos: [-2.2, 1.7, 0.2], mat: mAccent, ink: '#04150d' },
    { label: '{ }', pos: [2.05, 2.3, -0.6], mat: mCap },
    { label: 'AR', pos: [1.95, 0.25, 1.1], mat: mCap }
  ].map((c, i) => {
    const g = new Group();
    const body = new Mesh(capGeo, c.mat);
    const face = new Mesh(new PlaneGeometry(0.46, 0.46), new MeshBasicMaterial({
      map: makeLabelTexture(c.label, c.ink), transparent: true, toneMapped: false
    }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.151;
    g.add(body, face);
    g.position.set(...c.pos);
    g.rotation.set(0.5 + i * 0.3, i * 0.9, 0.25 - i * 0.2);
    g.userData = { base: new Float32Array(c.pos), phase: i * 2.1 };
    scene.add(g);
    return g;
  });

  /* ── Soft contact shadow ──────────────────────────────────────────────── */
  const shadowMat = new MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 });
  const shadow = new Mesh(new PlaneGeometry(6.2, 4.4), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.62;
  scene.add(shadow);

  /* ── Lights ───────────────────────────────────────────────────────────── */
  scene.add(new AmbientLight(0xffffff, 0.35));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const rim = new PointLight(0x00d982, 14, 12, 2);
  rim.position.set(2.5, 2.5, -2.5);
  scene.add(rim);

  applyTheme();

  /* ── Sizing ───────────────────────────────────────────────────────────── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const mobile = r.width < 520;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    // Pull back on narrow or tall canvases so the laptop always fits.
    camera.position.z = camera.aspect < 1.05 ? 9.8 : 9.2;
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(resize).observe(canvas);

  /* ── Motion state ─────────────────────────────────────────────────────── */
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0, scroll: 0 };
  let scroll = 0;

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function readScroll() {
    const h = hero ? hero.offsetHeight : window.innerHeight;
    scroll = MathUtils.clamp(window.scrollY / (h * 0.85), 0, 1);
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  /* ── Render loop ──────────────────────────────────────────────────────── */
  const OPEN = -0.28;           // lid tilted back ~16°
  const CLOSED = Math.PI / 2 - 0.06;
  let t0 = performance.now();
  let raf = 0, running = false, visible = true;

  // Watchdog: if this device can't hold ~20 fps, settle on a still frame.
  let lastNow = 0, slowFrames = 0, frames = 0, throttled = false;

  function frame(now) {
    const t = (now - t0) / 1000;
    if (lastNow && ++frames > 20) {
      slowFrames = now - lastNow > 50 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 15) throttled = true; // finish the code on screen, then hold still
    }
    lastNow = now;
    const damp = reduceMotion ? 1 : 0.07;
    eased.x += (pointer.x - eased.x) * damp;
    eased.y += (pointer.y - eased.y) * damp;
    eased.scroll += (scroll - eased.scroll) * (reduceMotion ? 1 : 0.1);
    const s = eased.scroll;

    // Intro: lid opens during the first second.
    const intro = reduceMotion ? 1 : MathUtils.smootherstep(t, 0.1, 1.3);
    lidPivot.rotation.x = MathUtils.lerp(CLOSED, OPEN, intro) + (CLOSED - OPEN) * s * 0.85;

    const float = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.06;
    laptop.position.y = float + s * 0.5;
    laptop.rotation.y = -0.5 + eased.x * 0.35 + s * 1.1;
    laptop.rotation.x = 0.08 + eased.y * 0.12 - s * 0.15;
    laptop.rotation.z = eased.x * -0.03;

    caps.forEach((g, i) => {
      const b = g.userData.base, ph = g.userData.phase;
      g.position.set(
        b[0] + eased.x * 0.25 * (i + 1) * 0.5,
        b[1] + (reduceMotion ? 0 : Math.sin(t * 1.3 + ph) * 0.12) + s * (0.8 + i * 0.3),
        b[2]
      );
      if (!reduceMotion) { g.rotation.y += 0.004 + i * 0.001; g.rotation.x += 0.002; }
    });

    shadow.scale.setScalar(1 - float * 0.8 - s * 0.2);
    screenTex.update(throttled ? 99 : t);
    render();

    if (!reduceMotion && !throttled && visible && !document.hidden) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function render() { renderer.render(scene, camera); }

  function wake() {
    if (running || throttled || !visible || document.hidden) return;
    lastNow = 0;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  }).observe(canvas);
  document.addEventListener('visibilitychange', wake);

  // Theme changes repaint once even when paused.
  const onTheme = () => { applyTheme(); render(); };
  new MutationObserver(onTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', onTheme);

  resize();
  if (reduceMotion) { screenTex.update(99); frame(performance.now()); }
  else wake();
  requestAnimationFrame(() => canvas.closest('.hero-visual')?.classList.add('is-ready'));
}

/* ── Textures drawn with Canvas 2D ─────────────────────────────────────── */

function makeScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 672;
  const g = c.getContext('2d');
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  // Every value below is real information from the portfolio.
  const C = { kw: '#c792ea', key: '#82aaff', str: '#a5e3b5', punc: '#8b93a7', txt: '#e6e8ee', com: '#5c6370' };
  const lines = [
    [['// about.ts', C.com]],
    [['const ', C.kw], ['jeremiah', C.txt], [' = {', C.punc]],
    [['  role', C.key], [': ', C.punc], ["'Full-stack developer'", C.str], [',', C.punc]],
    [['  school', C.key], [': ', C.punc], ["'BSIT · St. Mary’s'", C.str], [',', C.punc]],
    [['  stack', C.key], [': [', C.punc], ["'Laravel'", C.str], [', ', C.punc], ["'React'", C.str], [', ', C.punc], ["'TS'", C.str], ['],', C.punc]],
    [['  building', C.key], [': ', C.punc], ["'GABAY (AR)'", C.str], [',', C.punc]],
    [['  published', C.key], [': ', C.punc], ['2025', '#f78c6c'], [',', C.punc]],
    [['  openTo', C.key], [': [', C.punc], ["'Internship'", C.str], [', ', C.punc], ["'OJT'", C.str], ['],', C.punc]],
    [['};', C.punc]]
  ];
  const total = lines.reduce((n, l) => n + l.reduce((m, [s]) => m + s.length, 0), 0);
  let lastShown = -1, lastBlink = -1;

  function update(t) {
    const shown = Math.min(total, Math.floor(Math.max(0, t - 1.2) * 38));
    const blink = Math.floor(t * 2) % 2;
    if (shown === lastShown && blink === lastBlink) return;
    lastShown = shown; lastBlink = blink;

    g.fillStyle = '#0f1117';
    g.fillRect(0, 0, c.width, c.height);
    // title bar
    g.fillStyle = '#171a22';
    g.fillRect(0, 0, c.width, 64);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      g.fillStyle = col; g.beginPath(); g.arc(40 + i * 34, 32, 10, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#8b93a7';
    g.font = '500 26px "Geist Mono", ui-monospace, monospace';
    g.fillText('about.ts', 170, 41);

    g.font = '500 33px "Geist Mono", ui-monospace, monospace';
    let left = shown, y = 132, cx = 96, cy = 132;
    lines.forEach((line, i) => {
      g.fillStyle = '#3b4252';
      g.fillText(String(i + 1).padStart(2, ' '), 26, y);
      let x = 96;
      for (const [text, color] of line) {
        if (left <= 0) break;
        const part = text.slice(0, left);
        left -= part.length;
        g.fillStyle = color;
        g.fillText(part, x, y);
        x += g.measureText(part).width;
        cx = x; cy = y;           // cursor follows the last typed character
      }
      y += 60;
    });
    if (blink || shown < total) {
      g.fillStyle = '#00d982';
      g.fillRect(cx + 4, cy - 28, 16, 36);
    }
    texture.needsUpdate = true;
  }
  update(0);
  return { texture, update };
}

function makeLabelTexture(text, ink) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = ink || '#00b36b';
  g.font = '600 104px "Geist Mono", ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 136);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}
