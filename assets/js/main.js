/* Jeremiah Escubido — Portfolio. Small, dependency-free enhancements:
   intro loader, mobile menu, active nav, reveals (framed by cursors.js), tilt, photo viewer, copy email. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ── Intro loader ─────────────────────────────────────────────────────── */
  function introDone() {
    try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
    document.dispatchEvent(new CustomEvent('intro:done'));
  }
  function runIntro(cb) {
    if (!root.classList.contains('has-intro')) { cb(); return; }
    var num = document.getElementById('intro-num');
    var fill = document.getElementById('intro-fill');
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
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var p = Math.round(eased * 100);
      num.textContent = p; fill.style.width = p + '%';
      if (t < 1) requestAnimationFrame(tick); else setTimeout(finish, 250);
    })(start);
    document.getElementById('intro-skip').addEventListener('click', finish);
  }

  /* ── Mobile menu ──────────────────────────────────────────────────────── */
  var menuBtn = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  /* ── Active nav link ──────────────────────────────────────────────────── */
  var navLinks = document.querySelectorAll('.nav-links a');
  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { navObserver.observe(s); });
  }

  /* ── Staggered children ───────────────────────────────────────────────── */
  document.querySelectorAll('.stagger').forEach(function (list) {
    Array.prototype.forEach.call(list.children, function (child, i) { child.style.setProperty('--i', i); });
  });

  /* ── Reveal on scroll: live cursors frame each block, then it appears ── */
  function startReveals() {
    var reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      reveals.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var queue = [], flushing = false;
    function show(el) {
      el.classList.add('is-visible');
      el.addEventListener('transitionend', function done(e) {
        if (e.target !== el || e.propertyName !== 'opacity' || el.classList.contains('stagger')) return;
        el.removeEventListener('transitionend', done);
        el.classList.remove('reveal', 'is-visible');
      });
    }
    // Items that enter together are handed to the cursors one after another.
    function flush() {
      if (flushing) return;
      flushing = true;
      (function next() {
        var el = queue.shift();
        if (!el) { flushing = false; return; }
        var cursors = window.PortfolioCursors;
        if (cursors && cursors.enabled) cursors.construct(el).then(function () { show(el); });
        else show(el);
        setTimeout(next, 140);
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

  /* ── 3D tilt (mouse / trackpad only) ──────────────────────────────────── */
  if (finePointer.matches && !reduceMotion.matches) {
    document.querySelectorAll('.tilt').forEach(function (el) {
      var max = el.classList.contains('qr-card') ? 10 : 6, frame = 0;
      el.addEventListener('pointermove', function (e) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--ry', ((px - 0.5) * max * 2).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - py) * max * 2).toFixed(2) + 'deg');
          el.classList.add('is-tilting');
        });
      });
      el.addEventListener('pointerleave', function () {
        cancelAnimationFrame(frame);
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ── Photo viewer ─────────────────────────────────────────────────────── */
  var lightbox = document.getElementById('lightbox');
  var shots = Array.prototype.slice.call(document.querySelectorAll('.gallery button'));
  if (lightbox && shots.length && typeof lightbox.showModal === 'function') {
    var lbImg = lightbox.querySelector('img'), lbCap = lightbox.querySelector('figcaption'), current = 0;
    var showShot = function (i) {
      current = (i + shots.length) % shots.length;
      var thumb = shots[current].querySelector('img');
      lbImg.src = shots[current].dataset.full;
      lbImg.alt = thumb.alt;
      lbCap.textContent = thumb.alt + ' (' + (current + 1) + ' of ' + shots.length + ')';
    };
    shots.forEach(function (btn, i) {
      btn.setAttribute('aria-label', 'Open photo: ' + btn.querySelector('img').alt);
      btn.addEventListener('click', function () { showShot(i); lightbox.showModal(); });
    });
    lightbox.querySelector('.lb-close').addEventListener('click', function () { lightbox.close(); });
    lightbox.querySelector('.lb-prev').addEventListener('click', function () { showShot(current - 1); });
    lightbox.querySelector('.lb-next').addEventListener('click', function () { showShot(current + 1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox || e.target.tagName === 'FIGURE') lightbox.close(); });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showShot(current - 1);
      if (e.key === 'ArrowRight') showShot(current + 1);
    });
  }

  /* ── Copy email ───────────────────────────────────────────────────────── */
  document.querySelectorAll('.copy-email').forEach(function (btn) {
    var label = btn.querySelector('.copy-label');
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

  /* ── Footer year ──────────────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  runIntro(function () { introDone(); startReveals(); });
})();
