/* Live cursors
   - A swarm of tiny cursors drifts over the page (canvas) and scatters away from your mouse.
   - Three named cursors frame each block as it scrolls in (main.js calls construct()),
     then play with the page: tilt cards, restyle headings and chips, retype the hero line.
   - Edit mode lets visitors select any element, restyle it and drag it around.
   Dependency-free. Loaded before main.js. */
(function () {
  'use strict';

  var api = { enabled: false, construct: function () { return Promise.resolve(); } };
  window.PortfolioCursors = api;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var wide = matchMedia('(min-width: 720px)');
  if (reduce.matches) return;
  var full = fine.matches && wide.matches; // named cursors + edit mode only on desktop

  /* ── Settings ─────────────────────────────────────────────────────────── */
  // Ten named cursors work on the page at once. Add, remove or rename them here.
  var BOTS = [
    { name: 'Designer',  color: '#8cc8ff' },
    { name: 'Developer', color: '#ff8fb8' },
    { name: 'Recruiter', color: '#ffc24b' },
    { name: 'Client',    color: '#a9ecd0' },
    { name: 'Tester',    color: '#c9b6ff' },
    { name: 'Mentor',    color: '#ffb49b' },
    { name: 'Adviser',   color: '#7fe0e6' },
    { name: 'Classmate', color: '#f5e27a' },
    { name: 'PM',        color: '#ff9e6b' },
    { name: 'Intern',    color: '#d8f08a' }
  ];
  var SWARM_COLORS = ['#8cc8ff', '#ff8fb8', '#ffc24b', '#a9ecd0', '#ffb49b', '#ffffff', '#c9b6ff'];
  var SWATCHES = ['#e2553a', '#4a1826', '#8cc8ff', '#ff8fb8', '#ffc24b', '#a9ecd0', '#c9b6ff'];
  var PHRASES = ['mobile, web and AR apps', 'tools for my campus', 'apps my town can use', 'things you can tap'];
  // [selector, label shown on the selection box, kind]
  var EDITABLE = [
    ['.hero-title', 'Hero title', 'text'],
    ['.hero-title .hl', 'Name', 'text'],
    ['.kicker', 'Kicker', 'text'],
    ['.hero-actions .btn', 'Button', 'fill'],
    ['.hero-photo', 'Photo', 'box'],
    ['.sticker', 'Sticker', 'fill'],
    ['.eyebrow', 'Eyebrow', 'text'],
    ['.section-title', 'Section title', 'text'],
    ['.project-title', 'Project title', 'text'],
    ['.art-chip', 'Chip', 'fill'],
    ['.badge', 'Badge', 'fill'],
    ['.tags li', 'Tag', 'fill'],
    ['.chips li', 'Chip', 'fill'],
    ['.stack-row dt', 'Label', 'text'],
    ['.timeline-when', 'Year', 'text'],
    ['.gallery li', 'Photo', 'box'],
    ['.contact-title', 'Heading', 'text'],
    ['.qr-card', 'QR card', 'box'],
    ['.collage', 'Photo', 'box']
  ];

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ── Overlay ──────────────────────────────────────────────────────────── */
  var layer = document.createElement('div');
  layer.className = 'cx-layer';
  layer.setAttribute('aria-hidden', 'true');
  var canvas = document.createElement('canvas');
  canvas.className = 'cx-swarm';
  layer.appendChild(canvas);
  document.body.appendChild(layer);
  var ctx = canvas.getContext('2d');
  var dpr = 1, W = 0, H = 0;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  resize();
  addEventListener('resize', resize);

  function ring(x, y, color) {
    var el = document.createElement('div');
    el.className = 'cx-ring';
    el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--rc:' + color;
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 520);
  }

  /* ── Swarm of tiny cursors ────────────────────────────────────────────── */
  var mouse = { x: -999, y: -999 };
  addEventListener('pointermove', function (e) { if (e.isTrusted) { mouse.x = e.clientX; mouse.y = e.clientY; } }, { passive: true });
  var swarmCount = full ? 22 : 10;
  var swarm = [];
  for (var i = 0; i < swarmCount; i++) {
    swarm.push({
      x: rand(0, W), y: rand(0, H), vx: rand(-.4, .4), vy: rand(-.4, .4),
      a: rand(0, Math.PI * 2), s: rand(.7, 1.15), c: pick(SWARM_COLORS), next: rand(3000, 9000)
    });
  }
  var swarmOn = true;
  function drawArrow(x, y, s, c) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(11, 5.3); ctx.lineTo(6.2, 6.5); ctx.lineTo(4.1, 11.3); ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(30,6,14,.75)'; ctx.stroke();
    ctx.restore();
  }
  function stepSwarm(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!swarmOn) return;
    swarm.forEach(function (p) {
      p.a += rand(-.25, .25);
      p.vx += Math.cos(p.a) * .03; p.vy += Math.sin(p.a) * .03;
      var dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 140 && d > 0) { var f = (140 - d) / 140 * .9; p.vx += dx / d * f; p.vy += dy / d * f; }
      var sp = Math.hypot(p.vx, p.vy), max = d < 140 ? 4.5 : .9;
      if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 10; if (p.x > W + 20) p.x = -10;
      if (p.y < -20) p.y = H + 10; if (p.y > H + 20) p.y = -10;
      p.next -= dt;
      if (p.next < 0) { p.next = rand(4000, 11000); ring(p.x + 2, p.y + 2, p.c); }
      drawArrow(p.x, p.y, p.s, p.c);
    });
  }

  if (!full) {
    var lastM = performance.now();
    (function loopMobile(now) { stepSwarm(now - lastM); lastM = now; requestAnimationFrame(loopMobile); })(lastM);
    return;
  }

  /* ── Editable registry ────────────────────────────────────────────────── */
  var editable = [];
  EDITABLE.forEach(function (row) {
    document.querySelectorAll(row[0]).forEach(function (el) {
      if (el.dataset.cxName) return;
      el.dataset.cxName = row[1];
      el.dataset.cxKind = row[2];
      editable.push(el);
    });
  });
  var busyEls = new Set();
  var pending = function (el) { return !!el.closest('.reveal:not(.is-visible)'); };
  var inView = function (el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.top > 70 && r.bottom < innerHeight - 70 && r.left >= 0 && r.right <= innerWidth;
  };

  /* ── Selection boxes and named cursors ────────────────────────────────── */
  var arrow = function (c) {
    return '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l17 8.2-7.3 1.9L9.6 19.6z" fill="' + c +
      '" stroke="#1e060e" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  };
  function makeSel(color) {
    var box = document.createElement('div');
    box.className = 'cx-sel';
    box.style.setProperty('--sc', color);
    box.innerHTML = '<i></i><i></i><i></i><i></i><span class="cx-dim"></span>';
    layer.appendChild(box);
    return { box: box, dim: box.querySelector('.cx-dim'), target: null, mode: 'fit', bot: null };
  }
  function drawSel(s) {
    if (!s.target || !s.target.isConnected) { s.box.classList.remove('is-on'); return; }
    var r = s.target.getBoundingClientRect(), x = r.left, y = r.top, w = r.width, h = r.height, label;
    if (s.mode === 'draw') {
      w = Math.max(0, Math.min(r.width, s.bot.x - r.left));
      h = Math.max(0, Math.min(r.height, s.bot.y - r.top));
      label = 'Frame';
    } else {
      x -= 3; y -= 3; w += 6; h += 6;
      label = s.target.dataset.cxName || 'Frame';
    }
    s.box.classList.add('is-on');
    s.box.classList.toggle('is-drawing', s.mode === 'draw');
    s.box.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    s.box.style.width = w + 'px';
    s.box.style.height = h + 'px';
    s.dim.textContent = label + ' · ' + Math.round(s.mode === 'draw' ? w : r.width) + ' × ' + Math.round(s.mode === 'draw' ? h : r.height);
  }

  function Bot(cfg, i) {
    this.name = cfg.name; this.color = cfg.color;
    this.el = document.createElement('div');
    this.el.className = 'cx-cur';
    this.el.innerHTML = arrow(cfg.color) + '<span class="cx-tag" style="background:' + cfg.color + '">' + cfg.name + '</span>';
    layer.appendChild(this.el);
    this.sel = makeSel(cfg.color);
    this.sel.bot = this;
    this.x = i % 2 ? innerWidth + 40 : -40;
    this.y = innerHeight * (((i % 5) + 1) / 6);
    this.tx = this.x; this.ty = this.y;
    this.anchor = null; this.done = null; this.busy = false; this.tilt = null;
  }
  Bot.prototype.go = function (x, y) {
    var self = this;
    this.anchor = null; this.tx = x; this.ty = y;
    return Promise.race([new Promise(function (r) { self.done = r; }), wait(1600)]);
  };
  // Follow a point inside an element (fractions of its box) so the target tracks the page while scrolling.
  Bot.prototype.follow = function (el, fx, fy) {
    var self = this;
    this.anchor = { el: el, fx: fx, fy: fy };
    return Promise.race([new Promise(function (r) { self.done = r; }), wait(1600)]);
  };
  Bot.prototype.step = function () {
    if (this.anchor) {
      var r = this.anchor.el.getBoundingClientRect();
      this.tx = clamp(r.left + r.width * this.anchor.fx, 6, innerWidth - 24);
      this.ty = clamp(r.top + r.height * this.anchor.fy, 6, innerHeight - 70);
    }
    this.x += (this.tx - this.x) * 0.16;
    this.y += (this.ty - this.y) * 0.16;
    this.el.style.transform = 'translate(' + this.x + 'px,' + this.y + 'px)';
    if (this.tilt) this.tilt.dispatchEvent(new PointerEvent('pointermove', { clientX: this.x, clientY: this.y, bubbles: true }));
    if (this.done && Math.hypot(this.tx - this.x, this.ty - this.y) < 3) { var d = this.done; this.done = null; d(); }
    drawSel(this.sel);
  };
  Bot.prototype.click = function () {
    var el = this.el;
    el.classList.add('is-down');
    setTimeout(function () { el.classList.remove('is-down'); }, 160);
    ring(this.x + 2, this.y + 2, this.color);
  };
  Bot.prototype.wander = function () {
    return this.go(clamp(this.x + rand(-280, 280), 40, innerWidth - 120), clamp(this.y + rand(-200, 200), 90, innerHeight - 120));
  };
  var bots = BOTS.map(function (c, i) { return new Bot(c, i); });

  /* ── Construct: drag a frame over a block as it scrolls in ────────────── */
  api.construct = function (el) {
    if (!api.enabled || document.hidden || !wide.matches) return Promise.resolve();
    var r0 = el.getBoundingClientRect();
    var free = bots.filter(function (b) { return !b.busy; });
    if (!free.length) return Promise.resolve();
    var bot = free.sort(function (a, b) {
      return Math.hypot(a.x - r0.left, a.y - r0.top) - Math.hypot(b.x - r0.left, b.y - r0.top);
    })[0];
    bot.busy = true;
    return new Promise(function (resolve) {
      var safety = setTimeout(resolve, 2200);
      (async function () {
        await bot.follow(el, 0, 0);
        bot.click();
        bot.sel.target = el; bot.sel.mode = 'draw';
        await bot.follow(el, 1, 1);
        bot.sel.mode = 'fit';
        bot.click();
        clearTimeout(safety); resolve();
        await wait(650);
        bot.sel.target = null; bot.anchor = null;
        await bot.wander();
        bot.busy = false;
      })();
    });
  };

  /* ── Edits (cursors undo theirs; visitors' edits stay until reset) ──────── */
  function snapshot(el) {
    return { color: el.style.color, bg: el.style.backgroundColor, rotate: el.style.rotate, scale: el.style.scale, translate: el.style.translate };
  }
  function restore(el, s) {
    el.style.color = s.color; el.style.backgroundColor = s.bg;
    el.style.rotate = s.rotate; el.style.scale = s.scale; el.style.translate = s.translate;
  }
  function recolor(el, c) {
    if (el.dataset.cxKind === 'fill') {
      el.style.backgroundColor = c;
      el.style.color = (c === '#4a1826' || c === '#e2553a') ? '#fffaf6' : '#2a0f18';
    } else {
      el.style.color = c;
    }
  }
  var botActions = {
    color: function (el) { recolor(el, pick(SWATCHES)); },
    rotate: function (el) {
      var m = el.dataset.cxKind === 'fill' ? 8 : el.dataset.cxKind === 'box' ? 4 : 2;
      el.style.rotate = rand(-m, m).toFixed(1) + 'deg';
    },
    scale: function (el) { el.style.scale = (el.dataset.cxKind === 'box' ? rand(0.95, 1.05) : rand(1.04, 1.14)).toFixed(2); }
  };
  var actionsFor = function (el) { return el.dataset.cxKind === 'box' ? ['rotate', 'scale'] : ['color', 'color', 'rotate', 'scale']; };

  async function doEdit(bot) {
    var options = editable.filter(function (el) { return !busyEls.has(el) && !el.dataset.cxUser && !pending(el) && inView(el); });
    if (!options.length) return bot.wander();
    var el = pick(options);
    busyEls.add(el);
    await bot.follow(el, rand(0.35, 0.8), rand(0.35, 0.75));
    bot.sel.target = el; bot.sel.mode = 'fit';
    await wait(350);
    var before = snapshot(el);
    el.classList.add('cx-anim');
    bot.click();
    botActions[pick(actionsFor(el))](el);
    await wait(1700);
    if (!el.dataset.cxUser) restore(el, before);
    await wait(550);
    if (!el.dataset.cxUser) el.classList.remove('cx-anim');
    bot.sel.target = null;
    busyEls.delete(el);
  }

  async function doTilt(bot) {
    var cards = Array.prototype.filter.call(document.querySelectorAll('.tilt'), function (el) { return !pending(el) && inView(el) && !busyEls.has(el); });
    if (!cards.length) return bot.wander();
    var el = pick(cards);
    busyEls.add(el);
    await bot.follow(el, 0.2, 0.3);
    bot.tilt = el;
    await bot.follow(el, 0.8, 0.35);
    await bot.follow(el, 0.7, 0.8);
    await bot.follow(el, 0.3, 0.6);
    bot.tilt = null;
    el.dispatchEvent(new PointerEvent('pointerleave'));
    busyEls.delete(el);
  }

  var phraseEl = document.querySelector('.hero-phrase');
  var roleEl = phraseEl && phraseEl.parentElement;
  if (roleEl) roleEl.setAttribute('aria-label', roleEl.textContent.replace(/\s+/g, ' ').trim());
  async function doType(bot) {
    if (!phraseEl || !inView(roleEl) || busyEls.has(roleEl)) return doEdit(bot);
    busyEls.add(roleEl);
    var r = phraseEl.getBoundingClientRect();
    await bot.go(r.right - 4, r.bottom - 10);
    bot.click();
    roleEl.classList.add('cx-typing');
    var current = phraseEl.textContent.trim();
    while (phraseEl.textContent.length) { phraseEl.textContent = phraseEl.textContent.slice(0, -1); await wait(22); }
    var next = pick(PHRASES.filter(function (p) { return p !== current; }));
    for (var i = 0; i < next.length; i++) { phraseEl.textContent += next[i]; await wait(rand(40, 95)); }
    await wait(400);
    roleEl.classList.remove('cx-typing');
    busyEls.delete(roleEl);
  }

  async function idle(bot) {
    await wait(rand(2500, 4000));
    for (;;) {
      await wait(rand(1400, 3400));
      if (!api.enabled || bot.busy || document.hidden || editMode) continue;
      bot.busy = true;
      var roll = Math.random();
      try {
        if (roll < 0.48) await doEdit(bot);
        else if (roll < 0.7) await doTilt(bot);
        else if (roll < 0.84) await doType(bot);
        else await bot.wander();
      } catch (e) { /* keep the loop alive */ }
      bot.sel.target = null;
      bot.busy = false;
    }
  }

  /* ── Your cursor tag ──────────────────────────────────────────────────── */
  var you = document.createElement('div');
  you.className = 'cx-you';
  you.innerHTML = '<span class="cx-tag">You</span>';
  layer.appendChild(you);
  addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && e.isTrusted) you.classList.add('is-on'); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { you.classList.remove('is-on'); });

  /* ── Edit mode ────────────────────────────────────────────────────────── */
  var editMode = false;
  var userSel = makeSel('#e2553a');
  userSel.box.classList.add('cx-user');
  var insp = document.createElement('div');
  insp.className = 'cx-insp';
  insp.hidden = true;
  insp.setAttribute('role', 'dialog');
  insp.setAttribute('aria-label', 'Edit element');
  insp.innerHTML =
    '<div class="cx-insp-h"><span class="cx-insp-name"></span><button type="button" class="cx-x" aria-label="Deselect">×</button></div>' +
    '<div class="cx-row cx-row-sw"><span>Color</span><div class="cx-sw">' +
    SWATCHES.map(function (c) { return '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="Color ' + c + '"></button>'; }).join('') +
    '</div></div>' +
    '<label class="cx-row" for="cx-size"><span>Size</span><input type="range" id="cx-size" min="80" max="130" step="1"><output></output></label>' +
    '<label class="cx-row" for="cx-rot"><span>Rotate</span><input type="range" id="cx-rot" min="-15" max="15" step="1"><output></output></label>' +
    '<button type="button" class="cx-reset">Reset element</button>';
  document.body.appendChild(insp);
  var inName = insp.querySelector('.cx-insp-name');
  var inSize = insp.querySelector('#cx-size'), inRot = insp.querySelector('#cx-rot');
  var outs = insp.querySelectorAll('output');
  var originals = new Map();

  function select(el) {
    if (userSel.target) busyEls.delete(userSel.target);
    userSel.target = el || null;
    if (!el) { insp.hidden = true; return; }
    bots.forEach(function (b) { if (b.sel.target === el) b.sel.target = null; });
    busyEls.add(el);
    if (!originals.has(el)) originals.set(el, snapshot(el));
    inName.textContent = el.dataset.cxName;
    insp.querySelector('.cx-row-sw').hidden = el.dataset.cxKind === 'box';
    insp.hidden = false;
    syncInspector();
  }
  function syncInspector() {
    var el = userSel.target; if (!el) return;
    var s = Math.round((parseFloat(el.style.scale) || 1) * 100), r = Math.round(parseFloat(el.style.rotate) || 0);
    inSize.value = s; outs[0].textContent = s + '%';
    inRot.value = r; outs[1].textContent = r + '°';
  }
  function markUser(el) { el.dataset.cxUser = '1'; el.classList.add('cx-anim'); }
  function placeInspector() {
    if (!userSel.target) return;
    var r = userSel.target.getBoundingClientRect(), w = insp.offsetWidth, h = insp.offsetHeight;
    var left = r.right + 14;
    if (left + w > innerWidth - 8) left = r.left - w - 14;
    left = clamp(left, 8, innerWidth - w - 8);
    insp.style.transform = 'translate(' + left + 'px,' + clamp(r.top, 76, innerHeight - h - 76) + 'px)';
  }

  insp.querySelector('.cx-sw').addEventListener('click', function (e) {
    var b = e.target.closest('button'), el = userSel.target;
    if (b && el) { markUser(el); recolor(el, b.dataset.c); }
  });
  inSize.addEventListener('input', function () { var el = userSel.target; if (el) { markUser(el); el.style.scale = inSize.value / 100; syncInspector(); } });
  inRot.addEventListener('input', function () { var el = userSel.target; if (el) { markUser(el); el.style.rotate = inRot.value + 'deg'; syncInspector(); } });
  insp.querySelector('.cx-reset').addEventListener('click', function () {
    var el = userSel.target; if (!el) return;
    restore(el, originals.get(el)); delete el.dataset.cxUser; syncInspector();
  });
  insp.querySelector('.cx-x').addEventListener('click', function () { select(null); });

  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    if (!editMode || e.button !== 0 || e.target.closest('.cx-insp, .cx-bar')) return;
    var el = e.target.closest('[data-cx-name]');
    select(el);
    if (el) {
      e.preventDefault();
      var t = (el.style.translate || '0px 0px').split(' ');
      drag = { el: el, sx: e.clientX, sy: e.clientY, ox: parseFloat(t[0]) || 0, oy: parseFloat(t[1]) || 0, moved: false };
    }
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    markUser(drag.el);
    drag.el.classList.add('cx-dragging');
    drag.el.style.translate = (drag.ox + dx) + 'px ' + (drag.oy + dy) + 'px';
  });
  document.addEventListener('pointerup', function () { if (drag) drag.el.classList.remove('cx-dragging'); drag = null; });
  // In edit mode, clicks select instead of following links or pressing buttons.
  document.addEventListener('click', function (e) {
    if (!editMode || e.target.closest('.cx-insp, .cx-bar')) return;
    if (e.target.closest('[data-cx-name], a, button')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && editMode) { if (userSel.target) select(null); else setEdit(false); }
  });

  /* ── Bottom bar ───────────────────────────────────────────────────────── */
  var bar = document.createElement('div');
  bar.className = 'cx-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Live cursors');
  bar.innerHTML =
    '<span class="cx-dots" aria-hidden="true">' +
    BOTS.slice(0, 4).map(function (b) { return '<b style="background:' + b.color + '">' + b.name[0] + '</b>'; }).join('') +
    (BOTS.length > 4 ? '<b class="cx-dot-more">+' + (BOTS.length - 4) + '</b>' : '') +
    '<b class="cx-dot-you">Y</b></span>' +
    '<span class="cx-count">' + (BOTS.length + 1) + ' editing</span>' +
    '<span class="cx-hint">Click anything to restyle it, drag to move</span>' +
    '<button type="button" class="cx-edit" aria-pressed="false">Edit mode</button>' +
    '<button type="button" class="cx-reset-all" hidden>Reset</button>' +
    '<button type="button" class="cx-toggle"></button>';
  document.body.appendChild(bar);
  var editBtn = bar.querySelector('.cx-edit'), resetAll = bar.querySelector('.cx-reset-all'), toggleBtn = bar.querySelector('.cx-toggle');

  function setEdit(on) {
    editMode = on;
    document.documentElement.classList.toggle('cx-editing', on);
    editBtn.setAttribute('aria-pressed', String(on));
    editBtn.textContent = on ? 'Done editing' : 'Edit mode';
    resetAll.hidden = !on;
    if (!on) select(null);
  }
  function setBots(on) {
    api.enabled = on;
    swarmOn = on;
    layer.classList.toggle('cx-bots-off', !on);
    toggleBtn.textContent = on ? 'Hide cursors' : 'Show cursors';
    if (!on) bots.forEach(function (b) { b.sel.target = null; });
    store.set('cursors', on ? 'on' : 'off');
  }
  editBtn.addEventListener('click', function () { setEdit(!editMode); });
  toggleBtn.addEventListener('click', function () { setBots(!api.enabled); });
  resetAll.addEventListener('click', function () {
    originals.forEach(function (s, el) { restore(el, s); delete el.dataset.cxUser; el.classList.remove('cx-anim'); });
    originals.clear();
    syncInspector();
  });
  setBots(store.get('cursors') !== 'off');

  /* ── Frame loop ───────────────────────────────────────────────────────── */
  var last = performance.now();
  (function frame(now) {
    stepSwarm(now - last); last = now;
    bots.forEach(function (b) { b.step(); });
    you.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    drawSel(userSel);
    placeInspector();
    requestAnimationFrame(frame);
  })(last);

  // Named cursors start working once the intro has wiped away.
  var started = false;
  function start() {
    if (started) return;
    started = true;
    bots.forEach(function (b, i) { setTimeout(function () { idle(b); }, i * 450); });
  }
  document.addEventListener('intro:done', start);
  setTimeout(start, 4000);
})();
