/* Swarm Rebuild
   A team of multiplayer design-tool cursors rebuilds the page on a blank canvas, then hands over the live site.

   Zero dependencies. Load swarm-rebuild.css + this file, then:
     SwarmRebuild.init({ autoStart: true, speed: 1, sound: true });

   React / Next.js: import both files once (e.g. in a client component) and call init inside useEffect:
     useEffect(() => { window.SwarmRebuild.init({ autoStart: true }); return () => window.SwarmRebuild.destroy(); }, []);

   How it works
   1. Scanner     walks the DOM, keeps what is actually painted (skips script/style/hidden/0×0/clipped nodes), records
                  rects, typography, colors, gradients, shadows, borders and radii, and groups repeated siblings.
   2. Overlay     every painted element gets a "ghost" copy on an isolated overlay (#swarm-overlay) over a dot grid,
                  while the real DOM is hidden with visibility (layout is untouched, so scrolling still works).
   3. Swarm       6–10 named cursors take tasks from a queue: draw containers (dashed selection, handles, W × H badge,
                  magenta guides, pen-drawn borders), clone repeated components (⌥ badge), type text with a caret,
                  and wipe in media. Children wait for their parent container. Idle cursors flock around your mouse.
   4. Scroll      only things near the viewport are queued; scrolling dispatches the swarm to new sections.
                  Tour mode auto-scrolls in step with the build and pauses while you scroll or interact.
   5. Sound       clacks, clicks and pentatonic marimba notes are synthesized with the Web Audio API, unlocked on the
                  first user gesture.
   6. HUD         Replay (Alt+Shift+S), speed 1×/2×/3× (1/2/3), Tour, Sound (M), Go Live (L or Esc).
                  By default it goes live once what is on screen is built (liveAfter: "view"); use "page" for all.
                  Go Live fades the overlay out, shows the real page and stops every loop, timer, listener and audio node.

   Events: window "swarm:start" and "swarm:live". The html element gets .swarm-on while the overlay is up. */
