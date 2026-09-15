  // ==========================================================================
  // SURREAL AMBIENT VISUAL CHAOS ENGINE (window.ClownChaos)
  // - Phasing text apparitions (bounded pool <= 4, strict DOM .remove(), drift/fade)
  // - 16-bit pixel art explosions on canvas (256 particle pool, ambient bursts + clicks)
  // - Sci-fi anamorphic lens flares (pointer-events: none !important, lerp tracking, scroll)
  // - 60fps performance, tab visibility pause, reduced-motion support
  // ==========================================================================

  const APPARITION_CATALOG = [
    "OODA LOOP: OBSERVE -> ORIENT -> DECIDE -> ACT",
    "CAPABILITY TOKEN 0x7F... VERIFIED",
    "THE CLOWN SEES THROUGH THE SCANLINES",
    "ENTROPY LEVEL: 528Hz CRITICAL",
    "SYNAPSE DIVERGENCE DETECTED",
    "CHRONO ANOMALY: ZEAL 12,000 B.C.",
    "SATELLITE DOWNLINK: PACIFIC OUTPOST ONLINE",
    "REALITY BUFFER OVERFLOW: NULL_POINTER_VOID",
    "TRANSMITTING TO THE VOID...",
    "HOW DEAD IS YOUR CODE? // NECROMETER",
    "BEATNIKS, BUMTRIPS & COUNTER-CULTURE FREQUENCIES",
    "X-BUSTER CHARGE: 100% MAXIMUM",
    "SUB-ATOMIC TELEMETRY STREAM ACQUIRED",
    "MAVERICK SIGNATURE ISOLATED",
    "STATIC SITE PURITY: ZERO FRAMEWORKS"
  ];

  const PARTICLE_POOL_SIZE = 256;
  const particlePool = new Array(PARTICLE_POOL_SIZE);
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    particlePool[i] = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      life: 0,
      maxLife: 60
    };
  }

  let chaosRafId = null;
  let apparitionTimer = null;
  let burstTimer = null;
  let chaosDestroyed = false;
  let isChaosInitialized = false;
  let prefersReducedMotionState = false;

  // Lens flare smoothed coordinates & scroll state
  let targetFlareX = 400;
  let targetFlareY = 300;
  let currentFlareX = 400;
  let currentFlareY = 300;
  let scrollVelocity = 0;
  let lastScrollY = 0;
  let lastScrollTime = 0;

  // DOM Elements cache
  let chaosCanvas = null;
  let chaosCtx = null;
  let apparitionsContainer = null;
  let flaresContainer = null;
  let flareStreakEl = null;
  let flareGlintEl = null;
  let flareAuraEl = null;

  // Safe RAF polyfill for node / mock environments
  const safeRaf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb) => setTimeout(() => cb(Date.now()), 16);
  const safeCancelRaf = typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame
    : clearTimeout;

  function getActiveApparitionCount() {
    if (!apparitionsContainer && typeof document !== 'undefined') {
      apparitionsContainer = document.getElementById('chaos-apparitions');
    }
    return apparitionsContainer ? apparitionsContainer.childElementCount : 0;
  }

  function spawnApparition(customText) {
    if (chaosDestroyed || prefersReducedMotionState) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (getActiveApparitionCount() >= 4) return;

    if (!apparitionsContainer && typeof document !== 'undefined') {
      apparitionsContainer = document.getElementById('chaos-apparitions');
    }
    if (!apparitionsContainer) return;

    let text;
    if (typeof customText === 'string' && customText.trim().length > 0) {
      text = customText.trim();
    } else {
      const idx = Math.floor(Math.random() * APPARITION_CATALOG.length);
      text = APPARITION_CATALOG[idx];
    }

    // Coordinates bounded to 5% <= x <= 80%, 10% <= y <= 85%
    const xPct = (5 + Math.random() * 75).toFixed(1);
    const yPct = (10 + Math.random() * 75).toFixed(1);
    // Duration between 3.5s and 6.0s
    const duration = (3.5 + Math.random() * 2.5).toFixed(2);

    const span = document.createElement('span');
    span.className = 'chaos-text-apparition';
    span.textContent = text;
    span.style.left = `${xPct}%`;
    span.style.top = `${yPct}%`;
    span.style.animationDuration = `${duration}s`;

    let removed = false;
    const removeSpan = () => {
      if (removed) return;
      removed = true;
      span.removeEventListener('animationend', removeSpan);
      if (span.parentNode) {
        span.remove();
      }
    };

    span.addEventListener('animationend', removeSpan);
    // Hard garbage-collection fallback timer (7.5s)
    setTimeout(removeSpan, 7500);

    apparitionsContainer.appendChild(span);
  }

  function scheduleNextApparition() {
    if (apparitionTimer) clearTimeout(apparitionTimer);
    if (chaosDestroyed || (typeof document !== 'undefined' && document.hidden) || prefersReducedMotionState) return;

    // Fires every 4–8 seconds
    const delay = 4000 + Math.random() * 4000;
    apparitionTimer = setTimeout(() => {
      spawnApparition();
      scheduleNextApparition();
    }, delay);
  }

