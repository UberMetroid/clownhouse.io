  // --- Constants & Theme Definitions ---
  const THEMES = [
    'tokyo-night',
    'catppuccin',
    'gruvbox',
    'nord',
    'rose-pine',
    'ethereal',
    'vantablack'
  ];

  const THEME_META_COLORS = {
    'tokyo-night': '#1a1b26',
    'catppuccin': '#1e1e2e',
    'gruvbox': '#282828',
    'nord': '#2e3440',
    'rose-pine': '#faf4ed',
    'ethereal': '#060b1e',
    'vantablack': '#000000'
  };

  const STORAGE_KEY = 'theme';
  const DEFAULT_THEME = 'tokyo-night';

  let currentTheme = DEFAULT_THEME;

  // --- Safe LocalStorage Access ---
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.includes(stored)) {
        return stored;
      }
    } catch (err) {
      console.warn('[ClownTheme] LocalStorage read error:', err);
    }
    return null;
  }

  function setStoredTheme(themeId) {
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch (err) {
      console.warn('[ClownTheme] LocalStorage write error:', err);
    }
  }

  // --- Theme Application Engine ---
  function applyTheme(themeId) {
    if (!THEMES.includes(themeId)) {
      themeId = DEFAULT_THEME;
    }

    currentTheme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);

    // Update <meta name="theme-color">
    const metaThemeColor = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', THEME_META_COLORS[themeId] || '#1a1b26');
    }

    // Update Header Theme Button Label
    const themeBtnLabel = document.getElementById('theme-btn-label');
    if (themeBtnLabel) {
      themeBtnLabel.textContent = themeId;
    }

    // Persist
    setStoredTheme(themeId);

    // Dispatch Events with error boundary
    try {
      const eventPayload = { detail: { theme: themeId } };
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('themechange', eventPayload));
        document.dispatchEvent(new CustomEvent('themechange', eventPayload));
      }
    } catch (evtErr) {
      console.warn('[ClownTheme] Event dispatch error:', evtErr);
    }
  }

  // --- Trigger 1: Ambient Random Theme Cycle (15–25s) ---
  let autoThemeTimer = null;
  let autoRandomActive = true;
  let customAutoInterval = null;

  function scheduleNextAutoTheme() {
    if (autoThemeTimer) {
      clearTimeout(autoThemeTimer);
      autoThemeTimer = null;
    }
    if (!autoRandomActive) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    // Dynamically reschedules every 15 to 25 seconds: 15000 + Math.random() * 10000
    const delay = (typeof customAutoInterval === 'number' && Number.isFinite(customAutoInterval) && customAutoInterval > 0)
      ? customAutoInterval
      : Math.floor(15000 + Math.random() * 10000);

    autoThemeTimer = setTimeout(() => {
      autoThemeTimer = null;
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      randomTheme();
      if (autoRandomActive && !autoThemeTimer) {
        scheduleNextAutoTheme();
      }
    }, delay);
  }

  function startAutoRandom(intervalMs) {
    autoRandomActive = true;
    if (typeof intervalMs === 'number' && Number.isFinite(intervalMs) && intervalMs > 0) {
      customAutoInterval = intervalMs;
    } else {
      customAutoInterval = null;
    }
    scheduleNextAutoTheme();
  }

  function stopAutoRandom() {
    autoRandomActive = false;
    if (autoThemeTimer) {
      clearTimeout(autoThemeTimer);
      autoThemeTimer = null;
    }
  }

  function resetAutoRandom() {
    scrollFlickArmed = false;
    if (scrollStopTimer) {
      clearTimeout(scrollStopTimer);
      scrollStopTimer = null;
    }
    if (autoRandomActive) {
      scheduleNextAutoTheme();
    }
  }

  function handleThemeVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (autoThemeTimer) {
        clearTimeout(autoThemeTimer);
        autoThemeTimer = null;
      }
    } else {
      if (autoRandomActive && !autoThemeTimer) {
        scheduleNextAutoTheme();
      }
    }
  }

