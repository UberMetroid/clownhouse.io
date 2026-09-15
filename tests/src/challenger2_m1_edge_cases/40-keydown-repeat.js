    // CATEGORY 3: RAPID KEYDOWN HOLDING & AUTO-REPEAT SUPPRESSION (e.repeat)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 3: RAPID KEYDOWN HOLDING & AUTO-REPEAT SUPPRESSION (e.repeat)');
    console.log('----------------------------------------------------------------');

    // Reset theme to tokyo-night
    await cdp.eval(`window.ClownTheme.setTheme('tokyo-night')`);

    // 3.1: Initial keydown with repeat: false advances theme by 1
    const initialKeyResult = await cdp.eval(`
      (() => {
        const ev = new KeyboardEvent('keydown', {
          key: 't',
          code: 'KeyT',
          bubbles: true,
          cancelable: true,
          repeat: false
        });
        window.dispatchEvent(ev);
        return window.ClownTheme.getCurrentTheme();
      })()
    `);
    record(
      '3.1 Initial keydown (repeat: false) advances theme to catppuccin',
      initialKeyResult === 'catppuccin',
      `Got: ${initialKeyResult}`
    );

    // 3.2: 100 sustained auto-repeat keydown events (e.repeat = true) are strictly suppressed!
    const sustainedHoldingResult = await cdp.eval(`
      (() => {
        const startTheme = window.ClownTheme.getCurrentTheme(); // 'catppuccin'
        let cyclesDetected = 0;

        // Listen for any themechange event
        const listener = () => { cyclesDetected++; };
        window.addEventListener('themechange', listener);

        // Fire 100 repeated keydown events simulating holding key 'T'
        for (let i = 0; i < 100; i++) {
          const repeatEv = new KeyboardEvent('keydown', {
            key: 't',
            code: 'KeyT',
            bubbles: true,
            cancelable: true,
            repeat: true
          });
          window.dispatchEvent(repeatEv);
        }

        window.removeEventListener('themechange', listener);

        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          startTheme,
          endTheme,
          cyclesDetected,
          suppressed: (startTheme === endTheme && cyclesDetected === 0)
        };
      })()
    `);
    record(
      '3.2 Sustained keydown hold (100x e.repeat=true) strictly suppressed (0 theme cycles)',
      sustainedHoldingResult.suppressed === true,
      JSON.stringify(sustainedHoldingResult)
    );

    // 3.3: Release and next distinct keypress (repeat: false) advances to gruvbox
    const nextDistinctKeyResult = await cdp.eval(`
      (() => {
        const ev = new KeyboardEvent('keydown', {
          key: 't',
          code: 'KeyT',
          bubbles: true,
          cancelable: true,
          repeat: false
        });
        window.dispatchEvent(ev);
        return window.ClownTheme.getCurrentTheme();
      })()
    `);
    record(
      '3.3 Next distinct keypress (repeat: false) advances to gruvbox',
      nextDistinctKeyResult === 'gruvbox',
      `Got: ${nextDistinctKeyResult}`
    );

    // 3.4: Uppercase 'T' with e.repeat = true is also strictly suppressed
    const uppercaseRepeatResult = await cdp.eval(`
      (() => {
        for (let i = 0; i < 50; i++) {
          const ev = new KeyboardEvent('keydown', {
            key: 'T',
            code: 'KeyT',
            bubbles: true,
            cancelable: true,
            repeat: true
          });
          window.dispatchEvent(ev);
        }
        return window.ClownTheme.getCurrentTheme() === 'gruvbox';
      })()
    `);
    record(
      '3.4 Uppercase "T" holding (50x e.repeat=true) strictly suppressed',
      uppercaseRepeatResult === true
    );

    // 3.5: Holding 'T' inside an <input> is suppressed regardless of repeat status
    const inputHoldResult = await cdp.eval(`
      (() => {
        const input = document.getElementById('palette-input');
        if (!input) return false;
        input.focus();

        const before = window.ClownTheme.getCurrentTheme();
        // Dispatch both non-repeat and repeat inside input
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', repeat: false, bubbles: true }));
        for (let i = 0; i < 20; i++) {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', repeat: true, bubbles: true }));
        }
        const after = window.ClownTheme.getCurrentTheme();
        return before === after;
      })()
    `);
    record(
      '3.5 Holding "T" inside <input> strictly suppressed from theme cycling',
      inputHoldResult === true
    );

    // 3.6: Holding 'T' while Command Palette modal is open is suppressed
    const modalOpenHoldResult = await cdp.eval(`
      (() => {
        window.ClownPalette.open();
        const before = window.ClownTheme.getCurrentTheme();

        for (let i = 0; i < 30; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', repeat: false, bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', repeat: true, bubbles: true }));
        }

        const after = window.ClownTheme.getCurrentTheme();
        window.ClownPalette.close();
        return before === after;
      })()
    `);
    record(
      '3.6 Single-key "T" events strictly suppressed while palette modal is open',
      modalOpenHoldResult === true
    );

    // =========================================================================
