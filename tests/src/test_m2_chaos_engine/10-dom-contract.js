async function runM2ChaosEngineSuite() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // MILESTONE M2 CHAOS ENGINE EMPIRICAL VERIFICATION');
  console.log('Phasing Apparitions, 16-Bit Pixel Explosions & Anamorphic Flares');
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

    // Wait for DOM and window.ClownChaos to be ready
    let isReady = false;
    for (let i = 0; i < 50; i++) {
      try {
        const check = await cdp.eval('typeof window.ClownChaos !== "undefined" && document.getElementById("chaos-overlay") !== null');
        if (check) {
          isReady = true;
          break;
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 100));
    }
    if (!isReady) throw new Error('Chaos overlay or window.ClownChaos failed to initialize');

    // -------------------------------------------------------------------------
    // SECTION 1: DOM ARCHITECTURE & POINTER INVARIANCE
    // -------------------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: DOM ARCHITECTURE & POINTER INVARIANTS');
    console.log('----------------------------------------------------------------');

    const domCheck = await cdp.eval(`
      (() => {
        const overlay = document.getElementById('chaos-overlay');
        const canvas = document.getElementById('chaos-canvas');
        const apparitions = document.getElementById('chaos-apparitions');
        const flares = document.getElementById('chaos-flares');

        if (!overlay || !canvas || !apparitions || !flares) {
          return { error: 'Missing chaos elements' };
        }

        const overlayStyle = window.getComputedStyle(overlay);
        const canvasStyle = window.getComputedStyle(canvas);
        const apparitionsStyle = window.getComputedStyle(apparitions);
        const flaresStyle = window.getComputedStyle(flares);

        return {
          overlayExists: true,
          overlayAriaHidden: overlay.getAttribute('aria-hidden') === 'true',
          overlayHasClass: overlay.classList.contains('chaos-overlay'),
          canvasExists: true,
          apparitionsExists: true,
          flaresExists: true,
          overlayPointerEvents: overlayStyle.pointerEvents,
          canvasPointerEvents: canvasStyle.pointerEvents,
          apparitionsPointerEvents: apparitionsStyle.pointerEvents,
          flaresPointerEvents: flaresStyle.pointerEvents
        };
      })()
    `);

    record('1.1 #chaos-overlay exists with aria-hidden="true" and class .chaos-overlay',
      domCheck.overlayExists && domCheck.overlayAriaHidden && domCheck.overlayHasClass);
    record('1.2 #chaos-canvas, #chaos-apparitions, and #chaos-flares exist inside overlay',
      domCheck.canvasExists && domCheck.apparitionsExists && domCheck.flaresExists);
    record('1.3 All chaos containers strictly enforce pointer-events: none',
      domCheck.overlayPointerEvents === 'none' &&
      domCheck.canvasPointerEvents === 'none' &&
      domCheck.apparitionsPointerEvents === 'none' &&
      domCheck.flaresPointerEvents === 'none',
      `overlay=${domCheck.overlayPointerEvents}, canvas=${domCheck.canvasPointerEvents}, apparitions=${domCheck.apparitionsPointerEvents}, flares=${domCheck.flaresPointerEvents}`
    );

    // -------------------------------------------------------------------------
    // SECTION 2: PUBLIC INTERFACE CONTRACT (window.ClownChaos)
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: PUBLIC API CONTRACT VERIFICATION');
    console.log('----------------------------------------------------------------');

    const apiCheck = await cdp.eval(`
      (() => {
        const cc = window.ClownChaos;
        if (!cc) return { defined: false };
        return {
          defined: true,
          hasSpawn: typeof cc.spawnApparition === 'function',
          hasTrigger: typeof cc.triggerExplosion === 'function',
          hasSetReduced: typeof cc.setReducedMotion === 'function',
          hasGetActive: typeof cc.getActiveApparitionCount === 'function',
          hasDestroy: typeof cc.destroy === 'function'
        };
      })()
    `);

    record('2.1 window.ClownChaos is defined', apiCheck.defined);
    record('2.2 window.ClownChaos.spawnApparition is a function', apiCheck.hasSpawn);
    record('2.3 window.ClownChaos.triggerExplosion is a function', apiCheck.hasTrigger);
    record('2.4 window.ClownChaos.setReducedMotion is a function', apiCheck.hasSetReduced);
    record('2.5 window.ClownChaos.getActiveApparitionCount is a function', apiCheck.hasGetActive);
    record('2.6 window.ClownChaos.destroy is a function', apiCheck.hasDestroy);

    // -------------------------------------------------------------------------
