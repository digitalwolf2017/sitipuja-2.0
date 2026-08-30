/* ==========================================================================
   SITI PUJA PASS 2026 — interactions
   Vanilla JS, no dependencies. Everything degrades gracefully.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- CONFIG · edit these three, nothing else ---------------------- */
  const CONFIG = {
    price: 1499,                      // per pass (₹), inclusive of all taxes
    gstRate: 0.18,                    // GST already sits inside `price`, not on top
    courierFee: 99,                   // flat, once per order — not per pass
    maxPasses: 10,
    whatsapp: '919903946565',         // country code + number, digits only
    // Countdown target. Verify the Puja date with the client before launch.
    pujaStart: '2026-10-17T00:00:00+05:30',
    // Optional: POST leads to your CRM/sheet endpoint. Leave '' to skip.
    formEndpoint: '',

    /* ---- Razorpay -------------------------------------------------------
       Payments need a server: the browser must never create an order or
       decide that one succeeded. Fill all three and checkout goes live;
       leave keyId or orderEndpoint empty and the form falls back to the
       lead-capture + WhatsApp hand-off instead of pretending to charge.

         orderEndpoint  POST {amount, currency, lead} -> {id, amount, currency}
                        (your server calls Razorpay Orders API with the secret)
         verifyEndpoint POST {razorpay_order_id, razorpay_payment_id,
                              razorpay_signature, lead} -> {ok:true}
                        (your server verifies the HMAC signature)
    --------------------------------------------------------------------- */
    payment: {
      keyId: '',                      // 'rzp_live_…' or 'rzp_test_…'
      orderEndpoint: '',
      verifyEndpoint: '',
      companyName: 'SITI Maha Puja',
      description: 'SITI Puja Pass 2026'
    },

    /* ---- Collection & delivery windows -----------------------------------
       Shown on the thank-you page. Plain strings so the client can edit the
       dates without touching any date maths.
    --------------------------------------------------------------------- */
    collection: {
      dates: '6th October to 10th October 2026',
      time: '11 AM to 7 PM',
      courierFrom: '5th October'
    },

    // Where a completed booking lands. Set to '' to keep the old behaviour
    // of showing the success panel inline in the form instead.
    thankYouPage: 'thank-you.html',

    /* ---- Background music -----------------------------------------------
       Drop the track in the repo and point `src` at it. Browsers block
       autoplay with sound, so the dock always starts paused on a first
       visit — `startPaused: false` only means "resume for a visitor who
       already pressed play", and even that waits for their first click.
       Set src to '' to remove the player entirely.
    --------------------------------------------------------------------- */
    music: {
      src: 'assets/audio/music.mp3',
      volume: 0.4,                    // 0–1, the dial's starting position
      startPaused: true               // true = never resume on its own
    },

    /* ---- Auto booking popup ---------------------------------------------
       Opens once per browser session, on whichever of these happens first.
       It never interrupts someone who already has a booking form on screen,
       and never reappears once it has been closed or a form was submitted.
       Set enabled:false to switch the popup off entirely.
    --------------------------------------------------------------------- */
    popup: {
      enabled: true,
      delay: 18000,        // ms after page load (0 disables the timer)
      scrollPercent: 40,   // …or once this much of the page has been read
      exitIntent: true     // …or when the cursor leaves the top of the window
    }
  };

  /* ---- Self-pickup counters ----------------------------------------------
     The six authorised collection points, taken verbatim from the client's
     booking page sitimahapuja.in/durga-puja-vip-pass-booking (archived
     2026-03-16). This array is the only place they are defined — both the
     booking dropdown and the pickup-centre boxes are built from it.
     `name` is the locality that goes into the WhatsApp lead, `venue` and
     `area` are the address lines on the card, `phone` is the counter's own
     number. The source page states no counter opening hours; PICKUP_HOURS
     below is the booking helpline time and needs confirming per counter.
     ---------------------------------------------------------------------- */
  const PICKUP_HOURS = '10 AM \u2013 7 PM';
  const PICKUP_LOCATIONS = [
    {
      name: 'Park Circus',
      venue: 'Hitech Visual Channel Pvt Ltd',
      area: '201 New Park Street, 5th Floor, Suite #5H, Radiant Park Apartment, opp. Topsia Police Station, Kolkata 700017',
      phone: ['8100610340']
    },
    {
      name: 'Hazra Road',
      venue: 'Cine Cable & Broadband Services',
      area: '35B Hazra Road, beside Hotel Swagath, near Lansdowne & Hazra crossing, Kolkata 700029',
      phone: ['8902596081']
    },
    {
      name: 'Garia',
      venue: 'Smart Vinimay Pvt Ltd',
      area: 'Srijita-VIII, Gostalata New Scheme, P.O. Garia, near Bandhu Mohal Club & Solar Factory, Kolkata 700084',
      phone: ['8910380912']
    },
    {
      name: 'Howrah',
      venue: 'Smart Vinimay Pvt Ltd',
      area: '493/C/A G.T. Road (S), Flat G-2, Vivek Vihar Phase III, opp. Tanishq Showroom, Howrah 711101',
      phone: ['6292191023']
    },
    {
      name: 'Dum Dum Airport',
      venue: 'Galaxy Cable & Broadband Service',
      area: '2 No. Airport Gate, Motilal Colony, P.O. Rajbari, near Hotel Airways, Kolkata 700081',
      phone: ['9748287950', '8697937395']
    },
    {
      name: 'Salt Lake',
      venue: 'Kolkata Entertainment LLP',
      area: 'FD-296, FD Block, Sector-III, near 11 No. Tank, Salt Lake, Kolkata 700106',
      phone: ['8777785849']
    }
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rupee = n => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
  // the GST line is the only place paise matter
  const rupee2 = n => '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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
        const firstField = $('#heroName');
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
     2b · Self-pickup centre boxes
     Rendered before the reveal observer below picks up [data-reveal], so the
     cards animate in like the rest of the page.
     ====================================================================== */
  (function renderPickupCentres() {
    const grid = $('[data-pickup-grid]');
    if (!grid) return;

    const clock = '<svg class="pickup-card__clock" viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
      'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>';

    const phoneIcon = '<svg class="pickup-card__clock" viewBox="0 0 24 24" width="14" height="14" ' +
      'fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 ' +
      '1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 ' +
      '1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" /></svg>';

    grid.innerHTML = PICKUP_LOCATIONS.map((loc, i) => {
      const no = String(i + 1).padStart(2, '0');
      // stagger the reveal a row at a time so a 3-wide row lights up together
      const delay = (i % 3) * 70;
      // each counter's own number, dialable straight from the card
      const phones = (loc.phone || []).map(p =>
        '<a href="tel:+91' + p + '">' + p.replace(/(\d{5})(\d{5})/, '$1 $2') + '</a>').join(', ');
      return '<li class="pickup-card" data-reveal data-reveal-delay="' + delay + '">' +
        '<span class="pickup-card__no" aria-hidden="true">' + no + '</span>' +
        '<h3 class="pickup-card__name">' + loc.name + '</h3>' +
        (loc.venue ? '<p class="pickup-card__venue">' + loc.venue + '</p>' : '') +
        (loc.area ? '<p class="pickup-card__area">' + loc.area + '</p>' : '') +
        (phones ? '<p class="pickup-card__hours">' + phoneIcon + phones + '</p>' : '') +
        '<p class="pickup-card__hours">' + clock + PICKUP_HOURS + '</p>' +
        '</li>';
    }).join('');
  })();

  /* ======================================================================
     2c · Auto booking popup
     The modal holds a clone of the hero form rather than a third
     hand-written copy, so the booking markup stays in one place. The clone
     is in the DOM before the form initialiser at the end of section 6
     runs, so it gets wired up like any other booking form.
     ====================================================================== */
  const POPUP_SEEN_KEY = 'sitipuja.popup.seen';

  function popupSeen() {
    try { return sessionStorage.getItem(POPUP_SEEN_KEY) === '1'; } catch (err) { return false; }
  }
  function markPopupSeen() {
    try { sessionStorage.setItem(POPUP_SEEN_KEY, '1'); } catch (err) { /* private mode */ }
  }

  (function initBookingPopup() {
    const popup = $('#bookingPopup');
    if (!popup) return;

    const slot = $('[data-popup-form]', popup);
    const dialog = $('.popup__dialog', popup);
    const source = $('[data-booking-form="hero"]');
    if (!slot || !dialog || !source) { popup.remove(); return; }

    /* --- clone the hero form, then re-key every id it owns -------------- */
    const clone = source.cloneNode(true);
    clone.dataset.bookingForm = 'popup';

    const idMap = {};
    $$('[id]', clone).forEach(el => {
      idMap[el.id] = 'popup-' + el.id;
      el.id = idMap[el.id];
    });
    ['for', 'aria-describedby', 'aria-labelledby', 'aria-controls'].forEach(attr => {
      $$('[' + attr + ']', clone).forEach(el => {
        el.setAttribute(attr, el.getAttribute(attr).split(/\s+/).map(v => idMap[v] || v).join(' '));
      });
    });
    // a hidden dialog never intersects the viewport, so a reveal hook here
    // would leave the clone permanently faded out
    $$('[data-reveal]', clone).forEach(el => {
      el.removeAttribute('data-reveal');
      el.removeAttribute('data-reveal-delay');
    });
    const cloneSubmit = clone.querySelector('button[type="submit"]');
    if (cloneSubmit) cloneSubmit.dataset.cta = 'popup-form';

    slot.appendChild(clone);

    /* --- open / close --------------------------------------------------- */
    let lastFocus = null;
    let timer = null;

    // never interrupt someone who is already looking at a booking form
    function bookingFormOnScreen() {
      return $$('[data-booking-form], [data-enquiry-form]').some(form => {
        if (form === clone) return false;
        const r = form.getBoundingClientRect();
        return r.bottom > 80 && r.top < window.innerHeight - 80;
      });
    }

    function openPopup(trigger) {
      if (!popup.hidden || popupSeen() || bookingFormOnScreen()) return false;
      lastFocus = document.activeElement;
      popup.hidden = false;
      document.body.classList.add('has-popup');
      // one frame between "in the DOM" and "open" so the entry animation runs
      window.requestAnimationFrame(() => popup.classList.add('is-open'));
      dialog.focus({ preventScroll: true });
      markPopupSeen();
      disarm();
      track('popup_open', { trigger: trigger });
      return true;
    }

    function closePopup() {
      if (popup.hidden) return;
      popup.classList.remove('is-open');
      document.body.classList.remove('has-popup');
      if (reduceMotion) popup.hidden = true;
      else window.setTimeout(() => { popup.hidden = true; }, 220);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    popup.addEventListener('click', e => {
      if (e.target.closest('[data-popup-close]')) closePopup();
    });

    // handled on the popup itself so Escape does not also reach the
    // document listener that pulls focus back to the menu button
    popup.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePopup();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = $$('a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled])', dialog).filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // a booking already sent is reason enough never to nag again
    document.addEventListener('submit', e => {
      if (e.target.matches('[data-booking-form], [data-enquiry-form]')) markPopupSeen();
    }, true);

    /* --- triggers ------------------------------------------------------- */
    function onScrollTrigger() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      if ((window.scrollY / max) * 100 >= CONFIG.popup.scrollPercent) openPopup('scroll');
    }
    function onExitIntent(e) {
      if (e.clientY <= 0 && !e.relatedTarget) openPopup('exit_intent');
    }
    function disarm() {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScrollTrigger);
      document.removeEventListener('mouseout', onExitIntent);
    }
    // if the timer fires while a form is on screen, wait and try again
    function armTimer(ms) {
      timer = window.setTimeout(() => { if (!openPopup('timer')) armTimer(6000); }, ms);
    }

    if (!CONFIG.popup.enabled || popupSeen()) return;
    if (CONFIG.popup.delay > 0) armTimer(CONFIG.popup.delay);
    if (CONFIG.popup.scrollPercent > 0) window.addEventListener('scroll', onScrollTrigger, { passive: true });
    // exit intent is a cursor gesture — a touch screen has no cursor to lose
    if (CONFIG.popup.exitIntent && window.matchMedia('(min-width: 1024px)').matches) {
      document.addEventListener('mouseout', onExitIntent);
    }
  })();

  /* ======================================================================
     2d · FAQ accordion
     <details> already opens and closes by itself — this only keeps one
     answer open at a time and reports opens to the ad platforms.
     ====================================================================== */
  (function initFaq() {
    const list = $('[data-faq]');
    if (!list) return;
    const items = $$('.faq-item', list);

    items.forEach(item => {
      // closing the others fires their own toggle, which returns immediately
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach(other => { if (other !== item) other.open = false; });
        const label = item.querySelector('summary span');
        track('faq_open', { question: label ? label.textContent.trim() : '' });
      });
    });
  })();

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
  /* ---------- Shared form helpers ----------------------------------------
     Used by both the booking form and the enquiry form. They take the field
     as an argument and hold no state, so there is one copy, not two.
     ---------------------------------------------------------------------- */
  function errorEl(input, fallbackId) {
    const id = (input && input.getAttribute('aria-describedby')) || fallbackId;
    return id ? document.getElementById(id) : null;
  }
  function showError(input, message, fallbackId) {
    const el = errorEl(input, fallbackId);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (el) { el.textContent = message; el.hidden = false; }
  }
  function clearError(input, fallbackId) {
    const el = errorEl(input, fallbackId);
    if (input) input.removeAttribute('aria-invalid');
    if (el) { el.hidden = true; el.textContent = ''; }
  }
  function postLead(lead) {
    if (!CONFIG.formEndpoint) return;
    fetch(CONFIG.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    }).catch(() => { /* the WhatsApp hand-off is the fallback */ });
  }

  function initBookingForm(form) {
    const field = n => form.querySelector('[name="' + n + '"]');
    const nameInput = field('name');
    const emailInput = field('email');
    const mobileInput = field('mobile');
    const passInput = field('passes');
    const addressInput = field('address');
    const cityInput = field('city');
    const pincodeInput = field('pincode');
    const pickupSelect = field('pickup');
    const deliveryRadios = $$('[name="delivery"]', form);
    const deliveryFieldset = form.querySelector('.delivery');
    // read the error slot off the fieldset rather than hardcoding the hero's id
    const deliveryErrId = deliveryFieldset ? deliveryFieldset.getAttribute('aria-describedby') : null;
    const successPanel = form.querySelector('[data-success]');
    const submitBtn = form.querySelector('button[type="submit"]');

    /* --- self-pickup counters come from the one array in CONFIG ---------- */
    if (pickupSelect && pickupSelect.hasAttribute('data-pickup-select')) {
      PICKUP_LOCATIONS.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.name;
        opt.textContent = loc.venue ? loc.name + ' — ' + loc.venue : loc.name;
        pickupSelect.appendChild(opt);
      });
    }

    /* --- live price ------------------------------------------------------ */
    function quantity() {
      let q = parseInt(passInput.value, 10);
      if (isNaN(q) || q < 1) q = 1;
      if (q > CONFIG.maxPasses) q = CONFIG.maxPasses;
      return q;
    }

    function deliveryMode() {
      const picked = deliveryRadios.find(r => r.checked);
      return picked ? picked.value : '';
    }

    // the courier charge is flat per order, never multiplied by pass count
    function courierFee() {
      return deliveryMode() === 'courier' ? CONFIG.courierFee : 0;
    }

    function orderTotal() {
      return quantity() * CONFIG.price + courierFee();
    }

    function updatePrice() {
      const q = quantity();
      const total = orderTotal();
      // the pass price is tax-inclusive, so this is the GST already inside the
      // pass subtotal — never an extra charge added to the total
      const gstInPasses = q * CONFIG.price * (CONFIG.gstRate / (1 + CONFIG.gstRate));

      $$('[data-total-text]', form).forEach(el => { el.textContent = rupee(total); });

      const passLine = form.querySelector('[data-summary-passline]');
      if (passLine) passLine.textContent = q + (q > 1 ? ' passes × ' : ' pass × ') + rupee(CONFIG.price);

      const passAmt = form.querySelector('[data-summary-passes]');
      if (passAmt) passAmt.textContent = rupee(q * CONFIG.price);

      const courierRow = form.querySelector('[data-summary-courier]');
      if (courierRow) courierRow.hidden = courierFee() === 0;

      const gst = form.querySelector('[data-summary-gst]');
      if (gst) gst.textContent = rupee2(gstInPasses);
    }

    passInput.addEventListener('change', updatePrice);
    // the stepper form uses a number input; the hero form uses a <select>
    if (passInput.tagName !== 'SELECT') {
      passInput.addEventListener('input', () => {
        passInput.value = String(quantity());
        updatePrice();
      });
      passInput.addEventListener('blur', () => { passInput.value = String(quantity()); updatePrice(); });
    }

    $$('[data-step]', form).forEach(btn => {
      btn.addEventListener('click', () => {
        const next = quantity() + parseInt(btn.dataset.step, 10);
        passInput.value = String(Math.min(Math.max(next, 1), CONFIG.maxPasses));
        updatePrice();
        track('quantity_change', { quantity: quantity() });
      });
    });

    /* --- courier / pickup panels ---------------------------------------- */
    const panels = $$('[data-delivery-panel]', form);

    function syncDeliveryPanels() {
      const mode = deliveryMode();
      panels.forEach(panel => {
        const active = panel.dataset.deliveryPanel === mode;
        panel.hidden = !active;
        // a hidden panel must not block submit or trap the keyboard
        $$('input, select, textarea', panel).forEach(el => { el.disabled = !active; });
      });
      $$('.delivery-opt', form).forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]');
        opt.classList.toggle('is-selected', !!radio && radio.checked);
      });
      if (mode) clearError(deliveryRadios[0], deliveryErrId);
      updatePrice();
    }

    deliveryRadios.forEach(radio => radio.addEventListener('change', () => {
      syncDeliveryPanels();
      track('delivery_change', { mode: deliveryMode() });
    }));

    /* --- validation ------------------------------------------------------ */

    // each check returns the offending element, or null when the field is fine
    function checkName() {
      if (nameInput.value.trim().length < 2) {
        showError(nameInput, 'Please enter your full name.');
        return nameInput;
      }
      clearError(nameInput);
      return null;
    }
    function checkEmail() {
      if (!emailInput) return null;
      const value = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        showError(emailInput, 'Enter a valid email address.');
        return emailInput;
      }
      clearError(emailInput);
      return null;
    }
    function checkMobile() {
      if (!/^[6-9]\d{9}$/.test(mobileInput.value.trim())) {
        showError(mobileInput, 'Enter a valid 10-digit Indian mobile number.');
        return mobileInput;
      }
      clearError(mobileInput);
      return null;
    }
    function checkDelivery() {
      if (!deliveryRadios.length) return null;
      if (!deliveryMode()) {
        showError(null, 'Choose courier or self pickup.', deliveryErrId);
        return deliveryRadios[0];
      }
      clearError(null, deliveryErrId);
      return null;
    }
    function checkCourierDetails() {
      if (deliveryMode() !== 'courier') return null;
      let first = null;
      if (addressInput.value.trim().length < 8) {
        showError(addressInput, 'Enter the full delivery address.');
        first = first || addressInput;
      } else clearError(addressInput);

      if (cityInput.value.trim().length < 2) {
        showError(cityInput, 'Enter your city.');
        first = first || cityInput;
      } else clearError(cityInput);

      if (!/^[1-9]\d{5}$/.test(pincodeInput.value.trim())) {
        showError(pincodeInput, 'Enter a valid 6-digit pincode.');
        first = first || pincodeInput;
      } else clearError(pincodeInput);

      return first;
    }
    function checkPickup() {
      if (deliveryMode() !== 'pickup') return null;
      if (!pickupSelect.value) {
        showError(pickupSelect, 'Choose a pickup location.');
        return pickupSelect;
      }
      clearError(pickupSelect);
      return null;
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
    nameInput.addEventListener('blur', () => { if (nameInput.value.trim()) checkName(); });
    mobileInput.addEventListener('blur', () => { if (mobileInput.value.trim()) checkMobile(); });
    if (emailInput) emailInput.addEventListener('blur', () => { if (emailInput.value.trim()) checkEmail(); });
    if (pincodeInput) {
      pincodeInput.addEventListener('input', () => {
        const cleaned = pincodeInput.value.replace(/\D/g, '').slice(0, 6);
        if (cleaned !== pincodeInput.value) pincodeInput.value = cleaned;
        if (pincodeInput.getAttribute('aria-invalid') && /^[1-9]\d{5}$/.test(cleaned)) clearError(pincodeInput);
      });
    }
    if (pickupSelect) pickupSelect.addEventListener('change', () => clearError(pickupSelect));

    /* --- submit ---------------------------------------------------------- */
    function whatsappLink(lead) {
      let message =
        'Hi SITI Maha Puja, I want to book the SITI Puja Pass 2026.\n' +
        'Name: ' + lead.name + '\n' +
        (lead.email ? 'Email: ' + lead.email + '\n' : '') +
        'Mobile: +91 ' + lead.mobile + '\n' +
        'Passes: ' + lead.passes + '\n';
      if (lead.delivery === 'courier') {
        message += 'Delivery: Courier (+' + rupee(CONFIG.courierFee) + ')\n' +
          'Address: ' + lead.address + ', ' + lead.city + ' - ' + lead.pincode +
          (lead.landmark ? ' (' + lead.landmark + ')' : '') + '\n';
      } else if (lead.delivery === 'pickup') {
        message += 'Delivery: Self pickup — ' + lead.pickup + '\n';
      }
      message += 'Total: ' + rupee(lead.total);
      return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(message);
    }

    function collectLead() {
      const mode = deliveryMode();
      const lead = {
        name: nameInput.value.trim(),
        mobile: mobileInput.value.trim(),
        passes: quantity(),
        pricePerPass: CONFIG.price,
        courierFee: courierFee(),
        total: orderTotal(),
        source: form.dataset.bookingForm,
        page: location.pathname + location.search
      };
      if (emailInput) lead.email = emailInput.value.trim();
      if (mode) lead.delivery = mode;
      if (mode === 'courier') {
        lead.address = addressInput.value.trim();
        lead.city = cityInput.value.trim();
        lead.pincode = pincodeInput.value.trim();
        lead.landmark = form.querySelector('[name="landmark"]').value.trim();
      } else if (mode === 'pickup') {
        lead.pickup = pickupSelect.value;
      }
      return lead;
    }

    function setBusy(busy, label) {
      submitBtn.disabled = busy;
      submitBtn.style.opacity = busy ? '.75' : '';
      if (label) submitBtn.dataset.busyLabel = label;
    }

    /* Everything the thank-you page needs, resolved here while the pickup
       list is still in scope — the page then needs no data of its own. */
    const ORDER_KEY = 'sitipuja.order';

    function makeReference() {
      // short, readable, and unique enough for a same-day support call
      return 'SP' + Date.now().toString(36).toUpperCase().slice(-6) +
        Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
    }

    function finishOrder(lead, paid, payment) {
      const centre = lead.pickup
        ? PICKUP_LOCATIONS.filter(l => l.name === lead.pickup)[0] || null
        : null;

      const order = {
        id: (payment && payment.razorpay_payment_id) || makeReference(),
        paid: !!paid,
        name: lead.name,
        passes: lead.passes,
        total: lead.total,
        delivery: lead.delivery || '',
        placedAt: new Date().toISOString(),
        collection: CONFIG.collection || {}
      };
      if (centre) {
        order.centre = {
          name: centre.name,
          venue: centre.venue || '',
          area: centre.area || '',
          phone: (centre.phone || []).slice()
        };
      }

      const page = CONFIG.thankYouPage;
      if (!page) { showSuccess(lead, paid); return; }

      try {
        sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
      } catch (err) {
        // private mode, or storage full — the inline panel still works
        showSuccess(lead, paid);
        return;
      }
      // no order details in the URL: they would leak into history and referrers
      window.location.assign(page);
    }

    function showSuccess(lead, paid) {
      const waBtn = form.querySelector('[data-success-wa]');
      if (waBtn) waBtn.setAttribute('href', whatsappLink(lead));

      const title = form.querySelector('.success-title');
      if (title) title.textContent = paid ? 'Payment received' : 'Request received';

      const msg = form.querySelector('[data-success-text]');
      if (msg) {
        const first = lead.name.split(' ')[0];
        const count = lead.passes + (lead.passes > 1 ? ' passes' : ' pass');
        msg.textContent = paid
          ? 'Thank you ' + first + '! Your payment of ' + rupee(lead.total) + ' for ' + count +
            ' is confirmed. The pass is on its way to ' + (lead.email || 'your email') + '.'
          : 'Thanks ' + first + '! We have your request for ' + count + ' (' + rupee(lead.total) +
            '). Our team will call you on ' + lead.mobile + ' shortly.';
      }

      if (successPanel) {
        Array.from(form.children).forEach(child => {
          if (child !== successPanel) child.style.display = 'none';
        });
        successPanel.hidden = false;
        successPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        const waBtnFocus = successPanel.querySelector('a');
        if (waBtnFocus) waBtnFocus.focus({ preventScroll: true });
      }
    }

    /* Razorpay's script is only fetched once, and only when someone pays. */
    let checkoutPromise = null;
    function loadCheckout() {
      if (window.Razorpay) return Promise.resolve(true);
      if (checkoutPromise) return checkoutPromise;
      checkoutPromise = new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
      return checkoutPromise;
    }

    function payWithRazorpay(lead) {
      const pay = CONFIG.payment;
      return loadCheckout()
        .then(loaded => {
          if (!loaded) throw new Error('checkout-unavailable');
          // The server creates the order; the browser never sets the amount it
          // will be charged, and never decides that a payment succeeded.
          return fetch(pay.orderEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: lead.total * 100, currency: 'INR', lead: lead })
          });
        })
        .then(res => { if (!res.ok) throw new Error('order-failed'); return res.json(); })
        .then(order => new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: pay.keyId,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency || 'INR',
            name: pay.companyName,
            description: pay.description + ' — ' + lead.passes +
              (lead.passes > 1 ? ' passes' : ' pass'),
            prefill: { name: lead.name, email: lead.email || '', contact: '+91' + lead.mobile },
            notes: { passes: String(lead.passes), delivery: lead.delivery || '' },
            theme: { color: '#017DC6' },
            handler: response => {
              if (!pay.verifyEndpoint) { resolve(response); return; }
              fetch(pay.verifyEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ lead: lead }, response))
              })
                .then(r => r.ok ? r.json() : Promise.reject(new Error('verify-failed')))
                .then(result => result && result.ok ? resolve(response) : reject(new Error('verify-failed')))
                .catch(reject);
            },
            modal: { ondismiss: () => reject(new Error('dismissed')) }
          });
          rzp.on('payment.failed', res => reject(new Error((res.error && res.error.description) || 'payment-failed')));
          rzp.open();
        }));
    }

    form.addEventListener('submit', e => {
      e.preventDefault();

      // every check runs, so the reader sees all of their mistakes at once,
      // then focus goes to the first one
      const firstBad = [
        checkName(), checkEmail(), checkMobile(),
        checkDelivery(), checkCourierDetails(), checkPickup()
      ].filter(Boolean)[0];

      if (firstBad) {
        firstBad.focus();
        track('form_error', { form: form.dataset.bookingForm, field: firstBad.name || 'delivery' });
        return;
      }

      const lead = collectLead();
      const pay = CONFIG.payment;
      const canCharge = !!(pay.keyId && pay.orderEndpoint);

      setBusy(true);
      postLead(lead);
      track('generate_lead', {
        currency: 'INR',
        value: lead.total,
        quantity: lead.passes,
        form: lead.source
      });

      // No gateway configured yet: capture the lead and hand off to WhatsApp
      // rather than showing a payment screen that cannot take money.
      if (!canCharge) {
        finishOrder(lead, false, null);
        return;
      }

      payWithRazorpay(lead)
        .then(payment => {
          track('purchase', {
            currency: 'INR',
            value: lead.total,
            quantity: lead.passes,
            form: lead.source
          });
          finishOrder(lead, true, payment);
        })
        .catch(err => {
          setBusy(false);
          if (err && err.message === 'dismissed') return;   // user closed the modal
          showError(null, 'We could not complete the payment. Please try again, or book on WhatsApp.', deliveryErrId);
          track('payment_error', { form: lead.source, reason: (err && err.message) || 'unknown' });
        });
    });

    syncDeliveryPanels();
    updatePrice();
  }

  $$('[data-booking-form]').forEach(initBookingForm);

  /* ======================================================================
     6b · Enquiry form
     Same shell as the booking form, but it quotes no price and takes no
     payment: it captures a question and hands it to the team. Kept apart
     from initBookingForm so neither has to carry the other's branches.
     ====================================================================== */
  function initEnquiryForm(form) {
    const field = n => form.querySelector('[name="' + n + '"]');
    const nameInput = field('name');
    const mobileInput = field('mobile');
    const emailInput = field('email');
    const messageInput = field('message');
    const successPanel = form.querySelector('[data-success]');
    const submitBtn = form.querySelector('button[type="submit"]');

    /* --- validation ------------------------------------------------------ */
    function checkName() {
      if (nameInput.value.trim().length < 2) {
        showError(nameInput, 'Please enter your full name.');
        return nameInput;
      }
      clearError(nameInput);
      return null;
    }
    function checkMobile() {
      if (!/^[6-9]\d{9}$/.test(mobileInput.value.trim())) {
        showError(mobileInput, 'Enter a valid 10-digit Indian mobile number.');
        return mobileInput;
      }
      clearError(mobileInput);
      return null;
    }
    // email is optional here — only a filled-in one has to be well formed
    function checkEmail() {
      if (!emailInput || !emailInput.value.trim()) {
        if (emailInput) clearError(emailInput);
        return null;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.value.trim())) {
        showError(emailInput, 'Enter a valid email address, or leave it blank.');
        return emailInput;
      }
      clearError(emailInput);
      return null;
    }
    function checkMessage() {
      if (messageInput.value.trim().length < 10) {
        showError(messageInput, 'Tell us a little more — at least a sentence.');
        return messageInput;
      }
      clearError(messageInput);
      return null;
    }

    mobileInput.addEventListener('input', () => {
      const cleaned = mobileInput.value.replace(/\D/g, '').slice(0, 10);
      if (cleaned !== mobileInput.value) mobileInput.value = cleaned;
      if (mobileInput.getAttribute('aria-invalid') && /^[6-9]\d{9}$/.test(cleaned)) clearError(mobileInput);
    });
    nameInput.addEventListener('input', () => {
      if (nameInput.getAttribute('aria-invalid') && nameInput.value.trim().length >= 2) clearError(nameInput);
    });
    messageInput.addEventListener('input', () => {
      if (messageInput.getAttribute('aria-invalid') && messageInput.value.trim().length >= 10) clearError(messageInput);
    });
    nameInput.addEventListener('blur', () => { if (nameInput.value.trim()) checkName(); });
    mobileInput.addEventListener('blur', () => { if (mobileInput.value.trim()) checkMobile(); });
    if (emailInput) emailInput.addEventListener('blur', checkEmail);

    /* --- hand-off -------------------------------------------------------- */
    function whatsappLink(lead) {
      const message =
        'Hi SITI Maha Puja, I have a question about the SITI Puja Pass 2026.\n\n' +
        'Name: ' + lead.name + '\n' +
        (lead.email ? 'Email: ' + lead.email + '\n' : '') +
        'Mobile: +91 ' + lead.mobile + '\n\n' +
        lead.message;
      return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(message);
    }

    function collectEnquiry() {
      return {
        type: 'enquiry',
        name: nameInput.value.trim(),
        mobile: mobileInput.value.trim(),
        email: emailInput ? emailInput.value.trim() : '',
        message: messageInput.value.trim(),
        source: 'enquiry-' + form.dataset.enquiryForm,
        page: location.pathname + location.search
      };
    }

    function showSuccess(lead) {
      const waBtn = form.querySelector('[data-success-wa]');
      if (waBtn) waBtn.setAttribute('href', whatsappLink(lead));

      const msg = form.querySelector('[data-success-text]');
      if (msg) {
        msg.textContent = 'Thanks ' + lead.name.split(' ')[0] + '! We have your question and will call ' +
          'you on ' + lead.mobile + ' within 2 working hours.';
      }

      if (!successPanel) return;
      Array.from(form.children).forEach(child => {
        if (child !== successPanel) child.style.display = 'none';
      });
      successPanel.hidden = false;
      successPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      const waBtnFocus = successPanel.querySelector('a');
      if (waBtnFocus) waBtnFocus.focus({ preventScroll: true });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();

      const firstBad = [checkName(), checkMobile(), checkEmail(), checkMessage()].filter(Boolean)[0];
      if (firstBad) {
        firstBad.focus();
        track('form_error', { form: 'enquiry', field: firstBad.name || 'unknown' });
        return;
      }

      const lead = collectEnquiry();
      if (submitBtn) submitBtn.disabled = true;
      postLead(lead);
      // an enquiry is a lead too, but it carries no money — value stays 0 so
      // it never inflates the revenue the booking form reports
      track('generate_lead', { currency: 'INR', value: 0, form: lead.source });
      showSuccess(lead);
    });
  }

  $$('[data-enquiry-form]').forEach(initEnquiryForm);

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
     8b · Background music
     Starts paused — autoplay with sound is blocked by every current browser
     and is hostile besides. The visitor's play/mute/volume choices persist
     for the session; if they had it playing, it resumes on their next
     gesture rather than fighting the autoplay policy.
     ====================================================================== */
  const MUSIC_KEY = 'sitipuja.music';

  function readMusicPrefs() {
    try {
      const raw = sessionStorage.getItem(MUSIC_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }
  function writeMusicPrefs(prefs) {
    try { sessionStorage.setItem(MUSIC_KEY, JSON.stringify(prefs)); } catch (err) { /* private mode */ }
  }

  (function initMusic() {
    const dock = $('#musicDock');
    const audio = $('#bgMusic');
    if (!dock || !audio) return;

    const cfg = CONFIG.music || {};
    // no track configured means no player at all
    if (!cfg.src) { dock.remove(); return; }

    const playBtn = $('#musicToggle', dock);
    const muteBtn = $('#musicMute', dock);
    const volInput = $('#musicVolume', dock);

    const saved = readMusicPrefs() || {};
    const startVol = typeof saved.volume === 'number'
      ? saved.volume
      : (typeof cfg.volume === 'number' ? cfg.volume : 0.4);

    audio.src = cfg.src;
    audio.loop = true;
    audio.volume = Math.min(1, Math.max(0, startVol));
    audio.muted = saved.muted === true;
    if (volInput) volInput.value = String(Math.round(audio.volume * 100));

    /* --- a missing or unplayable track must not leave a dead control ---- */
    // preload="metadata" makes the browser probe the file on load, so a bad
    // path surfaces here rather than on the visitor's first click
    audio.addEventListener('error', () => { dock.remove(); });

    function paint() {
      const playing = !audio.paused;
      dock.classList.toggle('is-playing', playing);
      dock.classList.toggle('is-muted', audio.muted || audio.volume === 0);
      if (playBtn) {
        playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
        playBtn.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
        playBtn.setAttribute('title', playing ? 'Pause music' : 'Play music');
      }
      if (muteBtn) {
        const off = audio.muted || audio.volume === 0;
        muteBtn.setAttribute('aria-pressed', off ? 'true' : 'false');
        muteBtn.setAttribute('aria-label', off ? 'Unmute music' : 'Mute music');
        muteBtn.setAttribute('title', off ? 'Unmute' : 'Mute');
      }
    }

    function persist() {
      writeMusicPrefs({ playing: !audio.paused, muted: audio.muted, volume: audio.volume });
    }

    function play() {
      const p = audio.play();
      // a rejected promise just means the browser said no — stay paused
      if (p && typeof p.catch === 'function') p.catch(() => { paint(); });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (audio.paused) { play(); track('music_play', {}); }
        else { audio.pause(); track('music_pause', {}); }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        // unmuting from a zeroed dial should actually make a sound
        if (audio.muted || audio.volume === 0) {
          audio.muted = false;
          if (audio.volume === 0) {
            audio.volume = 0.4;
            if (volInput) volInput.value = '40';
          }
        } else {
          audio.muted = true;
        }
        paint();
        persist();
      });
    }

    if (volInput) {
      volInput.addEventListener('input', () => {
        audio.volume = Math.min(1, Math.max(0, Number(volInput.value) / 100));
        if (audio.volume > 0) audio.muted = false;
        paint();
      });
      volInput.addEventListener('change', persist);
    }

    ['play', 'pause'].forEach(ev => audio.addEventListener(ev, () => { paint(); persist(); }));

    dock.hidden = false;
    paint();

    /* --- resume for a visitor who already chose to play ------------------ */
    if (cfg.startPaused !== true && saved.playing === true) {
      const resume = () => {
        if (audio.paused) play();
        document.removeEventListener('pointerdown', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('pointerdown', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
    }
  })();

  /* ======================================================================
     9 · Boot
     ====================================================================== */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setHeaderVar();
  initCountdown();
  onScroll();

  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(setHeaderVar, 150);
  });
  window.addEventListener('load', setHeaderVar);
})();
