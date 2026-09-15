async function runExtendedStressVerification() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // CHALLENGER 1 EXTENDED EMPIRICAL STRESS SUITE');
  console.log('Milestone M1 Iteration 2: Double/Triple Tap & Synchronous Contract');
  console.log('================================================================\n');

  let server = null;
  let chromeInstance = null;
  let chromeTmpDir = null;
  let cdp = null;

  try {
    const serverObj = await startStaticServer();
    server = serverObj.server;
    const serverPort = serverObj.port;
    const chromeData = await launchChrome(serverPort);
    chromeInstance = chromeData.chrome;
    chromeTmpDir = chromeData.tmpDir;
    cdp = new CdpClient(chromeData.wsUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/index.html` });
    
    // Wait for window.ClownTheme and DOM ready
    let isReady = false;
    for (let i = 0; i < 50; i++) {
      try {
        const check = await cdp.eval('typeof window.ClownTheme !== "undefined" && typeof window.ClownTheme.setTheme === "function"');
        if (check) {
          isReady = true;
          break;
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 100));
    }
    if (!isReady) throw new Error('window.ClownTheme failed to initialize within 5s');

    // =========================================================================
    // SECTION 1: SYNCHRONOUS CONTRACT EMPIRICAL VERIFICATION
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: SYNCHRONOUS STATE & DOM CONTRACT INVARIANTS');
    console.log('----------------------------------------------------------------');

    // Test 1.1: Immediate state contract for multiple consecutive transitions
    const syncImmediateMulti = await cdp.eval(`
      (() => {
        const checks = [];
        const targets = ['catppuccin', 'nord', 'ethereal', 'tokyo-night'];
        for (const target of targets) {
          window.ClownTheme.setTheme(target);
          const current = window.ClownTheme.getCurrentTheme();
          const dom = document.documentElement.getAttribute('data-theme');
          const meta = document.getElementById('theme-color-meta').getAttribute('content');
          const label = document.getElementById('theme-btn-label').textContent;
          const stored = localStorage.getItem('theme');
          checks.push({
            target,
            currentMatches: current === target,
            domMatches: dom === target,
            metaMatches: !!meta,
            labelMatches: label === target,
            storedMatches: stored === target
          });
        }
        const allPass = checks.every(c => c.currentMatches && c.domMatches && c.metaMatches && c.labelMatches && c.storedMatches);
        return { allPass, checks };
      })()
    `);
    record('1.1 Immediate synchronous update across 5 properties for 4 consecutive setTheme calls', syncImmediateMulti.allPass, JSON.stringify(syncImmediateMulti.checks));

    // Test 1.2: Event dispatch occurs synchronously
    const syncEventDispatch = await cdp.eval(`
      (() => {
        let eventFired = false;
        let eventTheme = null;
        const handler = (e) => {
          eventFired = true;
          eventTheme = e.detail && e.detail.theme;
        };
        window.addEventListener('themechange', handler, { once: true });
        window.ClownTheme.setTheme('gruvbox');
        return { eventFired, eventTheme, pass: eventFired && eventTheme === 'gruvbox' };
      })()
    `);
    record('1.2 Themechange CustomEvent dispatched synchronously with correct detail.theme', syncEventDispatch.pass, `fired=${syncEventDispatch.eventFired}, theme=${syncEventDispatch.eventTheme}`);

    // =========================================================================
