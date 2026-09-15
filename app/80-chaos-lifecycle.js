  function setReducedMotion(enabled) {
    prefersReducedMotionState = Boolean(enabled);
    if (prefersReducedMotionState) {
      if (chaosCtx && chaosCanvas) {
        chaosCtx.clearRect(0, 0, chaosCanvas.width, chaosCanvas.height);
      }
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        particlePool[i].active = false;
      }
      if (flareStreakEl) flareStreakEl.style.opacity = '0';
      if (flareGlintEl) flareGlintEl.style.opacity = '0';
      if (flareAuraEl) flareAuraEl.style.opacity = '0';
      if (apparitionsContainer) {
        while (apparitionsContainer.firstChild) {
          apparitionsContainer.removeChild(apparitionsContainer.firstChild);
        }
      }
    } else {
      scheduleNextApparition();
      scheduleNextBurst();
    }
  }

  function destroyChaos() {
    chaosDestroyed = true;
    isChaosInitialized = false;
    if (chaosRafId) {
      safeCancelRaf(chaosRafId);
      chaosRafId = null;
    }
    if (apparitionTimer) {
      clearTimeout(apparitionTimer);
      apparitionTimer = null;
    }
    if (burstTimer) {
      clearTimeout(burstTimer);
      burstTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onChaosResize);
      window.removeEventListener('mousemove', onChaosMouseMove);
      window.removeEventListener('scroll', onChaosScroll);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onChaosClick);
      document.removeEventListener('visibilitychange', onChaosVisibilityChange);
    }

    if (chaosCtx && chaosCanvas) {
      chaosCtx.clearRect(0, 0, chaosCanvas.width, chaosCanvas.height);
    }
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      particlePool[i].active = false;
    }
    if (apparitionsContainer) {
      while (apparitionsContainer.firstChild) {
        apparitionsContainer.removeChild(apparitionsContainer.firstChild);
      }
    }
  }

  // Event handlers
  function onChaosResize() {
    resizeCanvas();
  }

  function onChaosMouseMove(e) {
    if (prefersReducedMotionState) return;
    targetFlareX = e.clientX;
    targetFlareY = e.clientY;
  }

  function onChaosScroll() {
    if (prefersReducedMotionState) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const currentY = (typeof window !== 'undefined') ? (window.scrollY || window.pageYOffset || 0) : 0;
    const dt = Math.max(1, now - lastScrollTime);
    const dy = Math.abs(currentY - lastScrollY);
    scrollVelocity = Math.min(5.0, dy / dt);
    lastScrollY = currentY;
    lastScrollTime = now;
  }

  function onChaosClick(e) {
    if (prefersReducedMotionState || chaosDestroyed) return;
    const isStageCard = Boolean(e.target && typeof e.target.closest === 'function' && e.target.closest('.stage-card'));
    const count = isStageCard ? 48 : 24;
    const clickX = (typeof e.clientX === 'number' && Number.isFinite(e.clientX)) ? e.clientX : (window.innerWidth / 2);
    const clickY = (typeof e.clientY === 'number' && Number.isFinite(e.clientY)) ? e.clientY : (window.innerHeight / 2);
    triggerExplosion(clickX, clickY, count);
  }

  function onChaosVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (chaosRafId) {
        safeCancelRaf(chaosRafId);
        chaosRafId = null;
      }
      if (apparitionTimer) {
        clearTimeout(apparitionTimer);
        apparitionTimer = null;
      }
      if (burstTimer) {
        clearTimeout(burstTimer);
        burstTimer = null;
      }
    } else {
      if (!chaosRafId && !chaosDestroyed) {
        chaosRafId = safeRaf(chaosRenderLoop);
      }
      scheduleNextApparition();
      scheduleNextBurst();
    }
  }

  function initChaosEngine() {
    if (isChaosInitialized || typeof document === 'undefined') return;
    isChaosInitialized = true;
    chaosDestroyed = false;

    chaosCanvas = document.getElementById('chaos-canvas');
    apparitionsContainer = document.getElementById('chaos-apparitions');
    flaresContainer = document.getElementById('chaos-flares');

    // Create lens flare DOM elements if flaresContainer exists
    if (flaresContainer) {
      flareStreakEl = flaresContainer.querySelector('.chaos-flare-streak');
      if (!flareStreakEl) {
        flareStreakEl = document.createElement('div');
        flareStreakEl.className = 'chaos-flare-streak';
        flaresContainer.appendChild(flareStreakEl);
      }

      flareGlintEl = flaresContainer.querySelector('.chaos-flare-glint');
      if (!flareGlintEl) {
        flareGlintEl = document.createElement('div');
        flareGlintEl.className = 'chaos-flare-glint';
        flaresContainer.appendChild(flareGlintEl);
      }

      flareAuraEl = flaresContainer.querySelector('.chaos-flare-aura');
      if (!flareAuraEl) {
        flareAuraEl = document.createElement('div');
        flareAuraEl.className = 'chaos-flare-aura';
        flaresContainer.appendChild(flareAuraEl);
      }
    }

    // Check media query for prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotionState = mediaQuery.matches;
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', (e) => {
          setReducedMotion(e.matches);
        });
      }
    }

    // Initialize canvas sizing
    resizeCanvas();

    // Attach listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onChaosResize);
      window.addEventListener('mousemove', onChaosMouseMove, { passive: true });
      window.addEventListener('scroll', onChaosScroll, { passive: true });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('click', onChaosClick, { passive: true });
      document.addEventListener('visibilitychange', onChaosVisibilityChange);
    }

    // Initial flare position centered
    if (typeof window !== 'undefined') {
      targetFlareX = window.innerWidth / 2;
      targetFlareY = window.innerHeight / 2;
      currentFlareX = targetFlareX;
      currentFlareY = targetFlareY;
    }

    // Start 60fps render loop
    if (!chaosRafId) {
      chaosRafId = safeRaf(chaosRenderLoop);
    }

    // Schedule ambient timers
    scheduleNextApparition();
    scheduleNextBurst();
  }

  // Public ClownChaos contract
  const ClownChaosAPI = {
    spawnApparition,
    triggerExplosion,
    setReducedMotion,
    getActiveApparitionCount,
    destroy: destroyChaos
  };

  if (typeof window !== 'undefined') {
    window.ClownChaos = ClownChaosAPI;
  }

