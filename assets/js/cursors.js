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
  // Eight agents build the page, one per letter of JEREMIAH in the bar. Their names show in the build log, not on the cursors.
  var BOTS = [
    { name: 'Layout Agent',   color: '#8cc8ff' },
    { name: 'Style Agent',    color: '#ff8fb8' },
    { name: 'Copy Agent',     color: '#ffc24b' },
    { name: 'QA Agent',       color: '#a9ecd0' },
    { name: 'Motion Agent',   color: '#c9b6ff' },
    { name: 'Data Agent',     color: '#ffb49b' },
    { name: 'Review Agent',   color: '#ff9e6b' },
    { name: 'Deploy Agent',   color: '#d8f08a' }
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
    ['.photo-deck', 'Photo deck', 'box'],
    ['.sticker', 'Sticker', 'fill'],
    ['.eyebrow', 'Eyebrow', 'text'],
    ['.section-title', 'Section title', 'text'],
    ['.slide-title', 'Project title', 'text'],
    ['.phone', 'Phone mockup', 'box'],
    ['.art-chip', 'Chip', 'fill'],
    ['.badge', 'Badge', 'fill'],
    ['.tags li', 'Tag', 'fill'],
    ['.fact', 'Flip card', 'box'],
    ['.tool', 'Tool', 'fill'],
    ['.tool-info', 'Info card', 'box'],
    ['.jcard', 'Milestone', 'box'],
    ['.jcard-year', 'Year', 'text'],
    ['.roll', 'Photo roll', 'box'],
    ['.topics button', 'Topic', 'fill'],
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
  var swarmCount = 0; // background swarm removed; tiny cursors only appear as click bursts
  var swarm = [];
  for (var i = 0; i < swarmCount; i++) {
    swarm.push({
      x: rand(0, W), y: rand(0, H), vx: rand(-.4, .4), vy: rand(-.4, .4),
      a: rand(0, Math.PI * 2), s: rand(.7, 1.15), c: pick(SWARM_COLORS), next: rand(3000, 9000)
    });
  }
  var swarmOn = true;
  var attract = null;   // { x, y, until } — the swarm rushes to where you click
  var particles = [];   // short-lived confetti cursors
  function burst(x, y, n) {
    for (var k = 0; k < n; k++) {
      var ang = rand(0, Math.PI * 2), sp = rand(2.5, 6.5);
      particles.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, s: rand(.6, 1), c: pick(SWARM_COLORS), life: 1 });
    }
  }
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
      if (attract && performance.now() < attract.until) {
        var ax = attract.x - p.x, ay = attract.y - p.y, ad = Math.hypot(ax, ay) || 1;
        p.vx += ax / ad * .35; p.vy += ay / ad * .35;
      }
      var dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 140 && d > 0) { var f = (140 - d) / 140 * .9; p.vx += dx / d * f; p.vy += dy / d * f; }
      var rushing = attract && performance.now() < attract.until;
      var sp = Math.hypot(p.vx, p.vy), max = rushing ? 7 : d < 140 ? 4.5 : .9;
      if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 10; if (p.x > W + 20) p.x = -10;
      if (p.y < -20) p.y = H + 10; if (p.y > H + 20) p.y = -10;
      p.next -= dt;
      if (p.next < 0) { p.next = rand(4000, 11000); ring(p.x + 2, p.y + 2, p.c); }
      drawArrow(p.x, p.y, p.s, p.c);
    });
    if (attract && performance.now() >= attract.until) {
      // Arrived: scatter outward from the click point.
      swarm.forEach(function (p) {
        var dx = p.x - attract.x, dy = p.y - attract.y, d = Math.hypot(dx, dy) || 1;
        if (d < 220) { p.vx += dx / d * 5; p.vy += dy / d * 5; }
      });
      ring(attract.x, attract.y, '#ffffff');
      attract = null;
    }
    particles = particles.filter(function (q) { return q.life > 0; });
    particles.forEach(function (q) {
      q.vy += .12; q.vx *= .985; q.x += q.vx; q.y += q.vy; q.life -= dt / 1100;
      ctx.globalAlpha = Math.max(0, q.life);
      drawArrow(q.x, q.y, q.s, q.c);
      ctx.globalAlpha = 1;
    });
  }

  // Buttons and links pop a burst of tiny cursors; clicking empty space calls the swarm over.
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || !swarmOn || window.__cxEditing) return;
    if (e.target.closest('.cx-bar, .cx-insp, .cx-chat, .cx-ink, .lightbox')) return;
    if (e.target.closest('a, button')) { burst(e.clientX, e.clientY, 16); return; }
  });

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
    // Collapsed to a small initial; the full name slides out only while the cursor is doing something.
    this.el.innerHTML = arrow(cfg.color) + '<span class="cx-tag" style="background:' + cfg.color + '"><b>' + cfg.name[0] +
      '</b><span class="cx-full">' + cfg.name.slice(1) + '</span></span>';
    layer.appendChild(this.el);
    this.sel = makeSel(cfg.color);
    this.sel.bot = this;
    this.x = i % 2 ? innerWidth + 40 : -40;
    this.y = innerHeight * (((i % 5) + 1) / 6);
    this.tx = this.x; this.ty = this.y;
    this.anchor = null; this.done = null; this.busy = false; this.tilt = null;
    this.speed = 0.2; this.limit = 1600;
    this.idx = i; this.homing = false; this.restSince = 0;
  }
  Bot.prototype.go = function (x, y) {
    var self = this;
    this.homing = false;
    this.anchor = null; this.tx = safeX(x); this.ty = safeY(y);
    return Promise.race([new Promise(function (r) { self.done = r; }), wait(this.limit)]);
  };
  // Follow a point inside an element (fractions of its box) so the target tracks the page while scrolling.
  Bot.prototype.follow = function (el, fx, fy) {
    var self = this;
    this.homing = false;
    this.anchor = { el: el, fx: fx, fy: fy };
    return Promise.race([new Promise(function (r) { self.done = r; }), wait(this.limit)]);
  };
  Bot.prototype.say = function (text, ms) {
    var b = this.bubble;
    if (!b) { b = this.bubble = document.createElement('span'); b.className = 'cx-say'; this.el.appendChild(b); }
    b.textContent = text;
    this.name_((ms || 2600) + 200);
    b.style.setProperty('--bc', this.color);
    b.classList.add('is-on');
    clearTimeout(this.sayT);
    this.sayT = setTimeout(function () { b.classList.remove('is-on'); }, ms || 2600);
  };
  // Cursors live in the visible content area: below the sticky nav, above the bottom bar.
  var TOP = 76, BOTTOM = 96;
  var safeY = function (y) { return clamp(y, TOP, innerHeight - BOTTOM); };
  var safeX = function (x) { return clamp(x, 12, innerWidth - 40); };
  var homeEl = document.querySelector('.photo-deck');
  var t0 = performance.now();
  // Resting: the agents tag along behind your mouse arrow in a loose little group.
  // Before the mouse has moved (or on touch), they wait on the left edge.
  var ringC = { x: 70, y: innerHeight * .5 };
  var OFFSETS = [[22, 26], [40, 14], [34, 44], [56, 32], [18, 54], [52, 58], [70, 18], [72, 46]];
  function homePoint(i) {
    var o = OFFSETS[i % OFFSETS.length];
    var t = (performance.now() - t0) / 1000;
    // A tiny idle wobble so they look alive, not pinned.
    return { x: ringC.x + o[0] + Math.sin(t * 1.7 + i) * 3, y: ringC.y + o[1] + Math.cos(t * 1.4 + i * 2) * 3 };
  }
  // Tiny colored cursor icon used in the bar, the build log and comment pins (no names, no letters).
  var miniArrow = function (c, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 14) + '" height="' + (size || 14) + '" aria-hidden="true"><path d="M3 2l17 8.2-7.3 1.9L9.6 19.6z" fill="' + c + '" stroke="#1e060e" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  };
  Bot.prototype.home = function () {
    this.anchor = null; this.followMouse = null; this.homing = true; this.restSince = performance.now();
  };
  Bot.prototype.step = function () {
    if (this.homing) {
      var h = homePoint(this.idx);
      this.tx = h.x; this.ty = h.y;
      this.el.classList.toggle('is-resting', performance.now() - this.restSince > 1500);
    } else {
      this.el.classList.remove('is-resting');
    }
    if (this.homing) { /* handled above */ } else if (this.followMouse && mouse.x > -500) {
      this.anchor = null;
      this.tx = safeX(mouse.x + this.followMouse.dx);
      this.ty = safeY(mouse.y + this.followMouse.dy);
    } else if (this.anchor) {
      var r = this.anchor.el.getBoundingClientRect();
      // The thing it was working on scrolled away: let go instead of sticking to the screen edge.
      if (r.bottom < TOP || r.top > innerHeight - BOTTOM) {
        this.anchor = null;
        this.sel.target = null;
        this.tx = safeX(this.x + rand(-120, 120));
        this.ty = rand(TOP + 40, innerHeight - BOTTOM - 40);
        if (this.done) { var d0 = this.done; this.done = null; d0(); }
      } else {
        this.tx = safeX(r.left + r.width * this.anchor.fx);
        this.ty = safeY(r.top + r.height * this.anchor.fy);
      }
    } else if (this.ty < TOP || this.ty > innerHeight - BOTTOM) {
      // A straggler left parked out of the content area drifts back in.
      this.ty = rand(TOP + 40, innerHeight - BOTTOM - 40);
    }
    var k = this.homing ? 0.07 + (this.idx % 8) * 0.018 : this.speed;
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.el.style.transform = 'translate(' + this.x + 'px,' + this.y + 'px)';
    if (this.tilt) this.tilt.dispatchEvent(new PointerEvent('pointermove', { clientX: this.x, clientY: this.y, bubbles: true }));
    if (this.done && Math.hypot(this.tx - this.x, this.ty - this.y) < 4) { var d = this.done; this.done = null; d(); }
    drawSel(this.sel);
  };
  Bot.prototype.name_ = function (ms) {
    var el = this.el;
    el.classList.add('is-named');
    clearTimeout(this.nameT);
    this.nameT = setTimeout(function () { el.classList.remove('is-named'); }, ms || 1400);
  };
  Bot.prototype.click = function () {
    var el = this.el;
    this.name_();
    el.classList.add('is-down');
    setTimeout(function () { el.classList.remove('is-down'); }, 160);
    ring(this.x + 2, this.y + 2, this.color);
  };
  Bot.prototype.wander = function () {
    return this.go(clamp(this.x + rand(-280, 280), 40, innerWidth - 120), clamp(this.y + rand(-200, 200), TOP + 30, innerHeight - BOTTOM - 30));
  };
  var bots = BOTS.map(function (c, i) { return new Bot(c, i); });

  /* ── Construct: drag a frame over a block as it scrolls in ────────────── */
  api.burst = function (x, y, n) { if (swarmOn) burst(x, y, n || 16); };
  api.construct = function (el) {
    if (!api.enabled || document.hidden || !wide.matches) return Promise.resolve();
    var r0 = el.getBoundingClientRect();
    var free = bots.filter(function (b) { return !b.busy; });
    if (!free.length) return Promise.resolve();
    var bot = free.sort(function (a, b) {
      return Math.hypot(a.x - r0.left, a.y - r0.top) - Math.hypot(b.x - r0.left, b.y - r0.top);
    })[0];
    bot.busy = true;
    bot.speed = 0.36; bot.limit = 650;   // building is quick, like a designer on a deadline
    return new Promise(function (resolve) {
      var safety = setTimeout(resolve, 1300);
      (async function () {
        await bot.follow(el, 0, 0);
        bot.click();
        bot.sel.target = el; bot.sel.mode = 'draw';
        await bot.follow(el, 1, 1);
        bot.sel.mode = 'fit';
        bot.click();
        log(bot, 'built ' + label(el));
        clearTimeout(safety); resolve();
        await wait(380);
        bot.sel.target = null; bot.anchor = null;
        bot.speed = 0.2; bot.limit = 1600;
        bot.home();
        bot.busy = false;
      })();
    });
  };

  /* ── Build log in the bottom bar ──────────────────────────────────────── */
  var logEl = null, logT = 0;
  function log(bot, text) {
    if (!logEl) return;
    logEl.innerHTML = miniArrow(bot.color, 13) + ' ' + text;
    logEl.classList.remove('is-new'); void logEl.offsetWidth; logEl.classList.add('is-new');
    clearTimeout(logT);
    logT = setTimeout(function () { logEl.innerHTML = '<i></i>All agents resting'; }, 6000);
  }
  var label = function (el) { return el && el.dataset.cxName ? el.dataset.cxName : (el && el.closest('section') && el.closest('section').querySelector('h2') ? el.closest('section').querySelector('h2').textContent.trim() : 'a block'); };

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
    var act = pick(actionsFor(el));
    botActions[act](el);
    log(bot, { color: 'restyled', rotate: 'rotated', scale: 'resized' }[act] + ' ' + label(el));
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
    log(bot, 'testing tilt on ' + label(el));
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
    log(bot, 'rewriting the hero line');
    for (var i = 0; i < next.length; i++) { phraseEl.textContent += next[i]; await wait(rand(40, 95)); }
    await wait(400);
    roleEl.classList.remove('cx-typing');
    busyEls.delete(roleEl);
  }

  /* Comments, scribbles, pins and following you */
  var LINES = {
    any: ['Aligning grid', 'Fixing spacing', 'Contrast OK', 'Shipping v3', 'Looks good', 'Tightening type', 'Hire Doy?', 'Approved', 'Rendering…', 'All tests pass'],
    project: ['Demo tested', 'Works on mobile', 'Real users!', 'Try the quiz', 'Built by Doy', 'Shipped'],
    photo: ['Good times', 'Core memory', 'Squad', 'Nice shot'],
    you: ['Hi, visitor', 'Watching you scroll', 'Want a tour?', 'Scroll down', 'Check the work']
  };

  var marks = [];
  function addMark(el, color, kind, ms) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'cx-mark cx-mark-' + kind);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', kind === 'circle'
      ? 'M52 4 C 84 3, 99 26, 97 52 C 95 80, 70 97, 46 96 C 18 95, 2 74, 4 47 C 6 22, 28 6, 58 8'
      : 'M2 60 C 18 40, 30 80, 48 58 S 78 40, 98 56');
    path.setAttribute('pathLength', '1');
    path.style.stroke = color;
    svg.appendChild(path);
    layer.appendChild(svg);
    var m = { el: el, svg: svg, kind: kind };
    marks.push(m);
    setTimeout(function () { svg.classList.add('is-out'); }, ms - 400);
    setTimeout(function () { svg.remove(); marks.splice(marks.indexOf(m), 1); }, ms);
    return m;
  }
  function drawMarks() {
    marks.forEach(function (m) {
      var r = m.el.getBoundingClientRect(), x, y, w, h;
      if (m.kind === 'circle') { x = r.left - 12; y = r.top - 10; w = r.width + 24; h = r.height + 20; }
      else { x = r.left - 4; y = r.bottom - 6; w = Math.min(r.width, 420) + 8; h = 16; }
      m.svg.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      m.svg.style.width = w + 'px'; m.svg.style.height = h + 'px';
    });
  }
  var pins = [];
  function addPin(el, bot, text, ms) {
    var pin = document.createElement('div');
    pin.className = 'cx-pin';
    pin.style.setProperty('--pc', bot.color);
    pin.innerHTML = '<b>' + miniArrow(bot.color, 14) + '</b><span>' + text + '</span>';
    layer.appendChild(pin);
    var p = { el: el, node: pin };
    pins.push(p);
    requestAnimationFrame(function () { pin.classList.add('is-on'); });
    setTimeout(function () { pin.classList.remove('is-on'); }, ms - 300);
    setTimeout(function () { pin.remove(); pins.splice(pins.indexOf(p), 1); }, ms);
  }
  function drawPins() {
    pins.forEach(function (p) {
      var r = p.el.getBoundingClientRect();
      p.node.style.transform = 'translate(' + clamp(r.right - 16, 8, innerWidth - 240) + 'px,' + clamp(r.top - 16, 70, innerHeight - 80) + 'px)';
    });
  }
  var visible = function (sel) {
    return Array.prototype.filter.call(document.querySelectorAll(sel), function (el) { return !pending(el) && inView(el) && !busyEls.has(el); });
  };

  async function doScribble(bot) {
    var circleTargets = visible('.badge, .tags li, .tool, .art-chip, .jcard-year, .sticker, .topics button');
    var lineTargets = visible('.project-kind, .hero-phrase, .section-title, .slide-title, .jcard h3, .tool-info-name');
    var circle = Math.random() < .5 && circleTargets.length;
    var list = circle ? circleTargets : lineTargets;
    if (!list.length) return bot.wander();
    var el = pick(list);
    busyEls.add(el);
    var r = el.getBoundingClientRect();
    await bot.go(circle ? r.right + 4 : r.left, circle ? r.top : r.bottom);
    bot.click();
    addMark(el, bot.color, circle ? 'circle' : 'line', 3200);
    log(bot, (circle ? 'circled ' : 'underlined ') + (el.textContent.trim().slice(0, 28) || label(el)));
    if (circle) await bot.follow(el, 0.5, 1.05); else await bot.follow(el, 1, 1);
    if (Math.random() < .5) bot.say(pick(LINES.any));
    await wait(700);
    busyEls.delete(el);
  }
  async function doPin(bot) {
    var list = visible('.slide-art, .fact, .jcard, .roll, .qr-card, .photo-deck, .tool-info, .tool-board');
    if (!list.length) return bot.wander();
    var el = pick(list);
    await bot.follow(el, rand(.6, .95), rand(.05, .3));
    bot.click();
    var bank = (el.matches('.roll, .photo-deck')) ? LINES.photo : el.classList.contains('slide-art') ? LINES.project : LINES.any;
    var note = pick(bank);
    addPin(el, bot, note, 3800);
    log(bot, 'commented "' + note + '"');
    await wait(900);
  }
  // Press buttons inside the visible phone demos, flip cards, filter the toolbox.
  async function doPlay(bot) {
    var list = visible('.sq-opts button, .br-seg button, .br-swap, .gb-tabs button, .fact, .tool');
    if (!list.length) return doSay(bot);
    var el = pick(list);
    await bot.follow(el, rand(.3, .7), rand(.3, .7));
    bot.click();
    if (el.classList.contains('tool')) el.dispatchEvent(new PointerEvent('pointerenter'));
    else el.click();
    log(bot, 'tested ' + (el.textContent.trim().slice(0, 24) || 'a demo'));
    if (Math.random() < .4) bot.say(pick(['Fun!', 'Let me try', 'Ooh', 'Nice demo', 'Again!']));
    await wait(900);
    if (el.classList.contains('fact')) { await wait(1400); el.click(); }
  }
  async function doSay(bot) {
    await bot.wander();
    if (Math.random() < .4) react(bot.x + 8, bot.y - 4, pick(REACTIONS));
    else bot.say(pick(LINES.any));
    await wait(1200);
  }
  var followers = 0;
  async function doFollow(bot) {
    if (followers >= 2 || mouse.x < -500) return doSay(bot);
    followers++;
    bot.followMouse = { dx: rand(-70, -30) * (Math.random() < .5 ? 1 : -1.6), dy: rand(24, 60) };
    bot.say(pick(LINES.you), 2400);
    log(bot, 'is following you');
    await wait(rand(3200, 4800));
    bot.followMouse = null;
    followers--;
    await bot.wander();
  }

  var lastScroll = 0;
  addEventListener('scroll', function () { lastScroll = performance.now(); }, { passive: true });
  // Agents mostly rest together. Now and then ONE of them leaves the group to do a single job.
  var acting = 0;
  async function idle(bot) {
    bot.home();
    await wait(rand(4000, 9000));
    for (;;) {
      await wait(rand(5000, 12000));
      if (!api.enabled || bot.busy || document.hidden || editMode || acting >= 1) continue;
      if (performance.now() - lastScroll < 2500) continue;
      bot.busy = true; acting++;
      var roll = Math.random();
      try {
        if (roll < 0.26) await doEdit(bot);
        else if (roll < 0.44) await doPlay(bot);
        else if (roll < 0.56) await doTilt(bot);
        else if (roll < 0.64) await doType(bot);
        else if (roll < 0.82) await doScribble(bot);
        else await doPin(bot);
      } catch (e) { /* keep the loop alive */ }
      bot.sel.target = null;
      acting--;
      bot.home();
      bot.busy = false;
    }
  }

  /* ── Your cursor tag ──────────────────────────────────────────────────── */
  var you = document.createElement('div');
  you.className = 'cx-you';
  you.innerHTML = '';
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
    '<span class="cx-dots" role="group" aria-label="Call a cursor over">' +
    // The avatar dots spell the owner's name, one cursor color per letter. Click one to call that cursor.
    // One tiny cursor per agent. Click one to call that agent over.
    BOTS.map(function (b, i) {
      return '<button type="button" data-bot="' + i + '" aria-label="Call agent ' + (i + 1) + '">' + miniArrow(b.color, 16) + '</button>';
    }).join('') +
    '</span>' +
    '<button type="button" class="cx-count" title="Gather every agent in the middle">' + BOTS.length + ' agents building</button>' +
    '<span class="cx-log" aria-live="polite"><i></i>Agents warming up…</span>' +
    '<span class="cx-hint">Click anything to restyle it, drag to move</span>' +
    '<span class="cx-tip"><kbd>/</kbd> chat · <kbd>1</kbd>–<kbd>5</kbd> react · <kbd>P</kbd> draw</span>' +
    '<button type="button" class="cx-draw" aria-pressed="false">Draw</button>' +
    '<button type="button" class="cx-edit" aria-pressed="false">Edit mode</button>' +
    '<button type="button" class="cx-reset-all" hidden>Reset</button>' +
    '<button type="button" class="cx-toggle"></button>';
  document.body.appendChild(bar);
  logEl = bar.querySelector('.cx-log');
  var editBtn = bar.querySelector('.cx-edit'), resetAll = bar.querySelector('.cx-reset-all'), toggleBtn = bar.querySelector('.cx-toggle');

  function setEdit(on) {
    if (on && drawMode) setDraw(false);
    editMode = on;
    window.__cxEditing = on;
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

  /* ── Cursor chat: press / to type a message next to your cursor ────────── */
  var chat = document.createElement('div');
  chat.className = 'cx-chat';
  chat.hidden = true;
  chat.innerHTML = '<label class="cx-sr" for="cx-chat-input">Say something</label><input id="cx-chat-input" type="text" maxlength="60" autocomplete="off" placeholder="Say something…">';
  document.body.appendChild(chat);
  var chatInput = chat.querySelector('input');
  var youSay = document.createElement('span');
  youSay.className = 'cx-say cx-say-you';
  you.appendChild(youSay);
  var REPLIES = ['Hi! Building Doy\'s site', 'Noted', 'Agreed', 'Haha', 'Welcome!', 'Thanks for visiting', 'Logged it', 'Nice to meet you'];
  function openChat() {
    if (editMode) return;
    chat.hidden = false; chatInput.value = ''; chatInput.focus();
  }
  function closeChat() { chat.hidden = true; chatInput.blur(); }
  function placeChat() {
    if (chat.hidden) return;
    chat.style.transform = 'translate(' + clamp(mouse.x + 16, 8, innerWidth - 240) + 'px,' + clamp(mouse.y + 40, 8, innerHeight - 60) + 'px)';
  }
  chatInput.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { closeChat(); return; }
    if (e.key !== 'Enter') return;
    var text = chatInput.value.trim();
    closeChat();
    if (!text) return;
    youSay.textContent = text;
    youSay.classList.add('is-on');
    clearTimeout(youSay.t);
    youSay.t = setTimeout(function () { youSay.classList.remove('is-on'); }, 4200);
    // A nearby cursor comes over and replies.
    var helper = bots.filter(function (b) { return !b.busy; })[0];
    if (helper && api.enabled) {
      helper.busy = true;
      helper.go(clamp(mouse.x + 60, 20, innerWidth - 140), clamp(mouse.y - 30, 80, innerHeight - 100)).then(function () {
        helper.say(pick(REPLIES), 2600);
        return wait(2600);
      }).then(function () { helper.busy = false; helper.home(); });
    }
  });
  chatInput.addEventListener('blur', function () { setTimeout(closeChat, 100); });

  var keyBuf = '';
  document.addEventListener('keydown', function (e) {
    var typing = e.target.closest && e.target.closest('input, textarea, [contenteditable]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); openChat(); return; }
    // Easter egg: type "doy" and every cursor rushes to the name.
    if (/^[1-5]$/.test(e.key) && mouse.x > -500) { react(mouse.x + 10, mouse.y - 6, REACTIONS[+e.key - 1]); return; }
    if (e.key.toLowerCase() === 'p' && !keyBuf.endsWith('hi')) { setDraw(!drawMode); }
    keyBuf = (keyBuf + e.key.toLowerCase()).slice(-4);
    if (keyBuf.endsWith('doy')) gather();
    if (keyBuf === 'hire') hire();
  });
  function gather() {
    var name = document.querySelector('.hero-title .hl');
    if (!name || !api.enabled) return;
    name.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () {
      name.classList.remove('cx-wobble'); void name.offsetWidth; name.classList.add('cx-wobble');
      var r = name.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 40);
      bots.forEach(function (b, i) {
        var ang = i / bots.length * Math.PI * 2;
        b.followMouse = null;
        b.go(r.left + r.width / 2 + Math.cos(ang) * (r.width * .5 + 130), r.top + r.height / 2 + Math.sin(ang) * (r.height * .5 + 90));
        setTimeout(function () { b.say(i % 2 ? 'Doy!' : 'Hi Doy!', 2000); }, 500 + i * 60);
        setTimeout(function () { if (!b.busy) b.home(); }, 3400 + i * 60);
      });
    }, 500);
  }

  /* ── Drag the stickers and floating chips (they spring back) ──────────── */
  document.querySelectorAll('.sticker, .art-chip').forEach(function (el) {
    el.classList.add('cx-toy');
    el.addEventListener('pointerdown', function (e) {
      if (editMode || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var sx = e.clientX, sy = e.clientY;
      el.classList.add('is-held');
      el.setPointerCapture(e.pointerId);
      function move(ev) { el.style.transform = 'translate(' + (ev.clientX - sx) + 'px,' + (ev.clientY - sy) + 'px)'; }
      function up() {
        el.classList.remove('is-held');
        el.style.transform = '';
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        var r = el.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 8);
      }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  });

  /* ── Magnetic buttons ─────────────────────────────────────────────────── */
  var magnets = document.querySelectorAll('.btn, .icon-btn');
  addEventListener('pointermove', function (e) {
    if (editMode) return;
    magnets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy;
      var near = Math.abs(dx) < r.width / 2 + 40 && Math.abs(dy) < r.height / 2 + 30;
      el.style.transform = near ? 'translate(' + (dx * .18).toFixed(1) + 'px,' + (dy * .28).toFixed(1) + 'px)' : '';
    });
  }, { passive: true });

  /* ── Reactions: keys 1–5 float a reaction up from your cursor ───────────── */
  var REACTIONS = [
    { t: '♥', c: '#ff6f91' }, { t: '★', c: '#ffc24b' }, { t: '+1', c: '#8cc8ff' }, { t: 'wow', c: '#a9ecd0' }, { t: '!?', c: '#c9b6ff' }
  ];
  function react(x, y, r) {
    for (var k = 0; k < 3; k++) {
      (function (k) {
        setTimeout(function () {
          var el = document.createElement('span');
          el.className = 'cx-react';
          el.textContent = r.t;
          el.style.cssText = 'left:' + (x + rand(-14, 14)) + 'px;top:' + y + 'px;--rc:' + r.c + ';--dx:' + rand(-30, 30).toFixed(0) + 'px';
          layer.appendChild(el);
          setTimeout(function () { el.remove(); }, 1500);
        }, k * 120);
      })(k);
    }
  }

  /* ── Bar: call one cursor, or gather them all ──────────────────────────── */
  bar.querySelectorAll('.cx-dots button').forEach(function (b) {
    var bot = bots[+b.dataset.bot];
    b.addEventListener('mouseenter', function () { bot.name_(1200); });
    b.addEventListener('click', function () {
      if (!api.enabled) setBots(true);
      var r = b.getBoundingClientRect();
      bot.followMouse = null;
      bot.go(r.left + rand(-40, 40), innerHeight - BOTTOM - 30).then(function () {
        bot.say(pick(['You called?', 'Hi!', 'On it', 'Need help?']), 2000);
        log(bot, 'reporting for duty');
        setTimeout(function () { if (!bot.busy) bot.home(); }, 3200);
        react(bot.x + 8, bot.y - 4, pick(REACTIONS));
      });
    });
  });
  bar.querySelector('.cx-count').addEventListener('click', function () {
    if (!api.enabled) setBots(true);
    var cx = innerWidth / 2, cy = innerHeight / 2;
    burst(cx, cy, 30);
    bots.forEach(function (b, i) {
      var ang = i / bots.length * Math.PI * 2;
      b.followMouse = null;
      b.go(cx + Math.cos(ang) * 220, cy + Math.sin(ang) * 150);
      setTimeout(function () { b.say(pick(['Here!', 'Hey', 'Present', 'Hi Doy', 'Yo']), 1800); }, 400 + i * 50);
      setTimeout(function () { if (!b.busy) b.home(); }, 3200 + i * 50);
    });
  });

  /* ── Easter egg: type "hire" ──────────────────────────────────────────── */
  function hire() {
    var mail = document.getElementById('mail-btn');
    burst(innerWidth / 2, innerHeight / 3, 70);
    bots.forEach(function (b, i) {
      setTimeout(function () { b.say(pick(['Hired!', 'Welcome aboard', 'Send the offer', 'Great pick', 'Start Monday?']), 2400); }, i * 90);
    });
    if (mail) { mail.classList.remove('cx-pulse'); void mail.offsetWidth; mail.classList.add('cx-pulse'); }
  }

  /* ── Draw: press P or the Draw button, sketch on the page; strokes fade ── */
  var ink = document.createElement('canvas');
  ink.className = 'cx-ink';
  document.body.appendChild(ink);
  var ictx = ink.getContext('2d');
  var drawMode = false, strokes = [], cur = null;
  var INK = ['#e2553a', '#2f6fe4', '#1f9d6b', '#ffc24b', '#4a1826'];
  var inkColor = 0;
  function sizeInk() { ink.width = innerWidth * dpr; ink.height = innerHeight * dpr; ink.style.width = innerWidth + 'px'; ink.style.height = innerHeight + 'px'; }
  sizeInk(); addEventListener('resize', sizeInk);
  var drawBtn = bar.querySelector('.cx-draw');
  function setDraw(on) {
    drawMode = on;
    ink.classList.toggle('is-on', on);
    drawBtn.setAttribute('aria-pressed', String(on));
    drawBtn.textContent = on ? 'Stop drawing' : 'Draw';
    if (on) { setEdit(false); inkColor = (inkColor + 1) % INK.length; }
  }
  drawBtn.addEventListener('click', function () { setDraw(!drawMode); });
  ink.addEventListener('pointerdown', function (e) {
    cur = { c: INK[inkColor], pts: [[e.clientX, e.clientY + scrollY]], t: Infinity };
    strokes.push(cur);
    ink.setPointerCapture(e.pointerId);
  });
  ink.addEventListener('pointermove', function (e) { if (cur) cur.pts.push([e.clientX, e.clientY + scrollY]); });
  function endStroke() {
    if (!cur) return;
    cur.t = performance.now();
    if (cur.pts.length > 6 && Math.random() < .6) {
      var p = cur.pts[cur.pts.length - 1], b = pick(bots);
      b.go(p[0] + 30, p[1] - scrollY + 10).then(function () {
        b.say(pick(['Nice drawing', 'Art!', 'Frame it', 'Haha', 'Masterpiece']), 1800);
        setTimeout(function () { if (!b.busy) b.home(); }, 2400);
      });
    }
    cur = null;
  }
  ink.addEventListener('pointerup', endStroke);
  ink.addEventListener('pointercancel', endStroke);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawMode) setDraw(false); });
  function drawInk() {
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.clearRect(0, 0, innerWidth, innerHeight);
    var nowT = performance.now();
    strokes = strokes.filter(function (s) { return nowT - s.t < 4500; });
    strokes.forEach(function (s) {
      var age = nowT - s.t, a = age < 3000 ? 1 : 1 - (age - 3000) / 1500;
      ictx.globalAlpha = Math.max(0, a);
      ictx.strokeStyle = s.c; ictx.lineWidth = 4; ictx.lineCap = 'round'; ictx.lineJoin = 'round';
      ictx.beginPath();
      s.pts.forEach(function (p, i) { var y = p[1] - scrollY; if (i) ictx.lineTo(p[0], y); else ictx.moveTo(p[0], y); });
      ictx.stroke();
    });
    ictx.globalAlpha = 1;
  }

  /* ── Frame loop ───────────────────────────────────────────────────────── */
  var last = performance.now();
  (function frame(now) {
    stepSwarm(now - last); last = now;
    if (mouse.x > -500) { ringC.x = mouse.x; ringC.y = mouse.y; }
    bots.forEach(function (b) { b.step(); });
    you.style.transform = 'translate(' + mouse.x + 'px,' + mouse.y + 'px)';
    drawSel(userSel);
    placeInspector();
    drawMarks();
    drawPins();
    drawInk();
    placeChat();
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
