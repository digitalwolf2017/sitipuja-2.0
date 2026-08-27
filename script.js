/* ==========================================================================
   SITI PUJA PASS 2026 — interactions
   Vanilla JS, no dependencies. Everything degrades gracefully.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- CONFIG · edit these three, nothing else ---------------------- */
  const CONFIG = {
    price: 999,                       // current price per pass (₹)
    mrp: 1499,                        // struck-through price per pass (₹)
    maxPasses: 10,
    whatsapp: '919903946565',         // country code + number, digits only
    // Countdown target. Verify the Puja date with the client before launch.
    pujaStart: '2026-10-17T00:00:00+05:30',
    // Optional: POST leads to your CRM/sheet endpoint. Leave '' to skip.
    formEndpoint: ''
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rupee = n => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Ad-platform conversion tracking (safe no-ops if absent) ------ */
  function track(eventName, params) {
    const data = params || {};
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, data));
      if (typeof window.gtag === 'function') window.gtag('event', eventName, data);
      if (typeof window.fbq === 'function') {
        if (eventName === 'generate_lead') window.fbq('track', 'Lead', data);
        else window.fbq('trackCustom', eventName, data);
      }
    } catch (err) { /* tracking must never break the page */ }
  }

  /* ======================================================================
     1 · Header — height var, scroll state, mobile menu, scroll-spy
     ====================================================================== */
  const header = $('#siteHeader');
  const nav = $('#siteNav');
  const announceBar = $('#announceBar');
  const navToggle = $('#navToggle');
  const mobileMenu = $('#mobileMenu');

  function setHeaderVar() {
    if (!header) return;
    // scrollHeight keeps the full value even while the bar is collapsed
    const h = (announceBar ? announceBar.scrollHeight : 0) + (nav ? nav.offsetHeight : 0);
    document.documentElement.style.setProperty('--header-h', Math.round(h) + 'px');
  }

  function currentHeaderOffset() {
    return (nav ? nav.getBoundingClientRect().height : 0) +
      (document.body.classList.contains('is-scrolled') ? 12 : (announceBar ? announceBar.scrollHeight : 0) + 12);
  }

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.hidden = false;
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close menu');
  }
  function closeMenu() {
    if (!mobileMenu || mobileMenu.hidden) return;
    mobileMenu.hidden = true;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  }

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      mobileMenu.hidden ? openMenu() : closeMenu();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMenu(); navToggle && navToggle.focus(); }
  });
  document.addEventListener('click', e => {
    if (mobileMenu && !mobileMenu.hidden && !e.target.closest('#siteNav')) closeMenu();
  });

  /* Scroll state: collapse announcement bar, glass-blur the navbar */
  let ticking = false;
  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    document.body.classList.toggle('is-scrolled', y > 40);
    toggleMobileCta(y);
    spyNav(y);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* Scroll-spy for the desktop nav */
  const spyLinks = $$('.nav-link');
  const spyTargets = spyLinks
    .map(link => ({ link, el: document.querySelector(link.getAttribute('href')) }))
    .filter(item => item.el);

  function spyNav(y) {
    if (!spyTargets.length) return;
    const line = y + currentHeaderOffset() + 40;
    let active = spyTargets[0];
    spyTargets.forEach(item => { if (item.el.offsetTop <= line) active = item; });
    spyLinks.forEach(l => l.classList.remove('is-active'));
    active.link.classList.add('is-active');
  }

  /* ======================================================================
     2 · Smooth scrolling with a header-aware offset
     ====================================================================== */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-scroll]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || hash.charAt(0) !== '#') return;
    const target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    closeMenu();
    if (link.dataset.cta) track('cta_click', { cta_id: link.dataset.cta, destination: hash });

    const top = target.getBoundingClientRect().top + window.scrollY - currentHeaderOffset();
    window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? 'auto' : 'smooth' });

    // Land the cursor in the form on desktop — one less click to convert.
    if (hash === '#book' && window.matchMedia('(min-width: 1024px)').matches) {
      window.setTimeout(() => {
        const firstField = $('#bookName');
        if (firstField) firstField.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 700);
    }
  });

  /* Track outbound WhatsApp / tel clicks too */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-cta]:not([data-scroll])');
    if (link) track('cta_click', { cta_id: link.dataset.cta, destination: link.getAttribute('href') });
  });

  /* ======================================================================
     3 · Scroll reveal (Intersection Observer)
     ====================================================================== */
  const revealEls = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = parseInt(entry.target.dataset.revealDelay || '0', 10);
        window.setTimeout(() => entry.target.classList.add('is-visible'), delay);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => revealObserver.observe(el));
  }

  /* ======================================================================
     4 · Animated counters
     ====================================================================== */
  function runCounter(el) {
    const end = parseFloat(el.dataset.counter);
    if (isNaN(end)) return;
    const useGrouping = el.dataset.counterFormat === 'in';
    const format = v => useGrouping
      ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v)
      : String(v);

    if (reduceMotion) { el.textContent = format(end); return; }

    const duration = 1500;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(end * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const counters = $$('[data-counter]');
  if (!('IntersectionObserver' in window)) {
    counters.forEach(runCounter);
  } else {
    const counterObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => counterObserver.observe(el));
  }

  /* ======================================================================
     5 · Booking forms — stepper, live pricing, validation, submit
     ====================================================================== */
  function initBookingForm(form) {
    const nameInput = form.querySelector('input[name="name"]');
    const mobileInput = form.querySelector('input[name="mobile"]');
    const passInput = form.querySelector('input[name="passes"]');
    const successPanel = form.querySelector('[data-success]');
    const submitBtn = form.querySelector('button[type="submit"]');

    /* --- live price ------------------------------------------------------ */
    function quantity() {
      let q = parseInt(passInput.value, 10);
      if (isNaN(q) || q < 1) q = 1;
      if (q > CONFIG.maxPasses) q = CONFIG.maxPasses;
      return q;
    }

    function updatePrice() {
      const q = quantity();
      const total = q * CONFIG.price;
      const saved = q * (CONFIG.mrp - CONFIG.price);

      $$('[data-total-text]', form).forEach(el => { el.textContent = rupee(total); });

      const qty = form.querySelector('[data-summary-qty]');
      if (qty) qty.textContent = q + ' × ' + rupee(CONFIG.price);

      const save = form.querySelector('[data-summary-save]');
      if (save) save.textContent = rupee(saved);

      const line = form.querySelector('[data-total-line] span');
      if (line) line.textContent = '· ' + q + (q > 1 ? ' passes · admits ' : ' pass · admits ') + (q * 4);
    }

    passInput.addEventListener('input', () => {
      passInput.value = String(quantity());
      updatePrice();
    });
    passInput.addEventListener('blur', () => { passInput.value = String(quantity()); updatePrice(); });

    $$('[data-step]', form).forEach(btn => {
      btn.addEventListener('click', () => {
        const next = quantity() + parseInt(btn.dataset.step, 10);
        passInput.value = String(Math.min(Math.max(next, 1), CONFIG.maxPasses));
        updatePrice();
        track('quantity_change', { quantity: quantity() });
      });
    });

    /* --- validation ------------------------------------------------------ */
    function showError(input, message) {
      const errEl = document.getElementById(input.getAttribute('aria-describedby'));
      input.setAttribute('aria-invalid', 'true');
      if (errEl) { errEl.textContent = message; errEl.hidden = false; }
    }
    function clearError(input) {
      const errEl = document.getElementById(input.getAttribute('aria-describedby'));
      input.removeAttribute('aria-invalid');
      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    }

    function validName() {
      const value = nameInput.value.trim();
      if (value.length < 2) { showError(nameInput, 'Please enter your full name.'); return false; }
      clearError(nameInput);
      return true;
    }
    function validMobile() {
      const value = mobileInput.value.trim();
      if (!/^[6-9]\d{9}$/.test(value)) {
        showError(mobileInput, 'Enter a valid 10-digit Indian mobile number.');
        return false;
      }
      clearError(mobileInput);
      return true;
    }

    // Digits only, and clear the error as soon as it is fixed
    mobileInput.addEventListener('input', () => {
      const cleaned = mobileInput.value.replace(/\D/g, '').slice(0, 10);
      if (cleaned !== mobileInput.value) mobileInput.value = cleaned;
      if (mobileInput.getAttribute('aria-invalid') && /^[6-9]\d{9}$/.test(cleaned)) clearError(mobileInput);
    });
    nameInput.addEventListener('input', () => {
      if (nameInput.getAttribute('aria-invalid') && nameInput.value.trim().length >= 2) clearError(nameInput);
    });
    nameInput.addEventListener('blur', () => { if (nameInput.value.trim()) validName(); });
    mobileInput.addEventListener('blur', () => { if (mobileInput.value.trim()) validMobile(); });

    /* --- submit ---------------------------------------------------------- */
    function whatsappLink(lead) {
      const message =
        'Hi SITI Maha Puja, I want to book the SITI Puja Pass 2026.\n' +
        'Name: ' + lead.name + '\n' +
        'Mobile: +91 ' + lead.mobile + '\n' +
        'Passes: ' + lead.passes + ' (Total ' + rupee(lead.total) + ')';
      return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(message);
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const okName = validName();
      const okMobile = validMobile();

      if (!okName || !okMobile) {
        const firstBad = !okName ? nameInput : mobileInput;
        firstBad.focus();
        track('form_error', { form: form.dataset.bookingForm, field: firstBad.name });
        return;
      }

      const lead = {
        name: nameInput.value.trim(),
        mobile: mobileInput.value.trim(),
        passes: quantity(),
        total: quantity() * CONFIG.price,
        source: form.dataset.bookingForm,
        page: location.pathname + location.search
      };

      submitBtn.disabled = true;
      submitBtn.style.opacity = '.75';

      if (CONFIG.formEndpoint) {
        fetch(CONFIG.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead)
        }).catch(() => { /* the WhatsApp hand-off below is the fallback */ });
      }

      track('generate_lead', {
        currency: 'INR',
        value: lead.total,
        quantity: lead.passes,
        form: lead.source
      });

      const waHref = whatsappLink(lead);
      const waBtn = form.querySelector('[data-success-wa]');
      if (waBtn) waBtn.setAttribute('href', waHref);

      const msg = form.querySelector('[data-success-text]');
      if (msg) {
        msg.textContent = 'Thanks ' + lead.name.split(' ')[0] + '! We have your request for ' +
          lead.passes + (lead.passes > 1 ? ' passes' : ' pass') + ' (' + rupee(lead.total) +
          '). Our team will call you on ' + lead.mobile + ' shortly.';
      }

      // Swap the form for the confirmation panel
      if (successPanel) {
        Array.from(form.children).forEach(child => {
          if (child !== successPanel) child.style.display = 'none';
        });
        successPanel.hidden = false;
        successPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        const waBtnFocus = successPanel.querySelector('a');
        if (waBtnFocus) waBtnFocus.focus({ preventScroll: true });
      }
    });

    updatePrice();
  }

  $$('[data-booking-form]').forEach(initBookingForm);

  /* ======================================================================
     6 · Floating petals in the hero
     ====================================================================== */
  function buildPetals() {
    const field = $('#petalField');
    if (!field || reduceMotion) return;
    const count = window.innerWidth < 768 ? 9 : 16;
    const variants = ['', 'petal--pink', 'petal--gold', 'petal--shiuli'];
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const petal = document.createElement('span');
      const size = 8 + Math.random() * 10;
      petal.className = 'petal ' + variants[i % variants.length];
      petal.style.left = (Math.random() * 100).toFixed(2) + '%';
      petal.style.width = size.toFixed(1) + 'px';
      petal.style.height = (size * 0.72).toFixed(1) + 'px';
      petal.style.animationDuration = (11 + Math.random() * 11).toFixed(1) + 's';
      petal.style.animationDelay = (-Math.random() * 18).toFixed(1) + 's';
      frag.appendChild(petal);
    }
    field.appendChild(frag);
  }

  /* ======================================================================
     7 · Countdown to Puja
     ====================================================================== */
  function initCountdown() {
    const box = $('[data-countdown]');
    if (!box) return;
    const label = $('.countdown__label');
    const target = new Date(CONFIG.pujaStart).getTime();
    if (isNaN(target)) { box.style.display = 'none'; return; }

    const parts = {
      days: box.querySelector('[data-cd="days"]'),
      hours: box.querySelector('[data-cd="hours"]'),
      minutes: box.querySelector('[data-cd="minutes"]'),
      seconds: box.querySelector('[data-cd="seconds"]')
    };
    const pad = n => String(n).padStart(2, '0');

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        box.style.display = 'none';
        if (label) label.textContent = 'The Puja has begun — passes while stocks last';
        window.clearInterval(timer);
        return;
      }
      const s = Math.floor(diff / 1000);
      parts.days.textContent = pad(Math.floor(s / 86400));
      parts.hours.textContent = pad(Math.floor(s % 86400 / 3600));
      parts.minutes.textContent = pad(Math.floor(s % 3600 / 60));
      parts.seconds.textContent = pad(s % 60);
    }
    tick();
    const timer = window.setInterval(tick, 1000);
  }

  /* ======================================================================
     8 · Mobile sticky CTA — show after the hero, hide over the form
     ====================================================================== */
  const mobileCta = $('#mobileCta');
  const ctaButtons = $$('[data-booking-form] button[type="submit"]');
  let ctaOnScreen = false;

  // Hide the sticky bar only while a real Book button is on screen — otherwise
  // a phone that is too short to show the hero CTA would have no CTA at all.
  if (mobileCta && 'IntersectionObserver' in window && ctaButtons.length) {
    const seen = new WeakMap();
    const ctaObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => seen.set(entry.target, entry.isIntersecting));
      ctaOnScreen = ctaButtons.some(btn => seen.get(btn));
      toggleMobileCta(window.scrollY);
    }, { threshold: 0.9 });
    ctaButtons.forEach(btn => ctaObserver.observe(btn));
  }

  function toggleMobileCta(y) {
    if (!mobileCta) return;
    const onPhone = window.matchMedia('(max-width: 1023px)').matches;
    mobileCta.classList.toggle('is-visible', !ctaOnScreen && (onPhone || y > 420));
  }

  /* ======================================================================
     9 · Boot
     ====================================================================== */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setHeaderVar();
  buildPetals();
  initCountdown();
  onScroll();

  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(setHeaderVar, 150);
  });
  window.addEventListener('load', setHeaderVar);
})();
