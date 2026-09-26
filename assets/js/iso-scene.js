/* Isometric voxel island for the hero — plain Canvas 2D, no libraries.
   Builds tile by tile on load, water shimmers, terrain rises under the pointer.
   Static (single frame) when the visitor prefers reduced motion. */
(function () {
  'use strict';

  var canvas = document.querySelector('.iso-scene');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── World ───────────────────────────────────────────────────────────── */
  var N = 10;                 // grid is N × N tiles
  var WATER = 0.55;           // height at which the sea sits
  var tiles = [];

  // Small deterministic PRNG so the island looks the same on every visit.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildWorld() {
    var rand = mulberry32(2025);
    var c = (N - 1) / 2;
    tiles = [];
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var dx = (x - c) / c, dy = (y - c) / c;
        var d = Math.sqrt(dx * dx * 1.1 + dy * dy);
        var wave = Math.sin(x * 0.9 + 1.3) * 0.35 + Math.cos(y * 0.8 - 0.4) * 0.35 + (rand() - 0.5) * 0.5;
        var h = (1 - d * 0.85) * 4.4 + wave;
        var level = Math.max(0, Math.round(h));
        var type = level === 0 ? 'water' : level === 1 ? 'sand' : level >= 5 ? 'rock' : 'grass';
        tiles.push({
          x: x, y: y,
          base: level === 0 ? WATER : level,
          type: type,
          tree: type === 'grass' && rand() < 0.22,
          lift: 0,              // animated extra height from the pointer
          born: 0               // 0 → 1 build-in progress
        });
      }
    }
  }

  /* ── Palette (reads the page theme) ──────────────────────────────────── */
  var P;
  function isLight() {
    var t = root.dataset.theme;
    if (t) return t === 'light';
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  function readPalette() {
    var light = isLight();
    P = {
      grass: light ? '#4cc38a' : '#34c77b',
      sand:  light ? '#e8d6a3' : '#cdb57a',
      rock:  light ? '#a1a1aa' : '#71717a',
      water: light ? '#7cc4e8' : '#1f6f8b',
      trunk: light ? '#8b6a4a' : '#6b4f35',
      leaf:  light ? '#1f9d5c' : '#178a4f',
      edge:  light ? 'rgba(10,10,11,0.10)' : 'rgba(0,0,0,0.28)'
    };
  }

  // Multiply a #rrggbb color's channels by f and return #rrggbb.
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    return '#' + [16, 8, 0].map(function (s) {
      var v = Math.min(255, Math.round(((n >> s) & 255) * f));
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  /* ── Geometry ────────────────────────────────────────────────────────── */
  var W = 0, H = 0, tw = 0, th = 0, uh = 0, ox = 0, oy = 0, dpr = 1;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tw = Math.min(W / (N + 0.3), (H * 1.45) / (N + 0.3));
    th = tw / 2;
    uh = th * 0.9;                       // height of one block level
    ox = W / 2;
    oy = (H - N * th) / 2 + uh * 2.4;     // leave headroom for tall columns and trees
  }

  function project(x, y, z) {
    return { x: ox + (x - y) * (tw / 2), y: oy + (x + y) * (th / 2) - z * uh };
  }

  // A column from z0 up to z1 on tile (x, y), with size s (1 = full tile).
  function prism(x, y, z0, z1, color, s) {
    var inset = (1 - s) / 2;
    var a = project(x + inset, y + inset, z1),         // back
        b = project(x + 1 - inset, y + inset, z1),     // right
        c = project(x + 1 - inset, y + 1 - inset, z1), // front
        d = project(x + inset, y + 1 - inset, z1);     // left
    var h = (z1 - z0) * uh;

    // left face
    ctx.fillStyle = shade(color, 0.72);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x, c.y + h); ctx.lineTo(d.x, d.y + h);
    ctx.closePath(); ctx.fill();
    // right face
    ctx.fillStyle = shade(color, 0.56);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + h); ctx.lineTo(c.x, c.y + h);
    ctx.closePath(); ctx.fill();
    // top face
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ── Drawing ─────────────────────────────────────────────────────────── */
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    // Painter's order: back (small x + y) to front.
    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      if (tl.born <= 0) continue;
      var e = 1 - Math.pow(1 - tl.born, 3);          // ease-out
      ctx.globalAlpha = e;
      ctx.save();
      ctx.translate(0, (1 - e) * -24);

      var top = tl.base + tl.lift;
      if (tl.type === 'water') {
        var bob = Math.sin(t / 900 + tl.x * 0.7 + tl.y * 0.5) * 0.06;
        var f = 1 + Math.sin(t / 700 + tl.x * 0.9 - tl.y * 0.6) * 0.06;
        prism(tl.x, tl.y, 0, top + bob, shade(P.water, f), 1);
      } else {
        prism(tl.x, tl.y, 0, top, tl.type === 'sand' ? P.sand : tl.type === 'rock' ? P.rock : P.grass, 1);
        if (tl.tree) {
          prism(tl.x, tl.y, top, top + 0.55, P.trunk, 0.22);
          prism(tl.x, tl.y, top + 0.55, top + 1.35, P.leaf, 0.62);
          prism(tl.x, tl.y, top + 1.35, top + 1.85, shade(P.leaf, 1.12), 0.36);
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ── Interaction ─────────────────────────────────────────────────────── */
  var pointer = null; // grid coords of the pointer, or null

  function toGrid(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var sx = clientX - r.left - ox, sy = clientY - r.top - oy + 2 * uh; // assume ~2 levels high
    var gx = (sx / (tw / 2) + sy / (th / 2)) / 2;
    var gy = (sy / (th / 2) - sx / (tw / 2)) / 2;
    return { x: gx, y: gy };
  }
  function onMove(e) { pointer = toGrid(e.clientX, e.clientY); wake(); }
  function onLeave() { pointer = null; wake(); }

  /* ── Loop ────────────────────────────────────────────────────────────── */
  var running = false, visible = true, start = 0, raf = 0;

  function step(now) {
    if (!start) start = now;
    var elapsed = now - start;

    for (var i = 0; i < tiles.length; i++) {
      var tl = tiles[i];
      // Build-in: wave out from the back corner.
      var delay = (tl.x + tl.y) * 55;
      tl.born = Math.min(1, Math.max(0, (elapsed - delay) / 450));

      var target = 0;
      if (pointer && tl.type !== 'water') {
        var dx = tl.x + 0.5 - pointer.x, dy = tl.y + 0.5 - pointer.y;
        target = Math.max(0, 1.6 - Math.sqrt(dx * dx + dy * dy)) * 0.9;
      }
      tl.lift += (target - tl.lift) * 0.14;
    }

    draw(now);

    // Keep animating while visible (water shimmer); stop entirely when hidden.
    if (visible && !document.hidden) raf = requestAnimationFrame(step);
    else running = false;
  }

  function wake() {
    if (reduceMotion.matches || running || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(step);
  }

  function renderStatic() {
    tiles.forEach(function (tl) { tl.born = 1; tl.lift = 0; });
    draw(0);
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  buildWorld();
  readPalette();
  resize();

  if (reduceMotion.matches) {
    renderStatic();
  } else {
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) wake();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', wake);
    wake();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      if (reduceMotion.matches || !running) draw(performance.now());
    }, 120);
  });

  // Repaint in the new palette when the theme changes.
  function onTheme() {
    readPalette();
    if (reduceMotion.matches || !running) draw(performance.now());
  }
  new MutationObserver(onTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', onTheme);
})();