(function (global) {
  'use strict';
  if (global.SwarmRebuild) return;

  var DEFAULTS = {
    autoStart: true,
    speed: 1,          // 1, 2 or 3
    sound: true,
    tour: false,
    cursors: 8,        // 6–10
    root: null,        // element to rebuild; defaults to document.body
    exclude: [],       // selectors left alone: never hidden, never rebuilt (e.g. a cookie banner)
    prepare: null,     // function run right before scanning (e.g. force scroll-in animations to their end state)
    onStart: null,
    onLive: null,
    margin: 420,       // also build this far above/below the viewport
    autoLive: true,    // go live by itself once the build is done
    liveAfter: 'view', // 'view' = once what's on screen is built (the rest of the page is the live site); 'page' = whole page
    nameTags: true,    // show a name pill next to each cursor
    hud: true,
    names: ['Maya', 'Alex', 'Kai', 'Zoe', 'Leo', 'Sam', 'Ivy', 'Noor', 'Ren', 'Tess'],
    colors: ['#ff4f8b', '#3d7bff', '#f5a524', '#17c08c', '#9b5cff', '#ff6a3d', '#12b5c9', '#e14fd1', '#6cc33c', '#f04848']
  };

  var opts = assign({}, DEFAULTS);
  var S = null;               // the running session; null while the live site is showing
  var hud = null, hudEls = null;
  var bound = false;
  var ABORT = { abort: true };
  var html = document.documentElement;
  var reduceMotion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function linear(t) { return t; }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function mk(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function sx() { return global.pageXOffset || 0; }
  function sy() { return global.pageYOffset || 0; }
  function docSize() {
    var d = html, b = document.body;
    return { w: Math.max(d.scrollWidth, b.scrollWidth, d.clientWidth), h: Math.max(d.scrollHeight, b.scrollHeight, d.clientHeight) };
  }
  function intersect(a, b) {
    var x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    var r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
    return (r - x > 0.5 && btm - y > 0.5) ? { x: x, y: y, w: r - x, h: btm - y } : null;
  }
  function alphaOf(color) {
    if (!color || color === 'transparent') return 0;
    var m = /rgba?\(([^)]+)\)/.exec(color); if (!m) return 1;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean);
    return p.length > 3 ? parseFloat(p[3]) : 1;
  }
  function isTypingTarget(t) { return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }

  // Session-scoped timers and tweens: everything is cancelled at Go Live.
  function sleep(ms) {
    var s = S;
    return new Promise(function (res, rej) {
      if (!s || s.dead) return rej(ABORT);
      var id = setTimeout(function () { s.timers.delete(id); if (s.dead) rej(ABORT); else res(); }, ms / s.speed);
      s.timers.add(id);
    });
  }
  function pause() { return sleep(rand(30, 90)); }  // human micro-pause between actions
  function tween(ms, fn, ease) {
    var s = S;
    return new Promise(function (res, rej) {
      if (!s || s.dead) return rej(ABORT);
      s.tweens.push({ t0: performance.now(), dur: Math.max(16, ms / s.speed), fn: fn, ease: ease || easeInOut, res: res });
    });
  }

  /* ── Sound: procedural Web Audio ─────────────────────────────────────── */
  var Sound = (function () {
    var ctx = null, master = null, noise = null, enabled = true, voices = 0;
    var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = enabled ? 0.22 : 0; master.connect(ctx.destination);
      var len = Math.floor(ctx.sampleRate * 0.08); noise = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noise.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function ok() { return enabled && ctx && ctx.state === 'running' && voices < 30; }
    function env(param, t, attack, peak, decay) {
      param.setValueAtTime(0.0001, t);
      param.exponentialRampToValueAtTime(peak, t + attack);
      param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function play(node, t, len) { voices++; node.onended = function () { voices--; }; node.start(t); node.stop(t + len); }
    return {
      unlock: function () { if (!enabled) return; if (ensure() && ctx.state === 'suspended') ctx.resume(); },
      setEnabled: function (on) {
        enabled = on;
        if (master) master.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.02);
        if (on) this.unlock();
      },
      key: function () {   // mechanical clack: filtered noise burst + pitched transient
        if (!ok()) return;
        var t = ctx.currentTime;
        var n = ctx.createBufferSource(); n.buffer = noise;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(1800, 3800); bp.Q.value = 1.4;
        var g = ctx.createGain(); env(g.gain, t, 0.002, 0.55, 0.03);
        n.connect(bp); bp.connect(g); g.connect(master); play(n, t, 0.06);
        var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = rand(150, 260);
        var g2 = ctx.createGain(); env(g2.gain, t, 0.001, 0.16, 0.025);
        o.connect(g2); g2.connect(master); play(o, t, 0.05);
      },
      click: function (down) {   // mouse down / up
        if (!ok()) return;
        var t = ctx.currentTime;
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = down ? 1150 : 1650;
        var g = ctx.createGain(); env(g.gain, t, 0.001, 0.11, 0.022);
        o.connect(g); g.connect(master); play(o, t, 0.04);
        var n = ctx.createBufferSource(); n.buffer = noise;
        var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
        var g2 = ctx.createGain(); env(g2.gain, t, 0.001, 0.08, 0.012);
        n.connect(hp); hp.connect(g2); g2.connect(master); play(n, t, 0.03);
      },
      note: function (high) {   // soft pentatonic marimba / glass piano
        if (!ok()) return;
        var t = ctx.currentTime;
        var semi = PENTA[Math.floor(Math.random() * (high ? PENTA.length : 6)) + (high ? 0 : 0)];
        var f = 523.25 * Math.pow(2, semi / 12);
        [[1, 0.32, 0.6], [3.93, 0.07, 0.16], [2, 0.05, 0.3]].forEach(function (p) {
          var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * p[0];
          var g = ctx.createGain(); env(g.gain, t, 0.003, p[1], p[2]);
          o.connect(g); g.connect(master); play(o, t, p[2] + 0.05);
        });
      },
      close: function () { if (ctx) { try { ctx.close(); } catch (e) {} } ctx = null; master = null; noise = null; voices = 0; }
    };
  })();

  /* ── 1. Scanner ──────────────────────────────────────────────────────── */
  var SKIP = 'script,style,noscript,template,link,meta,title,head,br,wbr,source,track,param,map,area,#swarm-overlay,#swarm-hud';
  var MEDIA = { IMG: 1, SVG: 1, VIDEO: 1, CANVAS: 1, IFRAME: 1, OBJECT: 1, EMBED: 1 };
  var FORM = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };

  function clipsOverflow(cs) { return cs.overflowX !== 'visible' || cs.overflowY !== 'visible'; }

  // Text block = has text and only inline children (so innerText is typed as one paragraph).
  function textOf(e) {
    if (!/\S/.test(e.textContent || '')) return '';
    for (var c = e.firstElementChild; c; c = c.nextElementSibling) {
      if (MEDIA[c.tagName.toUpperCase()]) continue;
      var d = getComputedStyle(c).display;
      if (d !== 'inline' && d !== 'contents' && d !== 'none') return '';
    }
    return (e.innerText || e.textContent || '').replace(/\s+\n/g, '\n').trim();
  }

  // Where the first character really sits inside e (relative to e's box). Used when the text shares the box with
  // icons, so the copy starts after the icon instead of overlapping it.
  function textStart(e, r) {
    var w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return /\S/.test(n.data) ? 1 : 3; } });
    var n = w.nextNode(); if (!n) return null;
    var i = n.data.search(/\S/), range = document.createRange();
    range.setStart(n, i); range.setEnd(n, i + 1);
    var b = range.getClientRects()[0] || range.getBoundingClientRect();
    return b && b.height ? { x: b.left - r.left, y: b.top - r.top, h: b.height } : null;
  }

  // Repeated siblings with the same tag + classes become a clone group: build the first, ⌥-drag copies for the rest.
  function findGroups(kids, skipSel) {
    if (kids.length < 2) return null;
    var bySig = {}, map = null;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.matches(skipSel) || (!k.children.length && !/\S/.test(k.textContent || ''))) continue;
      var sig = k.tagName + '|' + Array.prototype.filter.call(k.classList, function (c) { return !/^(is-|active$|current$|selected$|reveal$)/.test(c); }).sort().join('.');
      (bySig[sig] = bySig[sig] || []).push(k);
    }
    Object.keys(bySig).forEach(function (sig) {
      var list = bySig[sig]; if (list.length < 2) return;
      map = map || new Map();
      for (var j = 1; j < list.length; j++) map.set(list[j], list[0]);
    });
    return map;
  }

  function scanPage(root) {
    var items = [], groups = [], ox = sx(), oy = sy(), vw = global.innerWidth, vh = global.innerHeight;
    var skipSel = SKIP + (opts.exclude.length ? ',' + opts.exclude.join(',') : '');
    var leaderRects = new Map();

    function walk(node, clip, fixed, cloneGroup, inText, pbox) {
      var kids = node.children; if (!kids || !kids.length) return;
      var groupMap = cloneGroup ? null : findGroups(kids, skipSel);
      for (var i = 0; i < kids.length; i++) {
        var e = kids[i];
        if (e.matches(skipSel)) continue;
        if (e.tagName === 'DIALOG' && !e.open) continue;
        var cs = getComputedStyle(e);
        if (cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue;
        var tag = e.tagName.toUpperCase();
        var isFixed = fixed || cs.position === 'fixed';
        var cl = (isFixed && !fixed) ? { x: 0, y: 0, w: vw, h: vh } : clip;
        var r = e.getBoundingClientRect();
        var rect = isFixed ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: r.left + ox, y: r.top + oy, w: r.width, h: r.height };
        var vis = intersect(rect, cl);

        // Clone group member (not the first instance)?
        var group = cloneGroup;
        if (!group && groupMap && groupMap.has(e) && vis && vis.w * vis.h >= 1200) {
          var leader = groupMap.get(e);
          if (!leaderRects.has(leader)) {
            var lr = leader.getBoundingClientRect();
            var lrect = isFixed ? { x: lr.left, y: lr.top, w: lr.width, h: lr.height } : { x: lr.left + ox, y: lr.top + oy, w: lr.width, h: lr.height };
            leaderRects.set(leader, intersect(lrect, cl));
          }
          if (leaderRects.get(leader)) {
            group = { member: e, leader: leader, leaderRect: leaderRects.get(leader), rect: vis, fixed: isFixed, items: [] };
            groups.push(group);
          }
        }

        var item = null;
        if (vis && cs.visibility !== 'hidden') {
          var media = MEDIA[tag] ? tag : null, form = FORM[tag];
          var hasBg = alphaOf(cs.backgroundColor) > 0.02 || cs.backgroundImage !== 'none';
          var sides = ['Top', 'Right', 'Bottom', 'Left'], bw = 0, borderAll = true;
          sides.forEach(function (sd) {
            var w = cs['border' + sd + 'Style'] === 'none' ? 0 : parseFloat(cs['border' + sd + 'Width']) || 0;
            if (w > 0 && alphaOf(cs['border' + sd + 'Color']) > 0.02) bw = Math.max(bw, w); else borderAll = false;
          });
          var hasShadow = cs.boxShadow && cs.boxShadow !== 'none';
          var box = !media && !inText && (hasBg || bw > 0 || hasShadow || !!form);
          var text = media ? '' : form ? (e.value || e.getAttribute('placeholder') || '') : inText ? '' : textOf(e);
          if (box || text || media) {
            item = {
              el: e, cs: cs, rect: rect, vis: vis, fixed: isFixed, group: group, pbox: pbox,
              box: box, text: text, media: media,
              bgMedia: box && /url\(/.test(cs.backgroundImage),
              border: bw, borderAll: borderAll && bw > 0,
              divider: box && (vis.h <= 4 || vis.w <= 4) && Math.max(vis.w, vis.h) >= 40,
              area: vis.w * vis.h
            };
            if (text && !form && e.querySelector('svg,img,i,picture')) item.textAt = textStart(e, r);
            items.push(item);
            if (group) group.items.push(item);
          }
          if (media || form) continue;   // never descend into svg/img/inputs
        }
        var clipsKids = clipsOverflow(cs);
        if (clipsKids && !vis) continue;
        walk(e, clipsKids ? vis : cl, isFixed, group, inText || !!(item && item.text), (item && item.box) ? item : pbox);
      }
    }

    walk(root, { x: -1e6, y: -1e6, w: 2e6, h: 2e6 }, false, null, false, null);
    return { items: items, groups: groups };
  }

  /* ── 2. Overlay & ghosts ─────────────────────────────────────────────── */
  var TYPE_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'textTransform', 'textAlign', 'textIndent', 'color', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'textShadow'];

  function makeGhost(it, layer) {
    var cs = it.cs, r = it.rect, v = it.vis, g = mk('div', 'sw-ghost', layer), st = g.style;
    st.left = r.x + 'px'; st.top = r.y + 'px'; st.width = r.w + 'px'; st.height = r.h + 'px';
    st.borderTopLeftRadius = cs.borderTopLeftRadius; st.borderTopRightRadius = cs.borderTopRightRadius;
    st.borderBottomRightRadius = cs.borderBottomRightRadius; st.borderBottomLeftRadius = cs.borderBottomLeftRadius;
    it.inset = [v.y - r.y, r.x + r.w - v.x - v.w, r.y + r.h - v.y - v.h, v.x - r.x];
    it.clipBase = it.inset.some(function (n) { return n > 0.5; }) ? 'inset(' + it.inset.map(function (n) { return Math.max(0, n) + 'px'; }).join(' ') + ')' : '';
    st.clipPath = it.clipBase;
    st.visibility = 'hidden';

    if (it.box || it.text) {
      ['Top', 'Right', 'Bottom', 'Left'].forEach(function (sd) {
        st['border' + sd] = cs['border' + sd + 'Width'] + ' ' + cs['border' + sd + 'Style'] + ' ' + (it.box ? cs['border' + sd + 'Color'] : 'transparent');
      });
    }
    if (it.box) {
      st.backgroundColor = cs.backgroundColor; st.backgroundImage = cs.backgroundImage;
      st.backgroundSize = cs.backgroundSize; st.backgroundPosition = cs.backgroundPosition; st.backgroundRepeat = cs.backgroundRepeat;
      st.backgroundClip = cs.backgroundClip; st.boxShadow = cs.boxShadow;
      if (it.borderAll && !it.divider) it.borderColors = [st.borderTopColor, st.borderRightColor, st.borderBottomColor, st.borderLeftColor];
    }
    if (it.text) {
      TYPE_PROPS.forEach(function (p) { st[p] = cs[p]; });
      st.whiteSpace = cs.whiteSpace === 'normal' ? 'pre-line' : cs.whiteSpace;
      if (/flex|grid/.test(cs.display)) {
        st.display = 'flex'; st.flexDirection = 'column';
        st.justifyContent = cs.alignItems === 'center' || /column/.test(cs.flexDirection) && cs.justifyContent === 'center' ? 'center' : 'flex-start';
        st.alignItems = cs.justifyContent === 'center' || cs.textAlign === 'center' ? 'center' : 'flex-start';
      }
      if (it.textAt) {   // text beside an icon: start exactly where the real text starts
        var lh = parseFloat(cs.lineHeight) || it.textAt.h;
        st.display = 'block'; st.textAlign = 'left'; st.whiteSpace = 'nowrap';
        st.paddingLeft = Math.max(0, it.textAt.x - (parseFloat(cs.borderLeftWidth) || 0)) + 'px';
        st.paddingTop = Math.max(0, it.textAt.y - (parseFloat(cs.borderTopWidth) || 0) - (lh - it.textAt.h) / 2) + 'px';
        st.paddingRight = '0px'; st.paddingBottom = '0px';
      }
      st.overflow = 'visible';
      it.span = mk('span', 'sw-txt', g);
    }
    if (it.media) fillMedia(it, g);
    it.ghost = g;
  }

  function fillMedia(it, g) {
    var e = it.el, cs = it.cs, tag = it.media;
    g.style.overflow = 'hidden';
    if (tag === 'IMG') {
      var im = mk('img', 'sw-media', g); im.alt = ''; im.decoding = 'async';
      im.src = e.currentSrc || e.src; im.style.objectFit = cs.objectFit; im.style.objectPosition = cs.objectPosition;
    } else if (tag === 'SVG') {
      var c = e.cloneNode(true); c.removeAttribute('id'); c.setAttribute('class', 'sw-media');
      c.style.fill = cs.fill; c.style.stroke = cs.stroke; g.style.color = cs.color; g.appendChild(c);
    } else if (tag === 'VIDEO') {
      var v = e.cloneNode(true); v.className = 'sw-media'; v.muted = true; v.removeAttribute('id');
      v.style.objectFit = cs.objectFit; g.appendChild(v);
      if (!e.paused) { v.autoplay = true; v.play && v.play().catch(function () {}); }
    } else if (tag === 'CANVAS') {
      try { var ci = mk('img', 'sw-media', g); ci.src = e.toDataURL(); } catch (err) { g.classList.add('sw-embed'); }
    } else {
      g.classList.add('sw-embed'); mk('span', 'sw-embed-label', g).textContent = 'Live embed';
    }
  }

  function buildOverlay(scan) {
    var size = docSize();
    var ov = mk('div', 'swarm-keep'); ov.id = 'swarm-overlay';
    ov.style.width = size.w + 'px'; ov.style.height = size.h + 'px';
    var docLayer = mk('div', 'sw-layer', ov), fixedLayer = mk('div', 'sw-fixed', ov);
    var fx = mk('div', 'sw-layer sw-fx', ov), curLayer = mk('div', 'sw-layer sw-cursors', ov);
    scan.items.forEach(function (it) { makeGhost(it, it.fixed ? fixedLayer : docLayer); });
    html.appendChild(ov);
    return { root: ov, doc: docLayer, fixed: fixedLayer, fx: fx, cursors: curLayer, w: size.w, h: size.h };
  }

  // Item rects in document coordinates (fixed items are converted at the moment they are used).
  function docVis(it) { var v = it.vis; return it.fixed ? { x: v.x + sx(), y: v.y + sy(), w: v.w, h: v.h } : v; }
  function docOf(rect, fixed) { return fixed ? { x: rect.x + sx(), y: rect.y + sy(), w: rect.w, h: rect.h } : rect; }

  function reveal(it, fade) {
    var g = it.ghost; if (!g) return;
    g.style.visibility = 'visible';
    if (it.span && it.span.textContent !== it.text) it.span.textContent = it.text;
    if (it.borderColors) restoreBorders(it);
    if (fade && g.animate) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 / (S ? S.speed : 1), easing: 'ease-out' });
  }
  function restoreBorders(it) {
    var st = it.ghost.style, c = it.borderColors;
    st.borderTopColor = c[0]; st.borderRightColor = c[1]; st.borderBottomColor = c[2]; st.borderLeftColor = c[3];
  }

  /* ── Cursors ─────────────────────────────────────────────────────────── */
  var ARROW = '<svg class="sw-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 2.5v17.2l4.6-4.4 3.1 7 3-1.3-3-6.9h6.4z"/></svg>';

  function Cursor(i, layer) {
    this.i = i;
    this.color = opts.colors[i % opts.colors.length];
    this.name = opts.names[i % opts.names.length];
    var vx = sx() + global.innerWidth / 2, vy = sy() + global.innerHeight + 40;
    this.x = vx + rand(-260, 260); this.y = vy + rand(0, 120);
    this.vx = 0; this.vy = 0; this.tx = this.x; this.ty = this.y - rand(120, 300);
    this.idle = true; this.arrive = null; this.orbit = rand(0, Math.PI * 2);
    var el = mk('div', 'sw-cursor', layer);
    el.style.setProperty('--c', this.color);
    el.innerHTML = ARROW + (opts.nameTags ? '<span class="sw-tag">' + this.name + '</span>' : '') + '<span class="sw-clone">⌥ Clone</span>';
    this.el = el;
  }
  Cursor.prototype.step = function (dt, speed) {
    // Under-damped spring: fast, with a slight human overshoot.
    var k = 260 * speed, c = 2 * Math.sqrt(k) * 0.62;
    this.vx += (k * (this.tx - this.x) - c * this.vx) * dt;
    this.vy += (k * (this.ty - this.y) - c * this.vy) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.el.style.transform = 'translate3d(' + this.x.toFixed(1) + 'px,' + this.y.toFixed(1) + 'px,0)';
    if (this.arrive && Math.hypot(this.tx - this.x, this.ty - this.y) < 2.5 && Math.hypot(this.vx, this.vy) < 40) {
      var f = this.arrive; this.arrive = null; f();
    }
  };
  Cursor.prototype.moveTo = function (x, y) {
    var self = this, s = S;
    self.tx = x; self.ty = y;
    return new Promise(function (res, rej) {
      if (!s || s.dead) return rej(ABORT);
      var to = setTimeout(done, 1700 / s.speed); s.timers.add(to);
      function done() { clearTimeout(to); s.timers.delete(to); if (self.arrive === done) self.arrive = null; if (s.dead) rej(ABORT); else res(); }
      self.arrive = done;
    });
  };
  Cursor.prototype.press = function (on) { this.el.classList.toggle('is-down', on); Sound.click(on); };
  Cursor.prototype.clone = function (on) { this.el.classList.toggle('is-cloning', on); };

  /* ── Design-tool visuals ─────────────────────────────────────────────── */
  function selection(color, x, y) {
    var box = mk('div', 'sw-sel', S.ov.fx);
    box.style.setProperty('--c', color);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    ['tl', 'tr', 'bl', 'br'].forEach(function (p) { mk('i', 'sw-h sw-' + p, box); });
    var dim = mk('span', 'sw-dim', box);
    return {
      set: function (w, h) { box.style.width = w + 'px'; box.style.height = h + 'px'; dim.textContent = Math.round(w) + ' × ' + Math.round(h); },
      done: function () { box.classList.add('is-done'); },
      remove: function () { box.remove(); }
    };
  }
  function guides(v) {
    var s = S; if (!s || s.guides > 8 || v.w < 30 || v.h < 16) return;
    var x0 = sx(), y0 = sy(), vw = global.innerWidth, vh = global.innerHeight;
    var lines = [
      { l: x0, t: v.y, w: vw, h: 1 }, { l: x0, t: v.y + v.h, w: vw, h: 1 },
      { l: v.x, t: y0, w: 1, h: vh }, { l: v.x + v.w, t: y0, w: 1, h: vh }
    ];
    lines.forEach(function (p) {
      var g = mk('i', 'sw-guide', s.ov.fx);
      g.style.left = p.l + 'px'; g.style.top = p.t + 'px'; g.style.width = p.w + 'px'; g.style.height = p.h + 'px';
      s.guides++;
      setTimeout(function () { g.remove(); if (S === s) s.guides--; }, 650);
    });
  }
  // Pen tool: stroke the border on, then hand over to the real border.
  function penBorder(it, color) {
    var g = it.ghost, r = it.rect, bw = it.border, ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'sw-pen');
    svg.style.left = -bw + 'px'; svg.style.top = -bw + 'px'; svg.setAttribute('width', r.w); svg.setAttribute('height', r.h);
    var rc = document.createElementNS(ns, 'rect');
    var rad = Math.min(parseFloat(it.cs.borderTopLeftRadius) || 0, r.w / 2, r.h / 2);
    rc.setAttribute('x', bw / 2); rc.setAttribute('y', bw / 2); rc.setAttribute('width', Math.max(0, r.w - bw)); rc.setAttribute('height', Math.max(0, r.h - bw));
    rc.setAttribute('rx', Math.max(0, rad - bw / 2)); rc.setAttribute('fill', 'none');
    rc.setAttribute('stroke', it.borderColors[0]); rc.setAttribute('stroke-width', bw);
    var per = 2 * (r.w + r.h); rc.style.strokeDasharray = per; rc.style.strokeDashoffset = per;
    svg.appendChild(rc); g.appendChild(svg);
    return tween(clamp(per * 0.35, 260, 700), function (e) { rc.style.strokeDashoffset = per * (1 - e); }, easeOut)
      .then(function () { restoreBorders(it); svg.remove(); });
  }

  /* ── Build tasks ─────────────────────────────────────────────────────── */
  var RUN = {
    box: async function (t, c) {
      var it = t.item, v = docVis(it);
      if (it.divider) return RUN.divider(t, c);
      await c.moveTo(v.x, v.y); await pause();
      c.press(true);
      var sel = selection(c.color, v.x, v.y);
      await tween(clamp(160 + Math.sqrt(v.w * v.h) * 0.45, 260, 600), function (e) {
        sel.set(v.w * e, v.h * e); c.tx = v.x + v.w * e; c.ty = v.y + v.h * e;
      });
      c.press(false);
      sel.done();
      guides(v);
      reveal(it, true);
      if (it.borderColors) { var st = it.ghost.style; st.borderTopColor = st.borderRightColor = st.borderBottomColor = st.borderLeftColor = 'transparent'; penBorder(it); }
      if (it.bgMedia) wipe(it, null);
      Sound.note();
      await sleep(90); sel.remove();
    },
    divider: async function (t, c) {
      var it = t.item, v = docVis(it), horiz = v.w >= v.h, g = it.ghost;
      await c.moveTo(v.x, v.y + v.h / 2); await pause();
      c.press(true);
      g.style.transformOrigin = horiz ? 'left center' : 'center top';
      g.style.transform = horiz ? 'scaleX(0)' : 'scaleY(0)';
      reveal(it, false);
      await tween(clamp((horiz ? v.w : v.h) * 0.6, 220, 560), function (e) {
        g.style.transform = horiz ? 'scaleX(' + e + ')' : 'scaleY(' + e + ')';
        c.tx = horiz ? v.x + v.w * e : v.x; c.ty = horiz ? v.y + v.h / 2 : v.y + v.h * e;
      });
      g.style.transform = ''; c.press(false); Sound.note();
    },
    text: async function (t, c) {
      var it = t.item, g = it.ghost, full = it.text, n = full.length;
      var span = it.span; span.textContent = '';
      var tn = document.createTextNode(''); span.appendChild(tn);
      var caret = mk('span', 'sw-caret', span); caret.style.background = c.color;
      g.style.visibility = 'visible';
      var p0 = caretPoint(caret); await c.moveTo(p0.x + 3, p0.y + 6); await pause();
      var last = 0, lastSound = 0;
      await tween(clamp(n * 14, 200, 1100), function (e, p) {
        var k = Math.round(n * p);
        if (k !== last) {
          tn.data = full.slice(0, k); last = k;
          var tnow = performance.now(), ch = full.charAt(k - 1);
          if (tnow - lastSound > 34 && /\S/.test(ch)) { Sound.key(); lastSound = tnow; }
        }
        var cp = caretPoint(caret); c.tx = cp.x + 3; c.ty = cp.y + 6;
      }, linear);
      await sleep(120);
      caret.remove(); span.textContent = full;
    },
    media: async function (t, c) {
      var it = t.item, v = docVis(it);
      await c.moveTo(v.x + v.w, v.y); await pause();
      c.press(true);
      await wipe(it, c);
      c.press(false); Sound.note();
    },
    clone: async function (t, c) {
      var gp = t.group, L = docOf(gp.leaderRect, gp.fixed), M = docOf(gp.rect, gp.fixed);
      await c.moveTo(L.x + L.w / 2, L.y + L.h / 2); await pause();
      c.clone(true); c.press(true);
      var px = mk('div', 'sw-proxy', S.ov.fx); px.style.setProperty('--c', c.color);
      var dist = Math.hypot(M.x - L.x, M.y - L.y);
      await tween(clamp(220 + dist * 0.3, 320, 700), function (e) {
        var x = L.x + (M.x - L.x) * e, y = L.y + (M.y - L.y) * e, w = L.w + (M.w - L.w) * e, h = L.h + (M.h - L.h) * e;
        px.style.left = x + 'px'; px.style.top = y + 'px'; px.style.width = w + 'px'; px.style.height = h + 'px';
        c.tx = x + w / 2; c.ty = y + h / 2;
      });
      c.press(false); c.clone(false);
      gp.items.forEach(function (it) { reveal(it, true); it.done = true; });
      guides(M); Sound.note(true);
      await sleep(120); px.remove();
    }
  };

  function caretPoint(caret) { var r = caret.getBoundingClientRect(); return { x: r.left + sx(), y: r.top + sy() }; }

  // Top-to-bottom clip-path wipe; the cursor (if any) rides down the right edge.
  function wipe(it, c) {
    var g = it.ghost, ins = it.inset, H = it.rect.h, v = docVis(it);
    g.style.visibility = 'visible';
    return tween(clamp(220 + v.h * 0.4, 300, 650), function (e) {
      var bottom = Math.max(0, ins[2]) + Math.max(0, H - Math.max(0, ins[0]) - Math.max(0, ins[2])) * (1 - e);
      g.style.clipPath = 'inset(' + Math.max(0, ins[0]) + 'px ' + Math.max(0, ins[1]) + 'px ' + bottom + 'px ' + Math.max(0, ins[3]) + 'px)';
      if (c) { c.tx = v.x + v.w; c.ty = v.y + v.h * e; }
    }).then(function () { g.style.clipPath = it.clipBase; });
  }

  function makeTasks(scan) {
    var tasks = [], pops = [], pending = new Map(), leaderTasks = new Map();
    var leaders = [];
    scan.groups.forEach(function (g) { if (leaders.indexOf(g.leader) < 0) { leaders.push(g.leader); pending.set(g.leader, 0); leaderTasks.set(g.leader, []); } });
    function leadersOf(el) { return leaders.filter(function (L) { return L !== el && L.contains(el); }); }
    function track(t) {
      t.leaders.forEach(function (L) { pending.set(L, pending.get(L) + 1); leaderTasks.get(L).push(t); });
      tasks.push(t);
      return t;
    }
    function add(type, it, phase) {
      var v = it.vis;
      return track({ type: type, item: it, phase: phase, fixed: it.fixed, top: v.y, bottom: v.y + v.h, left: v.x, area: it.area, leaders: leadersOf(it.el) });
    }
    scan.items.forEach(function (it) {
      if (it.group) return;                                  // built by its clone task
      if (it.area < 500 && !it.divider) { it.pop = true; pops.push(it); return; }
      if (it.box) { it.boxPending = true; it.boxTask = add('box', it, 0); }
      if (it.text) add('text', it, 2);
      if (it.media) add('media', it, 3);
    });
    scan.items.forEach(function (it) { if (it.pbox && (it.pbox.pop || !it.pbox.boxPending)) it.pbox = null; });
    scan.groups.forEach(function (g) {
      track({ type: 'clone', group: g, phase: 1, fixed: g.fixed, top: g.rect.y, bottom: g.rect.y + g.rect.h, left: g.rect.x, area: g.rect.w * g.rect.h, leaders: leadersOf(g.member) });
    });
    return { tasks: tasks, pops: pops, pending: pending, leaderTasks: leaderTasks };
  }

  var BAND = 0;
  function sortKey(a, b) {
    var ba = a.fixed ? -1 : Math.floor(a.top / BAND), bb = b.fixed ? -1 : Math.floor(b.top / BAND);
    if (ba !== bb) return ba - bb;
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (a.phase === 0 && Math.abs(a.area - b.area) > 1) return b.area - a.area;
    return (a.top - b.top) || (a.left - b.left);
  }

  // Ready = parent container drawn, and (for clones) the first instance fully built.
  function ready(t) {
    var s = S;
    if (t.type === 'clone') return s.pending.get(t.group.leader) === 0;
    var it = t.item;
    if (t.type !== 'box' && it.boxPending) return false;
    return !it.pbox || !it.pbox.boxPending;
  }

  function takeTask(c) {
    var q = S.queue, best = -1, score = Infinity, seen = 0;
    for (var i = 0; i < q.length && seen < 6; i++) {
      var t = q[i]; if (!ready(t)) continue; seen++;
      var p = t.type === 'clone' ? docOf(t.group.leaderRect, t.fixed) : docVis(t.item);
      var d = Math.hypot(p.x - c.x, p.y - c.y) + i * 140;    // stay roughly in order, prefer what's close
      if (d < score) { score = d; best = i; }
    }
    return best < 0 ? null : q.splice(best, 1)[0];
  }

  function finish(t) {
    var s = S;
    if (t.type === 'box') t.item.boxPending = false;
    t.leaders.forEach(function (L) { s.pending.set(L, s.pending.get(L) - 1); });
    s.done++;
  }

  // Queue whatever is near the viewport (fixed things are always near), plus whatever it waits on:
  // its parent containers and, for a clone, the first instance it copies. Otherwise it could wait forever
  // on a container that starts above the build range.
  function activate() {
    var s = S, y0 = sy() - opts.margin, y1 = sy() + global.innerHeight + opts.margin, added = false;
    function pull(t) {
      if (!t || t.active) return;
      t.active = true; s.queue.push(t); added = true;
      if (t.item && t.item.pbox) pull(t.item.pbox.boxTask);
      if (t.type !== 'box' && t.item && t.item.boxTask) pull(t.item.boxTask);
      if (t.type === 'clone') (s.leaderTasks.get(t.group.leader) || []).forEach(pull);
    }
    s.pool.forEach(function (t) { if (t.fixed || (t.top < y1 && t.bottom > y0)) pull(t); });
    for (var j = s.pops.length - 1; j >= 0; j--) {
      var it = s.pops[j], v = it.vis;
      if (it.fixed || (v.y < y1 && v.y + v.h > y0)) { s.pops.splice(j, 1); if (it.pbox) pull(it.pbox.boxTask); popLater(it); }
    }
    if (added) { s.pool = s.pool.filter(function (t) { return !t.active; }); s.queue.sort(sortKey); }
  }
  function popLater(it) {
    var s = S;
    (function check() {
      if (s.dead) return;
      if (!it.pbox || !it.pbox.boxPending) reveal(it, true);
      else { var id = setTimeout(function () { s.timers.delete(id); check(); }, 120); s.timers.add(id); }
    })();
  }

  async function worker(c) {
    var s = S;
    try {
      await sleep(rand(60, 360));
      for (;;) {
        if (s.dead) return;
        var t = takeTask(c);
        if (!t) { c.idle = true; await sleep(140); continue; }
        c.idle = false; s.running++;
        try { await RUN[t.type](t, c); }
        catch (err) {
          if (err === ABORT) throw err;
          if (t.item) reveal(t.item, false); else if (t.group) t.group.items.forEach(function (it) { reveal(it, false); });
          if (global.console) console.warn('SwarmRebuild task failed', err);
        }
        s.running--; finish(t);
        await sleep(rand(20, 60));
      }
    } catch (err) { /* aborted at Go Live */ }
  }

  /* ── 3. Frame loop: tweens, cursors, flocking, tour, HUD ─────────────── */
  function frame(now) {
    var s = S; if (!s || s.dead) return;
    var dt = Math.min(0.05, (now - s.lastT) / 1000); s.lastT = now;

    for (var i = s.tweens.length - 1; i >= 0; i--) {
      var tw = s.tweens[i], p = clamp((now - tw.t0) / tw.dur, 0, 1);
      tw.fn(tw.ease(p), p);
      if (p >= 1) { s.tweens.splice(i, 1); tw.res(); }
    }

    var y = sy();
    if (y !== s.lastY) { s.lastY = y; activate(); }
    if (s.tour) tourStep(now);

    var mx = s.mouse ? s.mouse.x + sx() : sx() + global.innerWidth / 2;
    var my = s.mouse ? s.mouse.y + sy() : sy() + global.innerHeight / 2;
    var n = s.cursors.length;
    s.cursors.forEach(function (c, k) {
      if (c.idle && !c.arrive) {   // flock: orbit the visitor's pointer
        c.orbit += dt * (0.9 + k * 0.08);
        var rad = 52 + (k % 4) * 16 + Math.sin(now / 700 + k) * 8, a = c.orbit + k * (Math.PI * 2 / n);
        c.tx = mx + Math.cos(a) * rad; c.ty = my + Math.sin(a) * rad * 0.8;
      }
      c.step(dt, s.speed);
    });

    if (++s.frames % 12 === 0) { updateHud(); maybeComplete(); }
    s.raf = requestAnimationFrame(frame);
  }

  function maybeComplete() {
    var s = S;
    if (!opts.autoLive || s.liveTimer || s.queue.length || s.running) return;
    if (opts.liveAfter === 'page' && (s.pool.length || s.pops.length)) return;
    s.liveTimer = setTimeout(function () {
      if (S !== s) return;
      if (s.queue.length || s.running) { s.liveTimer = null; return; }   // the visitor scrolled to new work meanwhile
      goLive();
    }, 900 / s.speed);
    s.timers.add(s.liveTimer);
  }

  function tourStep(now) {
    var s = S;
    if (now < s.tourPause) return;
    var max = docSize().h - global.innerHeight, y = sy();
    if (y >= max - 1) return;
    var y0 = y, y1 = y + global.innerHeight, busy = s.running > 0;
    for (var i = 0; !busy && i < s.queue.length; i++) if (s.queue[i].top < y1 && s.queue[i].bottom > y0) busy = true;
    if (busy) return;
    var ny = Math.min(max, y + 2.4 * s.speed);
    s.expectY = ny;
    global.scrollTo({ top: ny, behavior: 'instant' });
  }
  function pauseTour() { if (S && S.tour) S.tourPause = performance.now() + 2600; }

  /* ── Session lifecycle ───────────────────────────────────────────────── */
  function start() {
    if (S) stop(false);
    var root = opts.root || document.body; if (!root) return;
    if (typeof opts.prepare === 'function') { try { opts.prepare(); } catch (e) {} }
    // The boot class hides the page with visibility, which the scanner would read as "hidden". Lift it for the
    // (synchronous) scan; swarm-on hides the page again before the browser paints.
    html.classList.remove('swarm-boot');
    html.classList.add('swarm-scanning');
    void html.offsetHeight;                     // settle layout with transitions/animations off
    var scan = scanPage(root);
    html.classList.remove('swarm-scanning');
    BAND = Math.max(300, global.innerHeight * 0.8);

    var s = S = {
      speed: opts.speed, tour: !!opts.tour, sound: opts.sound,
      timers: new Set(), tweens: [], listeners: [], cursors: [],
      queue: [], pool: [], pops: [], pending: null,
      running: 0, done: 0, total: 0, frames: 0, guides: 0,
      dead: false, mouse: null, lastT: performance.now(), lastY: null, tourPause: 0, expectY: null, liveTimer: null
    };
    s.ov = buildOverlay(scan);
    var made = makeTasks(scan);
    s.pool = made.tasks; s.pops = made.pops; s.pending = made.pending; s.leaderTasks = made.leaderTasks; s.total = made.tasks.length;

    var count = clamp(opts.cursors | 0, 6, 10);
    for (var i = 0; i < count; i++) s.cursors.push(new Cursor(i, s.ov.cursors));

    html.classList.add('swarm-on'); html.classList.remove('swarm-boot');
    listen(global, 'scroll', function () {
      if (s.expectY !== null && Math.abs(sy() - s.expectY) > 3) pauseTour();
      s.expectY = null;
    }, { passive: true });
    listen(global, 'pointermove', function (e) { s.mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
    ['wheel', 'touchstart', 'pointerdown'].forEach(function (ev) { listen(global, ev, pauseTour, { passive: true }); });
    var w0 = global.innerWidth;
    listen(global, 'resize', function () { if (Math.abs(global.innerWidth - w0) > 40) goLive(); });   // layout snapshot no longer valid

    Sound.setEnabled(!!s.sound);
    activate(); s.lastY = sy();
    s.cursors.forEach(worker);
    s.raf = requestAnimationFrame(frame);
    updateHud();
    global.dispatchEvent(new CustomEvent('swarm:start'));
    if (typeof opts.onStart === 'function') opts.onStart();
  }

  function listen(t, ev, fn, o) { t.addEventListener(ev, fn, o); S.listeners.push(function () { t.removeEventListener(ev, fn, o); }); }

  // Tear down every loop, timer, listener and audio node. fade=false removes the overlay at once.
  function stop(fade) {
    var s = S; if (!s) return;
    s.dead = true; S = null;
    cancelAnimationFrame(s.raf);
    s.timers.forEach(clearTimeout); s.timers.clear();
    s.tweens.length = 0;
    s.listeners.forEach(function (off) { off(); });
    Sound.close();
    html.classList.remove('swarm-on', 'swarm-boot');
    var ov = s.ov.root;
    if (fade && !reduceMotion.matches) { ov.classList.add('sw-out'); setTimeout(function () { ov.remove(); }, 560); }
    else ov.remove();
  }

  function goLive() {
    if (!S) { html.classList.remove('swarm-boot'); return; }
    stop(true);
    updateHud();
    global.dispatchEvent(new CustomEvent('swarm:live'));
    if (typeof opts.onLive === 'function') opts.onLive();
  }

  function replay() { Sound.unlock(); start(); }
  function setSpeed(n) { n = clamp(Math.round(n), 1, 3); opts.speed = n; if (S) S.speed = n; updateHud(); }
  function toggleTour(force) {
    var on = typeof force === 'boolean' ? force : !(S ? S.tour : opts.tour);
    opts.tour = on; if (S) { S.tour = on; S.tourPause = 0; }
    updateHud();
  }
  function toggleSound(force) {
    var on = typeof force === 'boolean' ? force : !opts.sound;
    opts.sound = on; if (S) S.sound = on;
    Sound.setEnabled(on); updateHud();
  }

  /* ── 5. HUD & keyboard ───────────────────────────────────────────────── */
  var ICONS = {
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>',
    tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/></svg>',
    live: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l11 7-11 7z"/></svg>'
  };
  function buildHud() {
    hud = mk('div', 'swarm-keep'); hud.id = 'swarm-hud';
    hud.setAttribute('role', 'toolbar'); hud.setAttribute('aria-label', 'Swarm Rebuild controls');
    hud.innerHTML =
      '<button type="button" class="sw-btn" data-act="replay" title="Replay (Alt+Shift+S)">' + ICONS.replay + '<span class="sw-lbl">Replay</span></button>' +
      '<span class="sw-seg" role="group" aria-label="Speed">' +
        '<button type="button" class="sw-btn" data-speed="1" title="Speed 1× (1)">1×</button>' +
        '<button type="button" class="sw-btn" data-speed="2" title="Speed 2× (2)">2×</button>' +
        '<button type="button" class="sw-btn" data-speed="3" title="Speed 3× (3)">3×</button>' +
      '</span>' +
      '<button type="button" class="sw-btn" data-act="tour" title="Tour mode: auto-scroll with the build">' + ICONS.tour + '<span class="sw-lbl">Tour</span></button>' +
      '<button type="button" class="sw-btn" data-act="sound" title="Sound (M)"></button>' +
      '<span class="sw-status" aria-live="polite"></span>' +
      '<button type="button" class="sw-btn sw-live" data-act="live" title="Go Live (L or Esc)">' + ICONS.live + '<span>Go Live</span></button>';
    html.appendChild(hud);
    hudEls = {
      speed: hud.querySelectorAll('[data-speed]'), tour: hud.querySelector('[data-act="tour"]'),
      sound: hud.querySelector('[data-act="sound"]'), status: hud.querySelector('.sw-status'), replay: hud.querySelector('[data-act="replay"]')
    };
    hud.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      Sound.unlock();
      if (b.dataset.speed) setSpeed(+b.dataset.speed);
      var act = b.dataset.act;
      if (act === 'replay') replay();
      else if (act === 'tour') toggleTour();
      else if (act === 'sound') toggleSound();
      else if (act === 'live') goLive();
    });
    updateHud();
  }
  function updateHud() {
    if (!hud) return;
    var running = !!S;
    hud.classList.toggle('is-live', !running);
    hudEls.replay.querySelector('.sw-lbl').textContent = running ? 'Replay' : 'Rebuild';
    var sp = running ? S.speed : opts.speed;
    Array.prototype.forEach.call(hudEls.speed, function (b) { b.setAttribute('aria-pressed', String(+b.dataset.speed === sp)); });
    hudEls.tour.setAttribute('aria-pressed', String(running ? S.tour : !!opts.tour));
    hudEls.sound.setAttribute('aria-pressed', String(!!opts.sound));
    hudEls.sound.innerHTML = (opts.sound ? ICONS.on : ICONS.off) + '<span class="sw-lbl">' + (opts.sound ? 'Sound' : 'Muted') + '</span>';
    if (running) {
      // Progress of what is on (or near) screen; scrolling queues more.
      var open = S.done + S.queue.length + S.running;
      hudEls.status.textContent = 'Building ' + (open ? Math.round(S.done / open * 100) : 100) + '%';
    } else hudEls.status.textContent = '';
  }

  function onKey(e) {
    if (isTypingTarget(e.target)) return;
    if (e.altKey && e.shiftKey && e.code === 'KeyS') { e.preventDefault(); replay(); return; }
    if (!S || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') { setSpeed(+e.key); e.preventDefault(); }
    else if (e.key === 'm' || e.key === 'M') toggleSound();
    else if (e.key === 'l' || e.key === 'L' || e.key === 'Escape') { e.preventDefault(); goLive(); }
    else if (/^(ArrowDown|ArrowUp|PageDown|PageUp|Home|End| )$/.test(e.key)) pauseTour();
  }
  function onGesture() { if (opts.sound) Sound.unlock(); }

  /* ── 6. Public API ───────────────────────────────────────────────────── */
  function whenReady() {
    var dom = document.readyState === 'loading' ? new Promise(function (r) { document.addEventListener('DOMContentLoaded', r, { once: true }); }) : Promise.resolve();
    return dom.then(function () {
      var load = document.readyState === 'complete' ? Promise.resolve() : new Promise(function (r) { global.addEventListener('load', r, { once: true }); });
      var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      return Promise.race([Promise.all([load, fonts]), new Promise(function (r) { setTimeout(r, 2500); })]);
    });
  }

  var API = {
    init: function (o) {
      opts = assign({}, DEFAULTS, o || {});
      opts.speed = clamp(opts.speed | 0 || 1, 1, 3);
      var go = opts.autoStart && !reduceMotion.matches;
      if (go) html.classList.add('swarm-boot');   // hide the real page until the overlay is up
      if (!bound) {
        bound = true;
        global.addEventListener('keydown', onKey);
        global.addEventListener('pointerdown', onGesture, true);
        global.addEventListener('keydown', onGesture, true);
      }
      return whenReady().then(function () {
        if (opts.hud && !hud) buildHud();
        if (go) start(); else html.classList.remove('swarm-boot');
        return API;
      });
    },
    start: function () { Sound.unlock(); start(); },
    replay: replay,
    goLive: goLive,
    setSpeed: setSpeed,
    toggleTour: toggleTour,
    toggleSound: toggleSound,
    isRunning: function () { return !!S; },
    destroy: function () {
      stop(false);
      if (hud) { hud.remove(); hud = null; hudEls = null; }
      if (bound) {
        bound = false;
        global.removeEventListener('keydown', onKey);
        global.removeEventListener('pointerdown', onGesture, true);
        global.removeEventListener('keydown', onGesture, true);
      }
    }
  };

  global.SwarmRebuild = API;
  if (typeof module === 'object' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
