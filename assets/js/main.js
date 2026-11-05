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
        setTimeout(next, 60);
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
    reveals.forEach(function (el) { observer.observe(el); });
  }

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

  /* ── Demo 1: StudyQuest mini quiz ─────────────────────────────────────── */
  (function () {
    var opts = $('#sq-opts'); if (!opts) return;
    var QUESTIONS = [
      { q: 'Which HTML tag makes a link?', a: ['<a>', '<link>', '<href>'], r: 0 },
      { q: 'What does CSS stand for?', a: ['Cascading Style Sheets', 'Creative Style System', 'Coded Site Styles'], r: 0 },
      { q: 'Which one is a JavaScript framework for mobile apps?', a: ['Laravel', 'React Native', 'MySQL'], r: 1 },
      { q: 'Which database does StudyQuest use?', a: ['Firebase', 'Oracle', 'Excel'], r: 0 },
      { q: 'What does "AR" stand for in GABAY?', a: ['Auto Routing', 'Augmented Reality', 'Active Response'], r: 1 },
      { q: 'Which tag holds the biggest heading?', a: ['<h6>', '<head>', '<h1>'], r: 2 }
    ];
    var qEl = $('#sq-q'), msg = $('#sq-msg'), secEl = $('#sq-sec'), ring = $('#sq-ring'), xpEl = $('#sq-xp'), xpBar = $('#sq-xpbar'), timerBox = $('.sq-timer'), streak = $('#sq-streak');
    var xp = 340, idx = 0, sec = 20, timer = null, locked = false, correctRun = 0;
    function render() {
      var Q = QUESTIONS[idx];
      qEl.textContent = Q.q;
      opts.innerHTML = '';
      Q.a.forEach(function (t, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = t;
        b.addEventListener('click', function () { answer(i, b); });
        opts.appendChild(b);
      });
      sec = 20; locked = false; tickView();
    }
    function tickView() {
      secEl.textContent = sec;
      ring.style.strokeDashoffset = String(94.25 * (1 - sec / 20));
      timerBox.classList.toggle('is-urgent', sec <= 5);
    }
    function startTimer() {
      if (timer) return;
      timer = setInterval(function () {
        if (locked) return;
        sec = Math.max(0, sec - 1); tickView();
        if (sec === 0) { locked = true; msg.textContent = "Time's up! Next question…"; correctRun = 0; setTimeout(next, 1200); }
      }, 1000);
    }
    function answer(i, btn) {
      if (locked) return;
      locked = true; startTimer();
      var Q = QUESTIONS[idx];
      if (i === Q.r) {
        btn.classList.add('is-right');
        var gain = 20 + sec; xp += gain; correctRun++;
        msg.textContent = 'Correct! +' + gain + ' XP';
        xpEl.textContent = xp;
        xpBar.style.width = Math.min(100, 40 + correctRun * 12) + '%';
        if (correctRun >= 3) streak.textContent = correctRun + ' in a row!';
      } else {
        btn.classList.add('is-wrong');
        opts.children[Q.r].classList.add('is-right');
        msg.textContent = 'Not quite. The answer is ' + Q.a[Q.r];
        correctRun = 0; streak.textContent = '7-day streak';
      }
      setTimeout(next, 1400);
    }
    function next() { idx = (idx + 1) % QUESTIONS.length; render(); }
    // The timer only runs while the demo is on screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) startTimer(); else { clearInterval(timer); timer = null; } });
      }, { threshold: .5 }).observe(opts);
    }
    render();
  })();

  /* ── Demo 2: BansaRide route + passenger toggle ───────────────────────── */
  (function () {
    var seg = $$('.br-seg button'); if (!seg.length) return;
    var ROUTES = [
      { n: 'Public Market → Bus Terminal', d: 'M58 70 C 90 110, 150 95, 142 160 S 80 230, 104 262' },
      { n: 'Bus Terminal → SMCBI', d: 'M150 40 C 120 80, 60 90, 70 150 S 150 200, 120 250' },
      { n: 'Poblacion → Barangay hall', d: 'M30 120 C 70 90, 120 140, 160 110 S 170 220, 60 240' }
    ];
    var r = 0, route = $('#br-route'), name = $('#br-name'), sub = $('#br-sub'), dots = $$('.br-dot');
    function draw() {
      var R = ROUTES[r];
      route.setAttribute('d', R.d);
      var m = R.d.match(/M(\d+) (\d+)/), e = R.d.match(/(\d+) (\d+)$/);
      dots[0].setAttribute('cx', m[1]); dots[0].setAttribute('cy', m[2]);
      dots[1].setAttribute('cx', e[1]); dots[1].setAttribute('cy', e[2]);
      name.textContent = R.n;
    }
    seg.forEach(function (b) {
      b.addEventListener('click', function () {
        seg.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        sub.textContent = 'Tricycle or pedicab · fare shown for ' + (b.dataset.p === 'adult' ? 'an adult' : 'a ' + b.dataset.p);
      });
    });
    $('#br-swap').addEventListener('click', function () { r = (r + 1) % ROUTES.length; draw(); });
  })();

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
    document.dispatchEvent(new CustomEvent('intro:done'));
    startReveals();
  });
})();
