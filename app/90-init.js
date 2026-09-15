  // --- Initialization Routine ---
  let isInitialized = false;
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // 1. Initial Load: Stored theme from localStorage or random theme
    const stored = getStoredTheme();
    const initialTheme = (stored && THEMES.includes(stored)) ? stored : getRandomTheme(false);
    applyTheme(initialTheme);

    // 2. Start Ambient Auto-Changer (periodic random theme morphing every 15-25s)
    startAutoRandom();

    // 3. Setup Theme Button in Header: click picks a random theme
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        randomTheme();
      });
    }

    // 4. Setup Command Palette Buttons
    const paletteBtn = document.getElementById('palette-toggle-btn');
    const heroPaletteBtn = document.getElementById('hero-palette-btn');

    if (paletteBtn) {
      paletteBtn.addEventListener('click', () => {
        if (window.ClownPalette) window.ClownPalette.open();
      });
    }

    if (heroPaletteBtn) {
      heroPaletteBtn.addEventListener('click', () => {
        if (window.ClownPalette) window.ClownPalette.open();
      });
    }

    // 5. Initialize Command Palette, Audio Pill, Stage Dock & Chaos Engine
    initCommandPalette();
    initAudioPill();
    initStageSelectDock();
    initChaosEngine();

    // 6. Attach Global Keydown Listener
    window.addEventListener('keydown', handleKeydown);

    // 6. Synchronize theme across browser tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue && THEMES.includes(e.newValue)) {
        applyTheme(e.newValue);
      }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
