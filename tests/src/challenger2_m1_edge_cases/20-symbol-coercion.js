    // CATEGORY 1: SYMBOL COERCION & EXOTIC TYPE HARDENING IN setTheme()
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('CATEGORY 1: SYMBOL COERCION & EXOTIC TYPE HARDENING IN setTheme()');
    console.log('----------------------------------------------------------------');

    // 1.1: setTheme(Symbol('foo')) fallback to 'tokyo-night' without throwing TypeError
    const symbolFooResult = await cdp.eval(`
      (() => {
        try {
          window.ClownTheme.setTheme('gruvbox');
          // Dispatch Symbol
          window.ClownTheme.setTheme(Symbol('foo'));
          const current = window.ClownTheme.getCurrentTheme();
          const domAttr = document.documentElement.getAttribute('data-theme');
          const stored = localStorage.getItem('theme');
          return {
            current,
            domAttr,
            stored,
            success: (current === 'tokyo-night' && domAttr === 'tokyo-night' && stored === 'tokyo-night')
          };
        } catch (err) {
          return { error: err.message, stack: err.stack };
        }
      })()
    `);
    record(
      '1.1 setTheme(Symbol("foo")) safely falls back to tokyo-night without TypeError',
      symbolFooResult.success === true,
      JSON.stringify(symbolFooResult)
    );

    // 1.2: setTheme(Symbol()) (unnamed symbol) fallback
    const unnamedSymbolResult = await cdp.eval(`
      (() => {
        try {
          window.ClownTheme.setTheme('nord');
          window.ClownTheme.setTheme(Symbol());
          return window.ClownTheme.getCurrentTheme() === 'tokyo-night';
        } catch (err) {
          return false;
        }
      })()
    `);
    record(
      '1.2 setTheme(Symbol()) safely falls back to tokyo-night',
      unnamedSymbolResult === true
    );

    // 1.3: setTheme(Symbol.for('catppuccin')) fallback (symbol with matching theme name)
    const registeredSymbolResult = await cdp.eval(`
      (() => {
        try {
          window.ClownTheme.setTheme('rose-pine');
          window.ClownTheme.setTheme(Symbol.for('catppuccin'));
          // Must fallback to tokyo-night because Symbol is not a string
          return window.ClownTheme.getCurrentTheme() === 'tokyo-night';
        } catch (err) {
          return false;
        }
      })()
    `);
    record(
      '1.3 setTheme(Symbol.for("catppuccin")) safely rejects non-string symbol to tokyo-night',
      registeredSymbolResult === true
    );

    // 1.4: Hostile object with throwing toString / valueOf traps
    const throwingObjectResult = await cdp.eval(`
      (() => {
        try {
          window.ClownTheme.setTheme('ethereal');
          const trapObj = {
            toString() { throw new Error('Hostile toString Trap'); },
            valueOf() { throw new Error('Hostile valueOf Trap'); }
          };
          window.ClownTheme.setTheme(trapObj);
          return window.ClownTheme.getCurrentTheme() === 'tokyo-night';
        } catch (err) {
          return false;
        }
      })()
    `);
    record(
      '1.4 setTheme({ toString() { throw Error } }) handles throwing traps gracefully',
      throwingObjectResult === true
    );

    // 1.5: Comprehensive Exotic Types Matrix: null, undefined, 42, true, ['nord'], {}
    const exoticMatrixResult = await cdp.eval(`
      (() => {
        const testValues = [
          null,
          undefined,
          42,
          NaN,
          Infinity,
          true,
          false,
          ['nord'],
          { theme: 'nord' },
          () => 'tokyo-night',
          new Date(),
          /tokyo-night/
        ];
        let passes = 0;
        for (const val of testValues) {
          try {
            window.ClownTheme.setTheme('vantablack');
            window.ClownTheme.setTheme(val);
            if (window.ClownTheme.getCurrentTheme() === 'tokyo-night' &&
                document.documentElement.getAttribute('data-theme') === 'tokyo-night') {
              passes++;
            }
          } catch (e) {
            // failed
          }
        }
        return { passes, total: testValues.length };
      })()
    `);
    record(
      `1.5 Exotic Types Matrix: all ${exoticMatrixResult.total} types fail-closed to tokyo-night`,
      exoticMatrixResult.passes === exoticMatrixResult.total,
      `Passes: ${exoticMatrixResult.passes}/${exoticMatrixResult.total}`
    );

    // 1.6: Legacy namespace window.clownhouse.setTheme(Symbol('legacy'))
    const legacyNamespaceResult = await cdp.eval(`
      (() => {
        try {
          window.clownhouse.setTheme('gruvbox');
          window.clownhouse.setTheme(Symbol('legacy'));
          return window.clownhouse.getActiveTheme() === 'tokyo-night';
        } catch (err) {
          return false;
        }
      })()
    `);
    record(
      '1.6 Legacy namespace window.clownhouse.setTheme(Symbol) enforces identical fallback',
      legacyNamespaceResult === true
    );

    // =========================================================================
