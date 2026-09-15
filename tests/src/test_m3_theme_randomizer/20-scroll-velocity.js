    // --- SECTION 3: Trigger 2 Scroll Velocity & Stop Detector ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: TRIGGER 2 (SCROLL VELOCITY, STOP DETECTOR & 4.0s COOLDOWN)');
    console.log('----------------------------------------------------------------');

    // 3.1 Slow scroll (Vs < 1.8 px/ms) followed by stop does NOT trigger theme change
    const slowScrollCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('rose-pine');
        const initialTheme = window.ClownTheme.getCurrentTheme();

        // Simulate slow scrolling: 50px over 100ms => Vs = 0.5 px/ms (< 1.8)
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 10, time: t0 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 30, time: t0 + 50 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 50, time: t0 + 100 } }));

        // Wait for stop duration (200ms > 150ms)
        await new Promise(r => setTimeout(r, 220));

        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          initialTheme,
          endTheme,
          didNotChange: initialTheme === endTheme
        };
      })()
    `);
    record('3.1 Slow scroll (Vs = 0.5 px/ms < 1.8) does not trigger theme change', slowScrollCheck.didNotChange, `initial: ${slowScrollCheck.initialTheme}, end: ${slowScrollCheck.endTheme}`);

    // 3.2 Rapid scroll flick (Vs > 1.8 px/ms) followed by stop (> 150ms) triggers randomTheme()
    const rapidFlickCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('catppuccin');
        const initialTheme = window.ClownTheme.getCurrentTheme();

        // Simulate rapid flick: 300px over 50ms => Vs = 6.0 px/ms (> 1.8)
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 0, time: t0 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 300, time: t0 + 50 } }));

        // Wait for stop detection: > 150ms of stop
        await new Promise(r => setTimeout(r, 220));

        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          initialTheme,
          endTheme,
          changed: initialTheme !== endTheme
        };
      })()
    `);
    record('3.2 Rapid scroll flick (Vs = 6.0 px/ms > 1.8) followed by stop (>150ms) triggers randomTheme()', rapidFlickCheck.changed, `initial: ${rapidFlickCheck.initialTheme}, end: ${rapidFlickCheck.endTheme}`);

    // 3.3 4.0-Second Anti-Strobe Cooldown: immediate second flick is strictly ignored
    const cooldownCheck = await cdp.eval(`
      (async () => {
        // We just triggered at rapidFlickCheck. Now immediately trigger a second flick at 500ms into cooldown:
        const themeBeforeSecondFlick = window.ClownTheme.getCurrentTheme();

        const t1 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 100, time: t1 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 500, time: t1 + 40 } })); // Vs = 10 px/ms

        // Wait for stop detection (> 150ms)
        await new Promise(r => setTimeout(r, 220));

        const themeAfterSecondFlick = window.ClownTheme.getCurrentTheme();
        return {
          themeBeforeSecondFlick,
          themeAfterSecondFlick,
          cooldownBlocked: themeBeforeSecondFlick === themeAfterSecondFlick
        };
      })()
    `);
    record(
      '3.3 4.0-Second Cooldown: rapid scroll flick within cooldown window is strictly blocked',
      cooldownCheck.cooldownBlocked,
      `before: ${cooldownCheck.themeBeforeSecondFlick}, after: ${cooldownCheck.themeAfterSecondFlick}`
    );

    // 3.4 Reduced motion guard: suppressed under prefers-reduced-motion: reduce
    const reducedMotionScrollCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('nord');
        const startTheme = window.ClownTheme.getCurrentTheme();

        // Mock prefers-reduced-motion: reduce
        const origMatchMedia = window.matchMedia;
        window.matchMedia = (query) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {}
        });

        // Try rapid flick while reduced motion is active
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 0, time: t0 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 600, time: t0 + 40 } })); // Vs = 15 px/ms

        await new Promise(r => setTimeout(r, 220));
        const endTheme = window.ClownTheme.getCurrentTheme();

        window.matchMedia = origMatchMedia;

        return {
          startTheme,
          endTheme,
          suppressed: startTheme === endTheme
        };
      })()
    `);
    record(
      '3.4 prefers-reduced-motion: reduce strictly suppresses scroll-driven theme shifts',
      reducedMotionScrollCheck.suppressed,
      `start: ${reducedMotionScrollCheck.startTheme}, end: ${reducedMotionScrollCheck.endTheme}`
    );

