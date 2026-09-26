/* Jeremiah Escubido — Portfolio. Small, dependency-free enhancements. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── Theme toggle ─────────────────────────────────────────────────────── */
  var themeBtn = document.querySelector('.theme-toggle');
  var systemLight = window.matchMedia('(prefers-color-scheme: light)');

  function currentTheme() {
    return root.dataset.theme || (systemLight.matches ? 'light' : 'dark');
  }
  function syncThemeUI() {
    var theme = currentTheme();
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach(function (m) { m.setAttribute('content', theme === 'dark' ? '#0a0a0b' : '#fafafa'); });
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeUI();
    });
    systemLight.addEventListener('change', function () { if (!root.dataset.theme) syncThemeUI(); });
    syncThemeUI();
  }

  /* ── Header state & mobile menu ───────────────────────────────────────── */
  var header = document.querySelector('.site-header');
  var menuBtn = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');

  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    header.classList.toggle('menu-open', open);
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ── Active section in nav ────────────────────────────────────────────── */
  var navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
  var sectionIds = ['work', 'about', 'stack', 'journey', 'contact'];
  var sections = sectionIds.map(function (id) { return document.getElementById(id); }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var visible = {};
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      var active = sectionIds.filter(function (id) { return visible[id]; })[0];
      navLinks.forEach(function (a) {
        if (a.getAttribute('href') === '#' + active) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ── Reveal on scroll ─────────────────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ── Project videos ───────────────────────────────────────────────────── */
  // Muted previews play only while on screen, and never auto-play with reduced motion.
  document.querySelectorAll('.js-inview-video').forEach(function (video) {
    var toggle = video.parentElement.querySelector('.media-toggle');
    var userPaused = false;

    function update() {
      var paused = video.paused;
      toggle.classList.toggle('is-paused', paused);
      toggle.setAttribute('aria-label', paused ? 'Play preview' : 'Pause preview');
    }
    video.addEventListener('play', update);
    video.addEventListener('pause', update);
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      if (video.paused) { userPaused = false; video.play().catch(function () {}); }
      else { userPaused = true; video.pause(); }
    });
    update();

    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !userPaused) video.play().catch(function () {});
        else if (!entry.isIntersecting) video.pause();
      });
    }, { threshold: 0.4 }).observe(video);
  });

  // Click-to-play videos with sound get native controls once started.
  document.querySelectorAll('.js-click-video').forEach(function (video) {
    var wrap = video.parentElement;
    var play = wrap.querySelector('.media-play');
    play.addEventListener('click', function () {
      video.controls = true;
      wrap.classList.add('is-playing');
      video.play().catch(function () {});
      video.focus();
    });
  });

  /* ── Copy email ───────────────────────────────────────────────────────── */
  var copyBtn = document.querySelector('.copy-email');
  if (copyBtn && navigator.clipboard) {
    var label = copyBtn.querySelector('.copy-label');
    var timer;
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(copyBtn.dataset.email).then(function () {
        copyBtn.classList.add('is-copied');
        label.textContent = 'Copied';
        clearTimeout(timer);
        timer = setTimeout(function () {
          copyBtn.classList.remove('is-copied');
          label.textContent = 'Copy address';
        }, 2000);
      });
    });
  } else if (copyBtn) {
    copyBtn.hidden = true;
  }

  /* ── Gallery lightbox ─────────────────────────────────────────────────── */
  var lightbox = document.getElementById('lightbox');
  var items = Array.prototype.slice.call(document.querySelectorAll('.gallery button'));
  if (lightbox && items.length && typeof lightbox.showModal === 'function') {
    var lbImg = lightbox.querySelector('img');
    var lbCaption = lightbox.querySelector('figcaption');
    var index = 0;
    var opener = null;

    function show(i) {
      index = (i + items.length) % items.length;
      var thumb = items[index].querySelector('img');
      lbImg.src = items[index].dataset.full;
      lbImg.alt = thumb.alt;
      lbCaption.textContent = thumb.alt + ' · ' + (index + 1) + ' / ' + items.length;
    }

    items.forEach(function (btn, i) {
      btn.setAttribute('aria-label', 'Open photo: ' + btn.querySelector('img').alt);
      btn.addEventListener('click', function () {
        opener = btn;
        show(i);
        lightbox.showModal();
      });
    });

    lightbox.querySelector('.lb-close').addEventListener('click', function () { lightbox.close(); });
    lightbox.querySelector('.lb-prev').addEventListener('click', function () { show(index - 1); });
    lightbox.querySelector('.lb-next').addEventListener('click', function () { show(index + 1); });
    lightbox.addEventListener('click', function (e) {
      // Click on the dimmed area (not the photo or controls) closes it.
      if (e.target === lightbox || e.target.tagName === 'FIGURE') lightbox.close();
    });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });
    lightbox.addEventListener('close', function () {
      lbImg.removeAttribute('src');
      if (opener) opener.focus();
    });
  }

  /* ── Footer year ──────────────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
