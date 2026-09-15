  // --- Floating Audio Pill UI Controller ---
  function toggleAudioPill() {
    const pill = document.getElementById('floating-audio-pill');
    const playIcon = document.getElementById('audio-play-icon');
    const pauseIcon = document.getElementById('audio-pause-icon');

    if (window.ClownAudio && typeof window.ClownAudio.togglePlay === 'function') {
      try {
        const toggleResult = window.ClownAudio.togglePlay();
        if (toggleResult && typeof toggleResult.catch === 'function') {
          toggleResult.catch((err) => {
            console.warn('[ClownAudio] togglePlay error:', err);
          });
        }
      } catch (err) {
        console.warn('[ClownAudio] togglePlay synchronous error:', err);
      }
      return;
    }

    // Baseline UI fallback
    if (!pill) return;
    const isPlaying = pill.classList.toggle('is-playing');
    if (playIcon && pauseIcon) {
      if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
    }
  }

  function toggleMutePill() {
    const unmutedIcon = document.getElementById('audio-unmuted-icon');
    const mutedIcon = document.getElementById('audio-muted-icon');

    if (window.ClownAudio && typeof window.ClownAudio.toggleMute === 'function') {
      window.ClownAudio.toggleMute();
      return;
    }

    if (unmutedIcon && mutedIcon) {
      const isMuted = unmutedIcon.classList.toggle('hidden');
      if (isMuted) {
        mutedIcon.classList.remove('hidden');
      } else {
        mutedIcon.classList.add('hidden');
      }
    }
  }

  function initAudioPill() {
    const playBtn = document.getElementById('audio-play-btn');
    const muteBtn = document.getElementById('audio-mute-btn');

    if (playBtn) playBtn.addEventListener('click', toggleAudioPill);
    if (muteBtn) muteBtn.addEventListener('click', toggleMutePill);
  }

  function updateStageMarquees() {
    const dock = document.getElementById('stage-select-dock');
    if (!dock) return;
    const cards = dock.querySelectorAll('.stage-card');
    cards.forEach((card) => {
      const scrollEl = card.querySelector('.card-title-scroll');
      const titleEl = card.querySelector('.card-title');
      if (!scrollEl || !titleEl) return;

      const containerWidth = scrollEl.clientWidth;
      const textWidth = titleEl.scrollWidth;

      if (textWidth > containerWidth + 2) {
        const overflow = Math.ceil(textWidth - containerWidth) + 8;
        titleEl.style.setProperty('--scroll-distance', `-${overflow}px`);
        card.classList.add('has-overflow-title');
        titleEl.classList.add('marquee-title');
      } else {
        card.classList.remove('has-overflow-title');
        titleEl.classList.remove('marquee-title');
        titleEl.style.removeProperty('--scroll-distance');
      }
    });
  }

  function initStageSelectDock() {
    const dock = document.getElementById('stage-select-dock');
    if (!dock) return;

    const cards = dock.querySelectorAll('.stage-card');
    cards.forEach((card) => {
      if (card.dataset.dockBound) return;
      card.dataset.dockBound = "true";

      card.addEventListener('mouseenter', () => {
        if (window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
          window.ClownAudio.playSfx('hover');
        }
      });

      card.addEventListener('focus', () => {
        if (window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
          window.ClownAudio.playSfx('hover');
        }
      });

      card.addEventListener('click', () => {
        if (window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
          window.ClownAudio.playSfx('select');
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.key === 'Enter') {
          e.preventDefault();
          card.click();
        }
      });
    });

    updateStageMarquees();
    window.addEventListener('resize', updateStageMarquees, { passive: true });
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateStageMarquees);
    }
    setTimeout(updateStageMarquees, 100);
    setTimeout(updateStageMarquees, 500);
  }

