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
    return DEFAULT_THEME;
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

    // Dispatch Events
    const eventPayload = { detail: { theme: themeId } };
    window.dispatchEvent(new CustomEvent('themechange', eventPayload));
    document.dispatchEvent(new CustomEvent('themechange', eventPayload));
  }

  function setTheme(themeId) {
    if (!THEMES.includes(themeId)) {
      console.warn(`[ClownTheme] Unknown theme "${themeId}", falling back to ${DEFAULT_THEME}`);
      themeId = DEFAULT_THEME;
    }

    applyTheme(themeId);
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
  window.ClownTheme = {
    THEMES: [...THEMES],
    setTheme,
    cycleTheme,
    getCurrentTheme
  };

  // Legacy/Convenience namespace
  window.clownhouse = {
    theme: window.ClownTheme,
    setTheme,
    cycleTheme,
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
      id: 'nav-stack',
      title: 'Jump: Developer Stack & Workbench',
      category: 'Navigation',
      desc: 'View Neovim, Go, Rust, TypeScript, Cloudflare, Linux',
      action: () => scrollToSection('stack'),
      keywords: 'stack tools neovim rust go linux typescript cloudflare'
    },
    {
      id: 'nav-activity',
      title: 'Jump: Activity & Momentum Telemetry',
      category: 'Navigation',
      desc: 'View commit cadence sparklines and edge metrics',
      action: () => scrollToSection('activity'),
      keywords: 'momentum activity commits telemetry uptime sparklines'
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
      if (item.action) {
        item.action();
      } else if (item.url) {
        if (item.external) {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = item.url;
        }
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
        const tokens = q.trim().toLowerCase().split(/\s+/);
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
      window.ClownAudio.togglePlay();
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

  // --- Initialization Routine ---
  function init() {
    // 1. Restore & Apply Theme
    const initialTheme = getStoredTheme();
    applyTheme(initialTheme);

    // 2. Setup Theme Button in Header
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        cycleTheme();
      });
    }

    // 3. Setup Command Palette Buttons
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

    // 4. Initialize Command Palette & Audio Pill
    initCommandPalette();
    initAudioPill();

    // 5. Attach Global Keydown Listener
    window.addEventListener('keydown', handleKeydown);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
