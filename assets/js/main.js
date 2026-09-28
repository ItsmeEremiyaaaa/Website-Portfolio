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

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    });
  }
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
          var el = entry.target;
          el.classList.add('is-visible');
          revealObserver.unobserve(el);
          // Once the entrance finishes, hand transitions back to the element (hover, tilt).
          el.addEventListener('transitionend', function done(e) {
            if (e.target !== el || e.propertyName !== 'opacity' || el.classList.contains('stagger')) return;
            el.removeEventListener('transitionend', done);
            el.classList.remove('reveal', 'is-visible');
          });
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ── Staggered children ───────────────────────────────────────────────
     Sibling cards cascade in, and lists marked .stagger reveal item by item. */
  document.querySelectorAll('.reveal').forEach(function (el) {
    var i = 0, prev = el.previousElementSibling;
    while (prev) { if (prev.classList.contains('reveal')) i++; prev = prev.previousElementSibling; }
    if (i) el.style.setProperty('--rd', Math.min(i, 4) * 80 + 'ms');
  });
  document.querySelectorAll('.stagger').forEach(function (list) {
    Array.prototype.forEach.call(list.children, function (child, i) { child.style.setProperty('--i', i); });
  });

  /* ── 3D tilt with light glare (mouse / trackpad only) ────────────────── */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (finePointer.matches && !reduceMotion.matches) {
    document.querySelectorAll('.tilt').forEach(function (el) {
      var max = el.classList.contains('about-portrait') ? 8 : 5;
      var frame = 0;
      el.addEventListener('pointermove', function (e) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--ry', ((px - 0.5) * max * 2).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - py) * max * 2).toFixed(2) + 'deg');
          el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
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

  /* ── Hero 3D scene (loaded after the page, only where WebGL works) ───── */
  var hero3d = document.querySelector('.hero-3d');
  if (hero3d) {
    // Needs hardware-accelerated WebGL; software renderers (no GPU) would make the page sluggish.
    var supportsWebGL = (function () {
      try {
        var c = document.createElement('canvas');
        var gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return false;
        var info = gl.getExtension('WEBGL_debug_renderer_info');
        var name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
      } catch (e) { return false; }
    })();
    var loadScene = function () {
      import(new URL(hero3d.dataset.src, document.baseURI).href).catch(function () {
        hero3d.parentElement.classList.add('no-webgl');
      });
    };
    if (!supportsWebGL) {
      hero3d.parentElement.classList.add('no-webgl');
    } else if (document.readyState === 'complete') {
      loadScene();
    } else {
      window.addEventListener('load', loadScene, { once: true });
    }
  }

  /* ── Scroll-linked 3D (elements with data-depth) ─────────────────────── */
  var depthEls = document.querySelectorAll('[data-depth]');
  if (depthEls.length && !reduceMotion.matches) {
    var depthTicking = false;
    var updateDepth = function () {
      var vh = window.innerHeight;
      depthEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        // -1 when entering from below, 0 at the viewport centre, 1 when leaving at the top
        var p = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
        el.style.setProperty('--p', Math.max(-1, Math.min(1, p)).toFixed(3));
      });
      depthTicking = false;
    };
    window.addEventListener('scroll', function () {
      if (!depthTicking) { depthTicking = true; requestAnimationFrame(updateDepth); }
    }, { passive: true });
    window.addEventListener('resize', updateDepth);
    updateDepth();
  }

  /* ── Footer year ──────────────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
