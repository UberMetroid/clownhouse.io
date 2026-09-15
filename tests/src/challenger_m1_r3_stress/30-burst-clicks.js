    // SECTION 3: RAPID BURST CLICKS & KEYBOARD STRESS
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: BURST CLICKS & RAPID KEYBOARD ACTIVATION');
    console.log('----------------------------------------------------------------');

    const burstClicksTest = await cdp.eval(`
      (async () => {
        let uncaughtErrors = [];
        const errHandler = (e) => uncaughtErrors.push(e.message || String(e));
        window.addEventListener('error', errHandler);

        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => e.preventDefault();
        card.addEventListener('click', clickWatcher);

        // Burst 50 clicks in rapid succession
        const start = performance.now();
        for (let i = 0; i < 50; i++) {
          card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
        const elapsed = performance.now() - start;

        await new Promise(r => setTimeout(r, 50));
        card.removeEventListener('click', clickWatcher);
        window.removeEventListener('error', errHandler);

        return {
          elapsedMs: elapsed,
          errors: uncaughtErrors,
          pass: uncaughtErrors.length === 0
        };
      })()
    `);
    record(
      '3.1 Rapid burst of 50 clicks executes safely with 0 uncaught exceptions',
      burstClicksTest.pass,
      `elapsed: ${burstClicksTest.elapsedMs}ms, errors: ${JSON.stringify(burstClicksTest.errors)}`
    );

    const burstKeyboardTest = await cdp.eval(`
      (async () => {
        let uncaughtErrors = [];
        const errHandler = (e) => uncaughtErrors.push(e.message || String(e));
        window.addEventListener('error', errHandler);

        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => e.preventDefault();
        card.addEventListener('click', clickWatcher);

        // Burst 50 Space keydown events
        const start = performance.now();
        for (let i = 0; i < 50; i++) {
          card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
        }
        const elapsed = performance.now() - start;

        await new Promise(r => setTimeout(r, 50));
        card.removeEventListener('click', clickWatcher);
        window.removeEventListener('error', errHandler);

        return {
          elapsedMs: elapsed,
          errors: uncaughtErrors,
          pass: uncaughtErrors.length === 0
        };
      })()
    `);
    record(
      '3.2 Rapid burst of 50 Space keypresses executes safely with 0 uncaught exceptions',
      burstKeyboardTest.pass,
      `elapsed: ${burstKeyboardTest.elapsedMs}ms, errors: ${JSON.stringify(burstKeyboardTest.errors)}`
    );

    // =========================================================================
