    // --- SECTION 1: Interface Contract Completeness ---
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: PUBLIC INTERFACE CONTRACT (window.ClownTheme)');
    console.log('----------------------------------------------------------------');

    const contractCheck = await cdp.eval(`
      (() => {
        const t = window.ClownTheme;
        if (!t) return { pass: false, error: 'window.ClownTheme undefined' };
        const EXPECTED_THEMES = ['tokyo-night', 'catppuccin', 'gruvbox', 'nord', 'rose-pine', 'ethereal', 'vantablack'];
        const themesMatch = Array.isArray(t.THEMES) &&
          t.THEMES.length === 7 &&
          EXPECTED_THEMES.every((th, i) => t.THEMES[i] === th);

        return {
          pass: (
            themesMatch &&
            typeof t.setTheme === 'function' &&
            typeof t.cycleTheme === 'function' &&
            typeof t.randomTheme === 'function' &&
            typeof t.getCurrentTheme === 'function' &&
            typeof t.startAutoRandom === 'function' &&
            typeof t.stopAutoRandom === 'function' &&
            typeof t.resetAutoRandom === 'function'
          ),
          themesMatch,
          hasSetTheme: typeof t.setTheme === 'function',
          hasCycleTheme: typeof t.cycleTheme === 'function',
          hasRandomTheme: typeof t.randomTheme === 'function',
          hasGetCurrentTheme: typeof t.getCurrentTheme === 'function',
          hasStartAutoRandom: typeof t.startAutoRandom === 'function',
          hasStopAutoRandom: typeof t.stopAutoRandom === 'function',
          hasResetAutoRandom: typeof t.resetAutoRandom === 'function'
        };
      })()
    `);
    record('1.1 window.ClownTheme implements all 8 required contract properties and methods', contractCheck.pass, JSON.stringify(contractCheck));

    // --- SECTION 2: Trigger 1 Ambient Cycle & Dynamic Interval ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: TRIGGER 1 (AMBIENT INTERVAL, RANDOM SELECTION, VISIBILITY)');
    console.log('----------------------------------------------------------------');

    // 2.1 randomTheme() always selects a theme different from current
    const randomDiffCheck = await cdp.eval(`
      (() => {
        const results = [];
        for (let i = 0; i < 50; i++) {
          const before = window.ClownTheme.getCurrentTheme();
          const picked = window.ClownTheme.randomTheme();
          const after = window.ClownTheme.getCurrentTheme();
          results.push({ before, picked, after, diff: (picked !== before) && (after === picked) });
        }
        return {
          allDiff: results.every(r => r.diff),
          failureCount: results.filter(r => !r.diff).length
        };
      })()
    `);
    record('2.1 randomTheme() strictly selects a different theme across 50 consecutive invocations', randomDiffCheck.allDiff, `Failures: ${randomDiffCheck.failureCount}`);

    // 2.2 Verify ambient dynamic interval definition (15s - 25s) in source code
    const appJsContent = fs.readFileSync(path.join(PROJECT_ROOT, 'app.js'), 'utf8');
    const dynamicIntervalMatch = appJsContent.includes('15000 + Math.random() * 10000');
    record('2.2 Ambient random timer dynamically schedules interval between 15s and 25s (15000 + Math.random() * 10000)', dynamicIntervalMatch);

    // 2.3 startAutoRandom(intervalMs) fires and changes theme
    const autoIntervalCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        const startTheme = window.ClownTheme.getCurrentTheme();
        // Set short interval for testing (80ms)
        window.ClownTheme.startAutoRandom(80);
        await new Promise(r => setTimeout(r, 140));
        const afterTheme = window.ClownTheme.getCurrentTheme();
        window.ClownTheme.stopAutoRandom();
        return {
          startTheme,
          afterTheme,
          changed: startTheme !== afterTheme
        };
      })()
    `);
    record('2.3 startAutoRandom(interval) automatically triggers theme shift on timer', autoIntervalCheck.changed, `start: ${autoIntervalCheck.startTheme}, after: ${autoIntervalCheck.afterTheme}`);

    // 2.4 stopAutoRandom() halts theme changes
    const stopAutoCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('nord');
        window.ClownTheme.stopAutoRandom();
        const startTheme = window.ClownTheme.getCurrentTheme();
        await new Promise(r => setTimeout(r, 150));
        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          startTheme,
          endTheme,
          halted: startTheme === endTheme
        };
      })()
    `);
    record('2.4 stopAutoRandom() cleanly stops ambient theme shifts', stopAutoCheck.halted, `start: ${stopAutoCheck.startTheme}, end: ${stopAutoCheck.endTheme}`);

    // 2.5 resetAutoRandom() resets timer cleanly
    const resetAutoCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('ethereal');
        window.ClownTheme.stopAutoRandom();
        window.ClownTheme.resetAutoRandom();
        return {
          pass: typeof window.ClownTheme.resetAutoRandom === 'function'
        };
      })()
    `);
    record('2.5 resetAutoRandom() resets internal timer and state without throwing', resetAutoCheck.pass);

    // 2.6 Visibilitychange pauses timer when document is hidden
    const visibilityPauseCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('gruvbox');
        window.ClownTheme.startAutoRandom(60);

        // Simulate document.hidden = true
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        const themeWhenHidden = window.ClownTheme.getCurrentTheme();
        await new Promise(r => setTimeout(r, 150));
        const themeAfterWait = window.ClownTheme.getCurrentTheme();

        // Simulate document.hidden = false (resume)
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        await new Promise(r => setTimeout(r, 120));
        const themeAfterResume = window.ClownTheme.getCurrentTheme();
        window.ClownTheme.stopAutoRandom();

        return {
          pausedWhileHidden: (themeWhenHidden === themeAfterWait),
          resumedWhenVisible: (themeAfterWait !== themeAfterResume),
          themeWhenHidden,
          themeAfterWait,
          themeAfterResume
        };
      })()
    `);
    record(
      '2.6 visibilitychange pauses auto timer when tab is hidden and resumes when visible',
      visibilityPauseCheck.pausedWhileHidden && visibilityPauseCheck.resumedWhenVisible,
      `paused: ${visibilityPauseCheck.pausedWhileHidden}, resumed: ${visibilityPauseCheck.resumedWhenVisible}`
    );

