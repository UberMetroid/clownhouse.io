/**
 * CLOWNHOUSE.IO // APPLICATION CONTROLLER & THEME ENGINE
 * Pure Vanilla ES6 — Zero External Dependencies
 */

(function () {
  'use strict';

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

  // --- Keyboard Shortcuts Engine ---
  function isTypingContext(target) {
    if (!target) return false;
    const tagName = target.tagName || '';
    return (
      target.isContentEditable ||
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT'
    );
  }

  function handleKeydown(e) {
    const target = e.target;
    const isPaletteOpen = paletteModal && !paletteModal.classList.contains('hidden');

    // Global Escape Handler: If modal is open, Escape closes it regardless of focus target
    if (e.key === 'Escape' && isPaletteOpen) {
      e.preventDefault();
      if (window.ClownPalette) {
        window.ClownPalette.close();
      }
      return;
    }

    // When modal is open, suppress background single-key action shortcuts (like 'T')
    if (isPaletteOpen && !(e.metaKey || e.ctrlKey)) {
      return;
    }

    // Ignore keydown auto-repeat to prevent strobe/runaway cycling when keys are held
    if (e.repeat) {
      return;
    }

    // Check for Command Palette Shortcut (Cmd+K, Ctrl+K, or /)
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
    const isSlash = e.key === '/' && !isTypingContext(target);

    if (isCmdK || isSlash) {
      e.preventDefault();
      if (window.ClownPalette) {
        window.ClownPalette.toggle();
      }
      return;
    }

    // Check for Random Theme Shortcut ('R' or 'r')
    if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!isTypingContext(target)) {
        e.preventDefault();
        randomTheme();
        return;
      }
    }

    // Check for Theme Cycle Shortcut ('T' or 't')
    if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!isTypingContext(target)) {
        e.preventDefault();
        cycleTheme();
      }
    }
  }

  // --- Command Palette Engine (Fuzzy Search & Navigation) ---
  const PALETTE_CATALOG = [
    {
      id: 'proj-openooda',
      title: 'openOODA.org',
      category: 'Featured Project',
      desc: 'Autonomous Agentic Architecture & Sovereign Systems Language',
      url: 'https://openooda.org',
      external: true,
      keywords: 'openooda agent ooda rust capabilities autonomous token sovereign'
    },
    {
      id: 'proj-necrometer',
      title: 'necrometer.dev',
      category: 'Featured Project',
      desc: 'Developer Telemetry, Metrics & Codebase Observability',
      url: 'https://necrometer.dev',
      external: true,
      keywords: 'necrometer telemetry metrics github decay mortality wasm rust'
    },
    {
      id: 'proj-bumtrips',
      title: 'bumtrips.com',
      category: 'Featured Project',
      desc: 'Beatniks, Bumtrips & Bullshit — Audio & Counter-Culture',
      url: 'https://bumtrips.com',
      external: true,
      keywords: 'bumtrips audio podcast psychedelic beatniks frequencies radio underground'
    },
    {
      id: 'svc-reactle',
      title: 'reactle.clownhouse.io',
      category: 'Cluster Lab',
      desc: 'Wordle-style retro word game terminal',
      url: 'https://reactle.clownhouse.io',
      external: true,
      keywords: 'reactle wordle game word puzzle retro terminal'
    },
    {
      id: 'svc-giggle',
      title: 'giggle.clownhouse.io',
      category: 'Cluster Compute',
      desc: 'SearXNG privacy-respecting metasearch computation node',
      url: 'https://giggle.clownhouse.io',
      external: true,
      keywords: 'giggle searxng search privacy compute cluster research'
    },
    {
      id: 'svc-contact',
      title: 'jeryd@clownhouse.io',
      category: 'Direct Ingress',
      desc: 'Cloudflare-routed secure email contact',
      url: 'mailto:jeryd@clownhouse.io',
      external: false,
      keywords: 'email contact jeryd mail inbox dispatch'
    },
    {
      id: 'nav-projects',
      title: 'Jump: Featured Projects Showcase',
      category: 'Navigation',
      desc: 'View openOODA, necrometer, and bumtrips architectures',
      action: () => scrollToSection('projects'),
      keywords: 'projects showcase systems featured core'
    },
    {
      id: 'nav-services',
      title: 'Jump: Labs & Cluster Services',
      category: 'Navigation',
      desc: 'View Reactle, Giggle, and direct mail ingress',
      action: () => scrollToSection('services'),
      keywords: 'services cluster labs nodes endpoints'
    },
    {
      id: 'nav-hero',
      title: 'Jump: Return to Top',
      category: 'Navigation',
      desc: 'Scroll back to the top of Clownhouse',
      action: () => scrollToSection('hero'),
      keywords: 'home hero top brand start'
    },
    {
      id: 'link-github',
      title: 'Source: GitHub Repository',
      category: 'Source Code',
      desc: 'View clownhouse.io repository on GitHub',
      url: 'https://github.com/studio2201/clownhouse.io',
      external: true,
      keywords: 'github repo source code git studio2201'
    },
    {
      id: 'act-theme-random',
      title: 'Action: Randomize Theme Palette (R)',
      category: 'Theme Engine',
      desc: 'Pick a random theme palette from the 7 Omarchy presets',
      action: () => randomTheme(),
      keywords: 'theme random randomize palette color shuffle switch'
    },
    {
      id: 'act-theme',
      title: 'Action: Cycle Next Theme (T)',
      category: 'Theme Engine',
      desc: 'Cycle through Tokyo Night, Catppuccin, Gruvbox, Nord, Rosé Pine, Ethereal, Vantablack',
      action: () => cycleTheme(),
      keywords: 'theme palette color cycle swap tokyo catppuccin gruvbox nord rose ethereal vantablack'
    },
    {
      id: 'theme-tokyo',
      title: 'Theme: Tokyo Night',
      category: 'Theme Palette',
      desc: 'Switch to Tokyo Night (Default Neon Dark)',
      action: () => setTheme('tokyo-night'),
      keywords: 'tokyo night theme dark neon'
    },
    {
      id: 'theme-catp',
      title: 'Theme: Catppuccin Mocha',
      category: 'Theme Palette',
      desc: 'Switch to Catppuccin Mocha (Soothing Pastel Dark)',
      action: () => setTheme('catppuccin'),
      keywords: 'catppuccin mocha theme pastel dark'
    },
    {
      id: 'theme-gruv',
      title: 'Theme: Gruvbox Dark',
      category: 'Theme Palette',
      desc: 'Switch to Gruvbox Dark (Warm Retro Groove)',
      action: () => setTheme('gruvbox'),
      keywords: 'gruvbox theme warm retro groove'
    },
    {
      id: 'theme-nord',
      title: 'Theme: Nord Arctic',
      category: 'Theme Palette',
      desc: 'Switch to Nord (Arctic Cold Blue)',
      action: () => setTheme('nord'),
      keywords: 'nord arctic blue theme'
    },
    {
      id: 'theme-rose',
      title: 'Theme: Rosé Pine',
      category: 'Theme Palette',
      desc: 'Switch to Rosé Pine (Warm Paper Light Mode)',
      action: () => setTheme('rose-pine'),
      keywords: 'rose pine light theme paper warm'
    },
    {
      id: 'theme-ethereal',
      title: 'Theme: Ethereal Indigo',
      category: 'Theme Palette',
      desc: 'Switch to Ethereal (Deep Indigo & Amber)',
      action: () => setTheme('ethereal'),
      keywords: 'ethereal indigo amber violet dark'
    },
    {
      id: 'theme-vanta',
      title: 'Theme: Vantablack',
      category: 'Theme Palette',
      desc: 'Switch to Vantablack (Pitch Black OLED)',
      action: () => setTheme('vantablack'),
      keywords: 'vantablack pitch black oled dark monochrome'
    },
    {
      id: 'act-audio',
      title: 'Action: Toggle Ambient Audio (Play/Pause)',
      category: 'Audio Player',
      desc: 'Toggle procedural synthesizer playback (Space)',
      action: () => toggleAudioPill(),
      keywords: 'sound audio music synth drone ambient frequency play pause'
    },
    {
      id: 'act-audio-mute',
      title: 'Action: Toggle Audio Mute',
      category: 'Audio Player',
      desc: 'Mute or unmute master ambient audio synthesizer',
      action: () => toggleMutePill(),
      keywords: 'mute unmute sound silence volume audio'
    },
    {
      id: 'act-audio-next',
      title: 'Action: Next Ambient Frequency Track',
      category: 'Audio Player',
      desc: 'Advance to next procedural frequency synthesizer mode',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.nextTrack === 'function') {
          window.ClownAudio.nextTrack();
        }
      },
      keywords: 'next track skip frequency cycle ambient'
    },
    {
      id: 'track-lab01',
      title: 'Track: LAB-01: Carrier Drift',
      category: 'Audio Track',
      desc: '55Hz Sub · 432Hz Carrier (Binaural carrier wave)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(0);
          window.ClownAudio.play();
        }
      },
      keywords: 'carrier drift 432hz 55hz binaural lab 01'
    },
    {
      id: 'track-lab02',
      title: 'Track: LAB-02: Cybernetic Drone',
      category: 'Audio Track',
      desc: '110Hz Drone · Modulated Filter (Sweeping lowpass harmonics)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(1);
          window.ClownAudio.play();
        }
      },
      keywords: 'cybernetic drone 110hz saw lowpass filter lab 02'
    },
    {
      id: 'track-lab03',
      title: 'Track: LAB-03: Necrometer 528Hz',
      category: 'Audio Track',
      desc: '528Hz Solfeggio Matrix · Pulse Sweep (Stereo delay feedback)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(2);
          window.ClownAudio.play();
        }
      },
      keywords: 'necrometer 528hz solfeggio repair matrix delay lab 03'
    },
    {
      id: 'track-lab04',
      title: 'Track: LAB-04: Velvet Frequency',
      category: 'Audio Track',
      desc: '63Hz Warm Bass · Pink Noise Wash (Deep analog baseline)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(3);
          window.ClownAudio.play();
        }
      },
      keywords: 'velvet frequency 63hz pink noise warm analog lab 04'
    },
    {
      id: 'ext-repo',
      title: 'Source: GitHub Repository',
      category: 'External Link',
      desc: 'View clownhouse.io source repository on GitHub',
      url: 'https://github.com/studio2201/clownhouse.io',
      external: true,
      keywords: 'github repo source code repository'
    }
  ];

  let paletteModal = null;
  let paletteInput = null;
  let paletteResults = null;
  let selectedIndex = 0;
  let filteredItems = [];

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function initCommandPalette() {
    paletteModal = document.getElementById('command-palette-modal');
    paletteInput = document.getElementById('palette-input');
    paletteResults = document.getElementById('palette-results');
    const backdrop = document.getElementById('palette-backdrop');
    const closeBadge = document.getElementById('palette-close-badge');

    if (!paletteModal || !paletteInput || !paletteResults) return;

    function openPalette() {
      paletteModal.classList.remove('hidden');
      paletteModal.setAttribute('aria-hidden', 'false');
      paletteInput.value = '';
      renderPaletteResults('');
      paletteInput.focus();
    }

    function closePalette() {
      paletteModal.classList.add('hidden');
      paletteModal.setAttribute('aria-hidden', 'true');
    }

    function togglePalette() {
      if (paletteModal.classList.contains('hidden')) {
        openPalette();
      } else {
        closePalette();
      }
    }

    function renderPaletteResults(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        filteredItems = [...PALETTE_CATALOG];
      } else {
        const tokens = q.split(/\s+/);
        filteredItems = PALETTE_CATALOG.filter((item) => {
          const haystack = `${item.title} ${item.category} ${item.desc} ${item.keywords || ''}`.toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        });
      }

      selectedIndex = 0;
      paletteResults.innerHTML = '';

      if (filteredItems.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'palette-empty';
        emptyDiv.textContent = 'No matching commands or projects found.';
        paletteResults.appendChild(emptyDiv);
        return;
      }

      filteredItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `palette-item${index === selectedIndex ? ' selected' : ''}`;
        itemEl.setAttribute('role', 'option');
        itemEl.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');

        const leftEl = document.createElement('div');
        leftEl.className = 'palette-item-left';

        const titleEl = document.createElement('span');
        titleEl.className = 'palette-item-title';
        titleEl.textContent = item.title;

        const descEl = document.createElement('span');
        descEl.className = 'palette-item-desc';
        descEl.textContent = item.desc;

        leftEl.appendChild(titleEl);
        leftEl.appendChild(descEl);

        const badgeEl = document.createElement('span');
        badgeEl.className = 'palette-item-badge';
        badgeEl.textContent = item.category;

        itemEl.appendChild(leftEl);
        itemEl.appendChild(badgeEl);

        itemEl.addEventListener('click', () => {
          executeItem(item);
          closePalette();
        });

        paletteResults.appendChild(itemEl);
      });
    }

    function updateSelection() {
      const items = paletteResults.querySelectorAll('.palette-item');
      items.forEach((el, idx) => {
        if (idx === selectedIndex) {
          el.classList.add('selected');
          el.setAttribute('aria-selected', 'true');
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.classList.remove('selected');
          el.setAttribute('aria-selected', 'false');
        }
      });
    }

    function executeItem(item) {
      if (!item) return;
      try {
        if (typeof item.action === 'function') {
          item.action();
        } else if (item.url) {
          if (item.external) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = item.url;
          }
        }
      } catch (actionErr) {
        console.warn('[ClownPalette] Action execution error:', actionErr);
      }
    }

    paletteInput.addEventListener('input', (e) => {
      renderPaletteResults(e.target.value);
    });

    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredItems.length;
          updateSelection();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
          updateSelection();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems.length > 0 && filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
          closePalette();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (paletteInput.value) {
          paletteInput.value = '';
          renderPaletteResults('');
        } else {
          closePalette();
        }
      }
    });

    if (backdrop) backdrop.addEventListener('click', closePalette);
    if (closeBadge) closeBadge.addEventListener('click', closePalette);

    // Global contract for palette
    window.ClownPalette = {
      open: openPalette,
      close: closePalette,
      toggle: togglePalette,
      search: (q) => {
        if (typeof q !== 'string') return [];
        const trimmed = q.trim().toLowerCase();
        if (!trimmed) return [...PALETTE_CATALOG];
        const tokens = trimmed.split(/\s+/);
        return PALETTE_CATALOG.filter((item) => {
          const text = `${item.title} ${item.category} ${item.desc} ${item.keywords || ''}`.toLowerCase();
          return tokens.every((token) => text.includes(token));
        });
      },
      executeItem: (itemId) => {
        const found = PALETTE_CATALOG.find((i) => i.id === itemId);
        if (found) executeItem(found);
      }
    };
  }

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
})();
