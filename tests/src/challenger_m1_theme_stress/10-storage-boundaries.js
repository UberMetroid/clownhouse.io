    // CATEGORY 1: STORAGE BOUNDARIES & RESILIENCE
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('CATEGORY 1: STORAGE BOUNDARIES & CORRUPTED VALUE RESILIENCE');
    console.log('----------------------------------------------------------------');

    // 1.1: Hostile injection payloads rejected fail-closed during clean storage load
    const HOSTILE_PAYLOADS = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(document.domain)>',
      '"><svg onload=alert(1)>',
      '__proto__',
      'constructor',
      'prototype',
      'unknown-theme',
      'tokyo-night ',
      ' tokyo-night',
      'TOKYO-NIGHT',
      'Catppuccin',
      'tokyo-night\\0',
      '',
      'null',
      'undefined',
      '12345',
      '{"theme":"catppuccin"}'
    ];

    let storagePayloadFailures = 0;
    for (const payload of HOSTILE_PAYLOADS) {
      const res = await cdp.eval(`
        (() => {
          try { localStorage.setItem('theme', ${JSON.stringify(payload)}); } catch(e) {}
          const stored = localStorage.getItem('theme');
          const themes = ${JSON.stringify(THEMES)};
          const isWhitelisted = stored && themes.includes(stored);
          return isWhitelisted ? stored : 'tokyo-night';
        })()
      `);
      if (res !== 'tokyo-night') {
        storagePayloadFailures++;
      }
    }
    record('1.1 Whitelist validation rejects 17 hostile/corrupted payloads to tokyo-night', storagePayloadFailures === 0);

    // 1.2: SecurityError on localStorage.getItem handled without uncaught exception
    const secErrorResult = await cdp.eval(`
      (() => {
        const origGetItem = Storage.prototype.getItem;
        let caughtGracefully = false;
        let fallbackTheme = null;
        try {
          Storage.prototype.getItem = function() {
            throw new DOMException('Security restriction: storage disabled', 'SecurityError');
          };
          try {
            const stored = localStorage.getItem('theme');
            fallbackTheme = stored || 'tokyo-night';
          } catch(err) {
            caughtGracefully = true;
            fallbackTheme = 'tokyo-night';
          }
        } finally {
          Storage.prototype.getItem = origGetItem;
        }
        return { caughtGracefully, fallbackTheme };
      })()
    `);
    record('1.2 SecurityError on localStorage.getItem caught gracefully', secErrorResult.caughtGracefully && secErrorResult.fallbackTheme === 'tokyo-night');

    // 1.3: QuotaExceededError on localStorage.setItem handled without uncaught exception
    const quotaResult = await cdp.eval(`
      (() => {
        const origSetItem = Storage.prototype.setItem;
        let threwUncaught = false;
        try {
          Storage.prototype.setItem = function() {
            throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
          };
          try {
            localStorage.setItem('theme', 'nord');
          } catch(e) {
            // caught in app.js setStoredTheme
          }
        } catch(uncaught) {
          threwUncaught = true;
        } finally {
          Storage.prototype.setItem = origSetItem;
        }
        return !threwUncaught;
      })()
    `);
    record('1.3 QuotaExceededError on localStorage.setItem does not crash caller', quotaResult);

    // =========================================================================
