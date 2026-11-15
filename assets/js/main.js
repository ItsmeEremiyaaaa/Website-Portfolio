/* Jeremiah Escubido — Portfolio. Dependency-free interactions:
   intro, menu, reveals (framed by cursors.js), hero photo deck and bouncy name, scroll-driven work slides
   with three playable phone demos, flip cards, toolbox filter, journey slider, swipe photo roll,
   contact message builder, photo viewer, copy email. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var cursors = function () { return window.PortfolioCursors || { enabled: false }; };

  /* ── Intro loader ─────────────────────────────────────────────────────── */
  function runIntro(cb) {
    if (!root.classList.contains('has-intro')) { cb(); return; }
    var num = $('#intro-num'), fill = $('#intro-fill');
    var start = performance.now(), dur = 1800, finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      num.textContent = '100'; fill.style.width = '100%';
      root.classList.add('intro-out');
      setTimeout(function () { root.classList.add('intro-gone'); }, 950);
      setTimeout(cb, 250);
    }
    (function tick(now) {
      if (finished) return;
      var t = Math.min(1, (now - start) / dur), p = Math.round((1 - Math.pow(1 - t, 3)) * 100);
      num.textContent = p; fill.style.width = p + '%';
      if (t < 1) requestAnimationFrame(tick); else setTimeout(finish, 250);
    })(start);
    $('#intro-skip').addEventListener('click', finish);
  }

  /* ── Themes ───────────────────────────────────────────────────────────── */
  var themeBtns = $$('.theme-pick button');
  function setTheme(name, opts) {
    var apply = function () {
      if (name === 'maroon') delete root.dataset.theme; else root.dataset.theme = name;
      themeBtns.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.theme === name)); });
    };
    if (!(opts && opts.instant) && document.startViewTransition && !reduceMotion.matches) document.startViewTransition(apply); else apply();
    if (!(opts && opts.preview)) { try { localStorage.setItem('theme', name); } catch (e) {} }
  }
  function getTheme() { return root.dataset.theme || 'maroon'; }
  themeBtns.forEach(function (b) {
    b.setAttribute('aria-checked', String(b.dataset.theme === getTheme()));
    b.addEventListener('click', function (e) { setTheme(b.dataset.theme, { preview: !e.isTrusted }); });
  });
  window.PortfolioTheme = { list: themeBtns.map(function (b) { return b.dataset.theme; }), set: setTheme, get: getTheme };

  /* ── Mobile menu & active link ────────────────────────────────────────── */
  var menuBtn = $('.menu-toggle'), menu = $('#mobile-menu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  var navLinks = $$('.nav-links a');
  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { navObserver.observe(s); });
  }

  /* ── Reveal on scroll: live cursors frame each block, then it appears ── */
  function startReveals() {
    var reveals = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion.matches) { reveals.forEach(function (el) { el.classList.add('is-visible'); }); return; }
    var queue = [], flushing = false;
    function show(el) {
      el.classList.add('is-visible');
      el.addEventListener('transitionend', function done(e) {
        if (e.target !== el || e.propertyName !== 'opacity') return;
        el.removeEventListener('transitionend', done);
        el.classList.remove('reveal', 'is-visible');
      });
    }
    function flush() {
      if (flushing) return;
      flushing = true;
      (function next() {
        var el = queue.shift();
        if (!el) { flushing = false; return; }
        if (cursors().enabled) cursors().construct(el).then(function () { show(el); }); else show(el);
        setTimeout(next, 200);
      })();
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        queue.push(entry.target);
      });
      flush();
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var inHero = function (el) { return !!el.closest('.hero'); };
    reveals.forEach(function (el) { if (!(root.classList.contains('hero-seq') && inHero(el))) observer.observe(el); });
    // Lets the agents tear the page down and rebuild it (used by Back to top).
    window.PortfolioReveal = {
      all: reveals,
      reset: function (opts) {
        queue.length = 0;
        reveals.forEach(function (el) {
          el.classList.remove('is-visible', 'cx-deleting');
          el.classList.add('reveal');
          if (!(opts && opts.skipHero && inHero(el))) observer.observe(el);
        });
      }
    };
  }

  /* ── Back to top: agents rewind the page (falls back to a plain smooth scroll) ── */
  $$('.back-top').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var c = window.PortfolioCursors;
      if (c && c.enabled && c.backToTop && window.PortfolioReveal) c.backToTop(a);
      else window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  /* ── Tilt (mouse / trackpad) ──────────────────────────────────────────── */
  if (finePointer.matches && !reduceMotion.matches) {
    $$('.tilt').forEach(function (el) {
      var frame = 0;
      el.addEventListener('pointermove', function (e) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--ry', ((px - 0.5) * 20).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - py) * 20).toFixed(2) + 'deg');
          el.classList.add('is-tilting');
        });
      });
      el.addEventListener('pointerleave', function () {
        cancelAnimationFrame(frame);
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ── Hero: bouncy name letters + shuffle-able photo deck ──────────────── */
  $$('.ltr').forEach(function (l) {
    l.addEventListener('pointerenter', function () {
      l.classList.add('is-pop');
      setTimeout(function () { l.classList.remove('is-pop'); }, 180);
    });
    // Click a letter of the name and it spins, with a burst of tiny cursors.
    l.addEventListener('click', function (e) {
      l.classList.remove('is-spin'); void l.offsetWidth; l.classList.add('is-spin');
      var c = window.PortfolioCursors;
      if (c && c.burst) c.burst(e.clientX, e.clientY, 14);
    });
  });

  /* ── Scroll progress line under the nav ───────────────────────────────── */
  var progress = document.createElement('span');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  $('.site-header').appendChild(progress);
  var setProgress = function () {
    var max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0).toFixed(4) + ')';
  };
  addEventListener('scroll', setProgress, { passive: true });
  addEventListener('resize', setProgress);
  setProgress();
  var deck = $('#hero-deck');
  if (deck) {
    var photos = $$('.deck-photo', deck).reverse(); // last in markup sits on top
    var order = photos.map(function (_, i) { return i; });
    var place = function () { order.forEach(function (photoIndex, pos) { photos[photoIndex].dataset.pos = pos; }); };
    place();
    var busy = false;
    var shuffle = function () {
      if (busy) return;
      busy = true;
      var top = photos[order[0]];
      top.classList.add('is-leaving');
      setTimeout(function () {
        order.push(order.shift());
        top.classList.remove('is-leaving');
        place();
        busy = false;
      }, 330);
    };
    deck.addEventListener('click', shuffle);
    $('#hero-shuffle').addEventListener('click', shuffle);
  }

  /* ── Work: vertical scroll drives the slides sideways ─────────────────── */
  var work = $('#work'), track = $('#work-track');
  if (work && track) {
    var slides = $$('.slide', track), N = slides.length;
    var pin = $('.work-pin', work), bar = $('#work-bar'), now = $('#work-now'), dots = $$('#work-dots button');
    var wideScreen = window.matchMedia('(min-width: 901px)');
    var active = -1;
    var native = function () { return !wideScreen.matches || reduceMotion.matches; };
    var setActive = function (i) {
      if (i === active) return;
      active = i;
      now.textContent = String(i + 1).padStart(2, '0');
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', String(k === i)); });
      slides.forEach(function (s, k) { s.setAttribute('aria-hidden', String(k !== i && !native())); s.inert = k !== i && !native(); });
      // A live cursor frames the new slide's demo, like a designer picking it up.
      if (cursors().enabled) cursors().construct($('.slide-art', slides[i]));
    };
    var update = function () {
      if (native()) {
        work.classList.add('is-native');
        var i2 = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        bar.style.width = ((i2 + 1) / N * 100) + '%';
        setActive(clamp(i2, 0, N - 1));
        return;
      }
      work.classList.remove('is-native');
      var r = pin.getBoundingClientRect(), total = pin.offsetHeight - (innerHeight - 64);
      var p = clamp(-r.top / Math.max(1, total), 0, 1);
      // Ease each step so slides settle instead of drifting mid-way.
      var raw = p * (N - 1), base = Math.floor(raw), f = raw - base;
      var eased = base + (f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);
      track.style.transform = 'translate3d(' + (-eased * (100 / N)) + '%,0,0)';
      bar.style.width = ((p * (N - 1) + 1) / N * 100) + '%';
      setActive(clamp(Math.round(raw), 0, N - 1));
    };
    var go = function (i) {
      i = clamp(i, 0, N - 1);
      if (native()) { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); return; }
      var total = pin.offsetHeight - (innerHeight - 64);
      var top = pin.getBoundingClientRect().top + scrollY - 64;
      scrollTo({ top: top + total * (i / (N - 1)) + 2, behavior: 'smooth' });
    };
    $('#work-prev').addEventListener('click', function () { go(active - 1); });
    $('#work-next').addEventListener('click', function () { go(active + 1); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
    work.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') { go(active + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(active - 1); e.preventDefault(); }
    });
    var ticking = false;
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } };
    addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ── Demo 3: GABAY — walk through the real app screens ─────────────── */
  (function () {
    var screen = $('#gb-real'); if (!screen) return;
    var shots = $$('.gb-shot', screen), tabs = $$('.gb-tabs button'), step = $('#gb-step');
    var i = 0, auto = null;
    function show(k) {
      i = (k + shots.length) % shots.length;
      shots.forEach(function (s, n) { s.classList.toggle('is-on', n === i); });
      tabs.forEach(function (t, n) { t.setAttribute('aria-pressed', String(n === i)); });
      step.textContent = (i + 1) + ' / ' + shots.length + ' · ' + tabs[i].textContent;
    }
    function stop() { clearInterval(auto); auto = null; }
    function play() { if (!auto && !reduceMotion.matches) auto = setInterval(function () { show(i + 1); }, 2600); }
    screen.addEventListener('click', function () { stop(); show(i + 1); });
    screen.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); show(i + 1); } });
    tabs.forEach(function (t, n) { t.addEventListener('click', function () { stop(); show(n); }); });
    // Plays on its own while visible, until someone takes over.
    var touched = false;
    screen.addEventListener('pointerdown', function () { touched = true; });
    tabs.forEach(function (t) { t.addEventListener('pointerdown', function () { touched = true; }); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && !touched) play(); else stop(); });
      }, { threshold: .6 }).observe(screen);
    }
  })();

  /* ── Flip cards ───────────────────────────────────────────────────────── */
  $$('.fact').forEach(function (card) {
    card.addEventListener('click', function () { card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true')); });
  });

  /* ── Toolbox: filter + where I used it ────────────────────────────────── */
  (function () {
    var tools = $$('.tool'); if (!tools.length) return;
    var filters = $$('.tool-filters button'), nameEl = $('#tool-name'), useEl = $('#tool-use'), countEl = $('#tool-count');
    var current = 'all';
    function show(t) {
      tools.forEach(function (x) { x.classList.toggle('is-on', x === t); });
      nameEl.textContent = t.textContent;
      useEl.textContent = t.dataset.u;
    }
    tools.forEach(function (t) {
      t.addEventListener('pointerenter', function () { show(t); });
      t.addEventListener('focus', function () { show(t); });
      t.addEventListener('click', function () { show(t); });
    });
    filters.forEach(function (f) {
      f.addEventListener('click', function () {
        current = f.dataset.f;
        filters.forEach(function (x) { x.setAttribute('aria-pressed', String(x === f)); });
        var n = 0;
        tools.forEach(function (t) {
          var on = current === 'all' || t.dataset.c === current;
          t.classList.toggle('is-dim', !on);
          t.tabIndex = on ? 0 : -1;
          if (on) n++;
        });
        countEl.textContent = n;
        var first = tools.filter(function (t) { return !t.classList.contains('is-dim'); })[0];
        if (first) show(first);
      });
    });
  })();

  /* ── Journey: drag to scroll + arrows ─────────────────────────────────── */
  (function () {
    var tr = $('#journey-track'); if (!tr) return;
    var step = function () { var c = $('.jcard', tr); return c ? c.offsetWidth + 18 : 300; };
    $('#j-prev').addEventListener('click', function () { tr.scrollBy({ left: -step(), behavior: 'smooth' }); });
    $('#j-next').addEventListener('click', function () { tr.scrollBy({ left: step(), behavior: 'smooth' }); });
    var down = null;
    tr.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = { x: e.clientX, left: tr.scrollLeft };
      tr.classList.add('is-dragging');
    });
    addEventListener('pointermove', function (e) { if (down) tr.scrollLeft = down.left - (e.clientX - down.x); });
    addEventListener('pointerup', function () {
      if (!down) return;
      down = null; tr.classList.remove('is-dragging');
      var s = step(); tr.scrollTo({ left: Math.round(tr.scrollLeft / s) * s, behavior: 'smooth' });
    });
  })();

  /* ── Photo viewer ─────────────────────────────────────────────────────── */
  var lightbox = $('#lightbox');
  function openPhoto(src, alt) {
    if (!lightbox || typeof lightbox.showModal !== 'function') return;
    var img = $('img', lightbox);
    img.src = src; img.alt = alt;
    $('figcaption', lightbox).textContent = alt;
    lightbox.showModal();
  }
  if (lightbox) {
    $('.lb-close', lightbox).addEventListener('click', function () { lightbox.close(); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox || e.target.tagName === 'FIGURE') lightbox.close(); });
  }

  /* ── Links with data-dialog open that dialog first (the plain link still works without JS) ── */
  $$('[data-dialog]').forEach(function (link) {
    var dlg = document.getElementById(link.dataset.dialog);
    if (!dlg || typeof dlg.showModal !== 'function') return;
    link.addEventListener('click', function (e) { e.preventDefault(); dlg.showModal(); });
    $('.dl-close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); }); // click on the backdrop
  });

  /* ── Camera roll: swipe the top photo away ────────────────────────────── */
  (function () {
    var roll = $('#roll'); if (!roll) return;
    var cards = $$('.roll-card', roll), n = cards.length, top = 0;
    var countEl = $('#roll-count');
    function layout() {
      cards.forEach(function (c, i) {
        var pos = (i - top + n) % n;
        c.style.zIndex = String(n - pos);
        c.style.transform = pos < 4 ? 'translate(' + (pos * 10) + 'px,' + (pos * 8) + 'px) rotate(' + [2, -4, 5, -2][pos] + 'deg)' : 'translate(30px,24px) rotate(-2deg)';
        c.style.opacity = pos < 4 ? '1' : '0';
        c.setAttribute('aria-hidden', String(pos !== 0));
      });
      countEl.textContent = (top + 1) + ' / ' + n;
    }
    function fling(dir) {
      var c = cards[top];
      c.style.transform = 'translate(' + (dir * 130) + '%, -6%) rotate(' + (dir * 24) + 'deg)';
      c.style.opacity = '0';
      setTimeout(function () { top = (top + 1) % n; layout(); }, 260);
    }
    $('#roll-next').addEventListener('click', function () { fling(1); });
    $('#roll-prev').addEventListener('click', function () { top = (top - 1 + n) % n; layout(); });
    var drag = null;
    roll.addEventListener('pointerdown', function (e) {
      var c = e.target.closest('.roll-card');
      if (!c || c !== cards[top]) return;
      drag = { c: c, x: e.clientX, y: e.clientY, dx: 0 };
      c.classList.add('is-held');
      c.setPointerCapture(e.pointerId);
    });
    roll.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      drag.c.style.transform = 'translate(' + drag.dx + 'px,' + dy * .4 + 'px) rotate(' + drag.dx / 14 + 'deg)';
    });
    function release() {
      if (!drag) return;
      var c = drag.c, dx = drag.dx;
      c.classList.remove('is-held');
      drag = null;
      if (Math.abs(dx) > 90) fling(dx > 0 ? 1 : -1);
      else if (Math.abs(dx) < 5) { layout(); var img = $('img', c); openPhoto(c.dataset.full, img.alt); }
      else layout();
    }
    roll.addEventListener('pointerup', release);
    roll.addEventListener('pointercancel', release);
    roll.tabIndex = 0;
    roll.setAttribute('aria-label', 'Photo roll. Use the left and right arrow keys.');
    roll.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') fling(1);
      if (e.key === 'ArrowLeft') { top = (top - 1 + n) % n; layout(); }
      if (e.key === 'Enter') { var c = cards[top]; openPhoto(c.dataset.full, $('img', c).alt); }
    });
    layout();
  })();

  /* ── Contact: topic → email subject ───────────────────────────────────── */
  (function () {
    var topics = $$('.topics button'); if (!topics.length) return;
    var subj = $('#topic-subject'), mail = $('#mail-btn');
    topics.forEach(function (t) {
      t.addEventListener('click', function () {
        topics.forEach(function (x) { x.setAttribute('aria-checked', String(x === t)); });
        var s = t.dataset.s + ' — from your portfolio';
        subj.textContent = s;
        mail.href = 'mailto:jeremiahescubido05@gmail.com?subject=' + encodeURIComponent(s);
        mail.lastChild.textContent = ' Email me about ' + t.textContent.toLowerCase();
      });
    });
  })();

  /* ── Copy email ───────────────────────────────────────────────────────── */
  $$('.copy-email').forEach(function (btn) {
    var label = $('.copy-label', btn);
    btn.addEventListener('click', function () {
      var email = btn.dataset.email;
      var done = function () {
        btn.classList.add('is-copied'); label.textContent = 'Copied';
        setTimeout(function () { btn.classList.remove('is-copied'); label.textContent = 'Copy address'; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(email).then(done, function () { label.textContent = email; });
      else label.textContent = email;
    });
  });

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  runIntro(function () {
    try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
    startReveals();
    var c = window.PortfolioCursors;
    if (root.classList.contains('hero-seq')) {
      if (c && c.heroSequence) c.heroSequence();
      else root.classList.remove('hero-seq'), $$('.hero .reveal').forEach(function (el) { el.classList.add('is-visible'); });
    }
    document.dispatchEvent(new CustomEvent('intro:done'));
  });
})();
