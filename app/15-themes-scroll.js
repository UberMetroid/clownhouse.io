  // --- Trigger 2: Scroll Velocity & Stop Detector with 4.0s Anti-Strobe Cooldown ---
  const SCROLL_FLICK_THRESHOLD = 1.8;      // px/ms
  const SCROLL_STOP_THRESHOLD = 0.1;       // px/ms
  const SCROLL_STOP_DURATION_MS = 150;     // ms (>150ms of stop)
  const SCROLL_COOLDOWN_MS = 4000;         // 4.0s anti-strobe cooldown
  const SCROLL_WINDOW_MS = 100;            // sliding window ~100ms

  let scrollSamples = [];
  let scrollFlickArmed = false;
  let scrollFlickTimestamp = 0;
  let scrollStopTimer = null;
  let lastScrollTriggerTime = -SCROLL_COOLDOWN_MS;

  function isReducedMotion() {
    try {
      return Boolean(
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch (_) {
      return false;
    }
  }

  function handleThemeScroll(e) {
    if (isReducedMotion()) {
      scrollFlickArmed = false;
      if (scrollStopTimer) {
        clearTimeout(scrollStopTimer);
        scrollStopTimer = null;
      }
      return;
    }

    const now = (e && e.detail && typeof e.detail.time === 'number')
      ? e.detail.time
      : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());

    const currentY = (e && e.detail && typeof e.detail.scrollY === 'number')
      ? e.detail.scrollY
      : ((e && typeof e.scrollY === 'number')
        ? e.scrollY
        : ((typeof window !== 'undefined') ? (window.scrollY || window.pageYOffset || 0) : 0));

    // Record sample in sliding window
    scrollSamples.push({ y: currentY, time: now });

    // Prune samples older than sliding window (~100ms)
    while (scrollSamples.length > 0 && (now - scrollSamples[0].time) > SCROLL_WINDOW_MS) {
      scrollSamples.shift();
    }

    // Compute velocity: Vs = |Δy| / Δt over sliding window (px/ms)
    let vs = 0;
    if (scrollSamples.length >= 2) {
      const oldest = scrollSamples[0];
      const dt = now - oldest.time;
      const dy = Math.abs(currentY - oldest.y);
      if (dt >= 5) {
        vs = dy / dt;
      }
    }

    // Detect rapid scroll flick: Vs > 1.8 px/ms
    if (vs > SCROLL_FLICK_THRESHOLD) {
      scrollFlickArmed = true;
      scrollFlickTimestamp = now;
    }

    // If velocity is high, scroll is actively moving, clear stop timer
    if (vs >= SCROLL_STOP_THRESHOLD) {
      if (scrollStopTimer) {
        clearTimeout(scrollStopTimer);
        scrollStopTimer = null;
      }
    }

    // Schedule or refresh stop detector: triggers when Vs < 0.1 px/ms for > 150ms
    if (scrollStopTimer) {
      clearTimeout(scrollStopTimer);
    }
    scrollStopTimer = setTimeout(onScrollStopDetected, SCROLL_STOP_DURATION_MS + 10);
  }

  function onScrollStopDetected() {
    scrollStopTimer = null;

    if (isReducedMotion()) {
      scrollFlickArmed = false;
      return;
    }

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // If a flick was armed within the last 3.0s:
    if (scrollFlickArmed && (now - scrollFlickTimestamp) <= 3000) {
      scrollFlickArmed = false;

      // Strictly enforce 4.0-second cooldown window between scroll-triggered shifts
      if (now - lastScrollTriggerTime >= SCROLL_COOLDOWN_MS) {
        lastScrollTriggerTime = now;
        randomTheme();
      }
    } else {
      scrollFlickArmed = false;
    }
  }

  // Attach immediate global listeners if window / document defined
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleThemeScroll, { passive: true });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleThemeVisibilityChange);
  }

  // --- Theme Selection & Application Wrappers ---
  function getRandomTheme(excludeCurrent = true) {
    const pool = (excludeCurrent && THEMES.length > 1)
      ? THEMES.filter(t => t !== currentTheme)
      : THEMES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randomTheme() {
    const nextTheme = getRandomTheme(true);
    setTheme(nextTheme);
    return nextTheme;
  }

  function setTheme(themeId) {
    if (typeof themeId !== 'string' || !THEMES.includes(themeId)) {
      const safeId = (typeof themeId === 'string') ? themeId : String(typeof themeId);
      console.warn('[ClownTheme] Unknown theme', safeId, 'falling back to', DEFAULT_THEME);
      themeId = DEFAULT_THEME;
    }

    // Synchronously execute applyTheme so DOM and state update immediately
    applyTheme(themeId);
    resetAutoRandom();

    const prefersReducedMotion = isReducedMotion();

    if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
      try {
        const transition = document.startViewTransition(() => {
          applyTheme(currentTheme);
        });
        if (transition) {
          if (transition.ready && typeof transition.ready.catch === 'function') {
            transition.ready.catch(() => {});
          }
          if (transition.finished && typeof transition.finished.catch === 'function') {
            transition.finished.catch(() => {});
          }
        }
      } catch (err) {
        // Fallback already satisfied synchronously
      }
    }
  }

  function cycleTheme() {
    const currentIndex = THEMES.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    const nextTheme = THEMES[nextIndex];
    setTheme(nextTheme);
    return nextTheme;
  }

  function getCurrentTheme() {
    return currentTheme;
  }

  // --- Public Interface Contract: window.ClownTheme ---
  window.ClownTheme = Object.freeze({
    THEMES: Object.freeze([...THEMES]),
    setTheme,
    cycleTheme,
    randomTheme,
    getCurrentTheme,
    startAutoRandom,
    stopAutoRandom,
    resetAutoRandom
  });

  // Legacy/Convenience namespace
  window.clownhouse = {
    theme: window.ClownTheme,
    setTheme,
    cycleTheme,
    randomTheme,
    getActiveTheme: getCurrentTheme
  };

