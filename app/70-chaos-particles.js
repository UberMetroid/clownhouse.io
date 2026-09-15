  function triggerExplosion(x, y, particleCount) {
    if (chaosDestroyed || prefersReducedMotionState) return;

    const w = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 800;
    const h = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 600;

    const originX = (typeof x === 'number' && Number.isFinite(x) && x >= 0) ? x : (w / 2);
    const originY = (typeof y === 'number' && Number.isFinite(y) && y >= 0) ? y : (h / 2);

    const count = (typeof particleCount === 'number' && Number.isFinite(particleCount) && particleCount > 0)
      ? Math.min(64, Math.floor(particleCount))
      : 24;

    const SIZES = [3, 4, 5, 6];

    for (let c = 0; c < count; c++) {
      let candidate = null;
      let maxLife = -1;
      let oldest = null;

      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) {
          candidate = p;
          break;
        }
        if (p.life > maxLife) {
          maxLife = p.life;
          oldest = p;
        }
      }

      const p = candidate || oldest;
      if (!p) continue;

      p.active = true;
      p.x = originX;
      p.y = originY;
      p.size = SIZES[Math.floor(Math.random() * SIZES.length)];
      p.life = 0;
      p.maxLife = 35 + Math.floor(Math.random() * 30);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.0; // [2.0, 7.0]
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
    }
  }

  function scheduleNextBurst() {
    if (burstTimer) clearTimeout(burstTimer);
    if (chaosDestroyed || (typeof document !== 'undefined' && document.hidden) || prefersReducedMotionState) return;

    // Ambient background burst every 8–16 seconds
    const delay = 8000 + Math.random() * 8000;
    burstTimer = setTimeout(() => {
      const w = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 800;
      const h = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 600;
      const rx = 0.10 * w + Math.random() * 0.80 * w;
      const ry = 0.10 * h + Math.random() * 0.80 * h;
      triggerExplosion(rx, ry, 18 + Math.floor(Math.random() * 8));
      scheduleNextBurst();
    }, delay);
  }

  function resizeCanvas() {
    if (!chaosCanvas && typeof document !== 'undefined') {
      chaosCanvas = document.getElementById('chaos-canvas');
    }
    if (!chaosCanvas) return;

    if (!chaosCtx && typeof chaosCanvas.getContext === 'function') {
      chaosCtx = chaosCanvas.getContext('2d');
    }

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const w = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 800;
    const h = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 600;

    chaosCanvas.width = Math.floor(w * dpr);
    chaosCanvas.height = Math.floor(h * dpr);
    chaosCanvas.style.width = `${w}px`;
    chaosCanvas.style.height = `${h}px`;

    if (chaosCtx && typeof chaosCtx.setTransform === 'function') {
      chaosCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      chaosCtx.imageSmoothingEnabled = false;
    }
  }

  function updateAndRenderParticles() {
    if (!chaosCtx || !chaosCanvas) return;
    const w = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 800;
    const h = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 600;

    chaosCtx.clearRect(0, 0, w, h);

    // Read current theme accent
    let accent = '#f9e2af';
    if (typeof document !== 'undefined' && document.documentElement) {
      accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f9e2af';
    }

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = particlePool[i];
      if (!p.active) continue;

      // 16-bit arcade physics: drag 0.94, gravity +0.12
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 0.12;
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life >= p.maxLife || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        p.active = false;
        continue;
      }

      // 4-step color grading:
      // core white (#ffffff) -> high-energy accent -> flame (#e06c75) -> smoke (#414868)
      const t = 1.0 - (p.life / p.maxLife);
      let color;
      if (t >= 0.75) {
        color = '#ffffff';
      } else if (t >= 0.50) {
        color = accent;
      } else if (t >= 0.25) {
        color = '#e06c75';
      } else {
        color = '#414868';
      }

      chaosCtx.fillStyle = color;
      chaosCtx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  function updateLensFlares() {
    if (prefersReducedMotionState || !flareStreakEl) return;

    // Smooth lerp cursor coordinates (factor 0.08)
    currentFlareX += (targetFlareX - currentFlareX) * 0.08;
    currentFlareY += (targetFlareY - currentFlareY) * 0.08;

    // Decay scroll velocity smoothly
    scrollVelocity *= 0.92;

    const streakOpacity = Math.min(0.85, 0.18 + scrollVelocity * 0.35);
    const streakHeight = Math.min(8, 2 + scrollVelocity * 2.0);

    flareStreakEl.style.transform = `translateY(${currentFlareY.toFixed(1)}px)`;
    flareStreakEl.style.opacity = streakOpacity.toFixed(2);
    flareStreakEl.style.height = `${streakHeight.toFixed(1)}px`;

    if (flareGlintEl) {
      const glintOpacity = Math.min(0.85, 0.15 + scrollVelocity * 0.3);
      flareGlintEl.style.transform = `translate(${currentFlareX.toFixed(1)}px, ${currentFlareY.toFixed(1)}px) rotate(45deg)`;
      flareGlintEl.style.opacity = glintOpacity.toFixed(2);
    }

    if (flareAuraEl) {
      const auraOpacity = Math.min(0.65, 0.12 + scrollVelocity * 0.25);
      flareAuraEl.style.transform = `translate(${currentFlareX.toFixed(1)}px, ${currentFlareY.toFixed(1)}px)`;
      flareAuraEl.style.opacity = auraOpacity.toFixed(2);
    }
  }

  function chaosRenderLoop() {
    if (chaosDestroyed) return;
    chaosRafId = safeRaf(chaosRenderLoop);

    if (prefersReducedMotionState) {
      if (chaosCtx && chaosCanvas) {
        chaosCtx.clearRect(0, 0, chaosCanvas.width, chaosCanvas.height);
      }
      return;
    }

    updateAndRenderParticles();
    updateLensFlares();
  }

