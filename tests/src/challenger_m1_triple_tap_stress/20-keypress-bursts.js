    // SECTION 2: RAPID DOUBLE, TRIPLE, QUADRUPLE & FULL-CYCLE T KEYPRESSES
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: RAPID KEYPRESS BURSTS (DOUBLE, TRIPLE, 7-CYCLE)');
    console.log('----------------------------------------------------------------');

    // Test 2.1: Rapid Double Keypress: tokyo-night (0) -> gruvbox (2)
    const doublePress = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 80));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));

        await new Promise(r => setTimeout(r, 250));
        const current = window.ClownTheme.getCurrentTheme();
        const dom = document.documentElement.getAttribute('data-theme');
        return { current, dom, pass: current === 'gruvbox' && dom === 'gruvbox' };
      })()
    `);
    record('2.1 Rapid double T-tap advances 2 positions without cycle drop (0 -> 2: gruvbox)', doublePress.pass, `current=${doublePress.current}, dom=${doublePress.dom}`);

    // Test 2.2: Rapid Triple Keypress: tokyo-night (0) -> nord (3)
    const triplePress = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 80));

        // 3 rapid keypresses back-to-back
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));

        await new Promise(r => setTimeout(r, 250));
        const current = window.ClownTheme.getCurrentTheme();
        const dom = document.documentElement.getAttribute('data-theme');
        return { current, dom, pass: current === 'nord' && dom === 'nord' };
      })()
    `);
    record('2.2 Rapid triple T-tap advances 3 positions without cycle drop (0 -> 3: nord)', triplePress.pass, `current=${triplePress.current}, dom=${triplePress.dom}`);

    // Test 2.3: Rapid Quadruple Keypress: tokyo-night (0) -> rose-pine (4)
    const quadPress = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 80));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));

        await new Promise(r => setTimeout(r, 250));
        const current = window.ClownTheme.getCurrentTheme();
        const dom = document.documentElement.getAttribute('data-theme');
        return { current, dom, pass: current === 'rose-pine' && dom === 'rose-pine' };
      })()
    `);
    record('2.3 Rapid quadruple T-tap advances 4 positions without cycle drop (0 -> 4: rose-pine)', quadPress.pass, `current=${quadPress.current}, dom=${quadPress.dom}`);

    // Test 2.4: Rapid Full 7-Cycle Wrap-around: tokyo-night (0) -> 7 taps -> tokyo-night (0)
    const fullCyclePress = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 80));

        for (let i = 0; i < 7; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: (i % 2 === 0 ? 't' : 'T'), bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 300));
        const current = window.ClownTheme.getCurrentTheme();
        const dom = document.documentElement.getAttribute('data-theme');
        return { current, dom, pass: current === 'tokyo-night' && dom === 'tokyo-night' };
      })()
    `);
    record('2.4 Rapid 7-tap mixed-case burst completes full modulo wrap-around (0 -> 7 -> 0: tokyo-night)', fullCyclePress.pass, `current=${fullCyclePress.current}, dom=${fullCyclePress.dom}`);

    // Test 2.5: Auto-repeat suppression: keydown with repeat: true does NOT advance theme
    const repeatCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('gruvbox');
        await new Promise(r => setTimeout(r, 80));

        // Hold keydown: 10 repeated events
        for (let i = 0; i < 10; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', repeat: true, bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 100));
        const current = window.ClownTheme.getCurrentTheme();
        return { current, pass: current === 'gruvbox' };
      })()
    `);
    record('2.5 Keyboard auto-repeat (repeat: true) strictly ignored to prevent strobe runaway', repeatCheck.pass, `current=${repeatCheck.current}`);

    // =========================================================================
