    // CATEGORY 3: 7 THEMES CYCLING (ORDER & INVARIANTS UNDER PACED CYCLING)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 3: 7 THEMES CYCLING (ORDER & INVARIANTS WITH PACED DELAY)');
    console.log('----------------------------------------------------------------');

    // Reset to tokyo-night
    await cdp.eval('window.ClownTheme.setTheme("tokyo-night")');
    await new Promise(r => setTimeout(r, 100));

    let pacedCycleError = null;
    for (let i = 0; i < THEMES.length * 2; i++) {
      const expectedIndex = (i + 1) % THEMES.length;
      const expectedTheme = THEMES[expectedIndex];

      await cdp.eval('window.ClownTheme.cycleTheme()');
      // Allow ViewTransition callback to complete
      await new Promise(r => setTimeout(r, 80));

      const current = await cdp.eval('window.ClownTheme.getCurrentTheme()');
      const dom = await cdp.eval('document.documentElement.getAttribute("data-theme")');
      const meta = await cdp.eval('document.getElementById("theme-color-meta").getAttribute("content")');

      if (current !== expectedTheme || dom !== expectedTheme) {
        pacedCycleError = `Step ${i}: expected ${expectedTheme}, got current=${current}, dom=${dom}`;
        break;
      }
      if (meta !== THEME_META_COLORS[expectedTheme]) {
        pacedCycleError = `Step ${i}: meta color mismatch for ${expectedTheme}: expected ${THEME_META_COLORS[expectedTheme]}, got ${meta}`;
        break;
      }
    }
    record('3.1 7 themes cycle in deterministic modulo order (14 paced steps) with full CSS/meta alignment', !pacedCycleError, pacedCycleError || '');

    // =========================================================================
    // CATEGORY 4: ADVERSARIAL STRESS: RAPID TOGGLING & VIEW TRANSITION RACE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 4: ADVERSARIAL STRESS: RAPID TOGGLING & RACE CONDITIONS');
    console.log('----------------------------------------------------------------');

    // Test 4.1: Synchronous State Consistency Contract
    // PROJECT.md interface contract specifies setTheme(themeId: string): void and getCurrentTheme(): string.
    // When setTheme('catppuccin') is called, getCurrentTheme() MUST immediately return 'catppuccin'.
    const syncStateContract = await cdp.eval(`
      (() => {
        window.ClownTheme.setTheme('tokyo-night');
        // Immediately set to catppuccin
        window.ClownTheme.setTheme('catppuccin');
        const immediateCurrent = window.ClownTheme.getCurrentTheme();
        const immediateDom = document.documentElement.getAttribute('data-theme');
        return {
          immediateCurrent,
          immediateDom,
          pass: (immediateCurrent === 'catppuccin') && (immediateDom === 'catppuccin')
        };
      })()
    `);
    record(
      '4.1 Synchronous Contract: window.ClownTheme.setTheme updates state immediately',
      syncStateContract.pass,
      `State lag detected: immediateCurrent="${syncStateContract.immediateCurrent}", immediateDom="${syncStateContract.immediateDom}" (deferred into async ViewTransition)`
    );

    // Test 4.2: Rapid Double 'T' Shortcut Keypress (Theme Dropping Bug)
    // A user tapping 'T' twice in quick succession (<16ms) must advance 2 themes: tokyo-night -> gruvbox.
    const rapidDoublePress = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 100));

        // Rapid double keypress
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));

        // Wait for all transitions to settle
        await new Promise(r => setTimeout(r, 300));

        const endTheme = window.ClownTheme.getCurrentTheme();
        const endDom = document.documentElement.getAttribute('data-theme');
        // Starting at index 0 ('tokyo-night'), 2 presses MUST land on index 2 ('gruvbox')
        return {
          endTheme,
          endDom,
          pass: endTheme === 'gruvbox' && endDom === 'gruvbox'
        };
      })()
    `);
    record(
      '4.2 Rapid T-Key Toggling: 2 rapid keypresses advance 2 theme positions (tokyo-night -> gruvbox)',
      rapidDoublePress.pass,
      `Theme drop failure: expected "gruvbox", but landed on "${rapidDoublePress.endTheme}". Second press was eaten because currentTheme was not updated synchronously.`
    );

    // Test 4.3: Unhandled Promise Rejection on Rapid ViewTransitions (Console Error Violation)
    // Rapidly cycling themes while ViewTransitions are active must NOT throw unhandled AbortError rejections.
    const unhandledRejectionsCheck = await cdp.eval(`
      (async () => {
        const caughtErrors = [];
        const rejectionHandler = (e) => caughtErrors.push(String(e.reason));
        window.addEventListener('unhandledrejection', rejectionHandler);

        // Burst 8 rapid 't' events
        for (let i = 0; i < 8; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
          await new Promise(r => setTimeout(r, 8));
        }
        await new Promise(r => setTimeout(r, 300));
        window.removeEventListener('unhandledrejection', rejectionHandler);

        return {
          errorCount: caughtErrors.length,
          errors: caughtErrors,
          pass: caughtErrors.length === 0
        };
      })()
    `);
    record(
      '4.3 Zero Unhandled Promise Rejections (AbortError) during rapid ViewTransition theme toggling',
      unhandledRejectionsCheck.pass,
      `Caught ${unhandledRejectionsCheck.errorCount} unhandled promise rejections: ${JSON.stringify(unhandledRejectionsCheck.errors.slice(0, 3))}`
    );

    // =========================================================================
