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

