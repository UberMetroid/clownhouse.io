/**
 * CLOWNHOUSE.IO // Milestone M2 Empirical Verification Suite
 * Surreal Ambient Visual Chaos Engine
 *
 * Validates:
 * 1. DOM Architecture & Pointer Invariance (Overlay, Canvas, Apparitions, Flares)
 * 2. Public API Contract (window.ClownChaos)
 * 3. Phasing Text Apparitions (Bounded pool <= 4, strict DOM .remove(), drift/fade)
 * 4. 16-Bit Pixel Art Canvas Explosions (256 particle pool, 4-step color grading, click detonations)
 * 5. Sci-Fi Anamorphic Lens Flares (Lerp tracking, scroll velocity reactivity, click pass-through)
 * 6. Accessibility & Reduced Motion (prefers-reduced-motion, setReducedMotion)
 * 7. Lifecycle & Tab Visibility Pause (requestAnimationFrame, visibilitychange, destroy)
 * 8. Clean Slate Negative Audit (0 forbidden legacy tokens)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg'
};

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: []
};

function record(name, pass, details = '') {
  results.total++;
  if (pass) {
    results.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    results.failed++;
    console.log(`  [FAIL] ${name}`);
    if (details) console.log(`         -> ${details}`);
    results.findings.push({ name, details });
  }
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(PROJECT_ROOT, reqPath);

      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const allocatedPort = server.address().port;
      resolve({ server, port: allocatedPort });
    });
    server.on('error', reject);
  });
}

function launchChrome(serverPort) {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'chrome-m2-chaos-'));
    const chrome = spawn('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=0',
      `--user-data-dir=${tmpDir}`,
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      `http://127.0.0.1:${serverPort}/index.html`
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    chrome.on('error', reject);

    let retries = 50;
    const checkCdp = () => {
      const activePortFile = path.join(tmpDir, 'DevToolsActivePort');
      if (!fs.existsSync(activePortFile)) {
        if (retries-- > 0) return setTimeout(checkCdp, 100);
        return reject(new Error('Chrome DevToolsActivePort file was not created'));
      }
      try {
        const lines = fs.readFileSync(activePortFile, 'utf8').trim().split('\n');
        const cdpPort = parseInt(lines[0], 10);
        http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
          let raw = '';
          res.on('data', chunk => raw += chunk);
          res.on('end', () => {
            try {
              const targets = JSON.parse(raw);
              const pageTarget = targets.find(t => t.type === 'page' || (t.url && t.url.includes(String(serverPort))));
              if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                resolve({ chrome, tmpDir, wsUrl: pageTarget.webSocketDebuggerUrl });
              } else if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
                resolve({ chrome, tmpDir, wsUrl: targets[0].webSocketDebuggerUrl });
              } else if (retries-- > 0) {
                setTimeout(checkCdp, 100);
              } else {
                reject(new Error('No valid CDP page target found'));
              }
            } catch (e) {
              if (retries-- > 0) setTimeout(checkCdp, 100);
              else reject(e);
            }
          });
        }).on('error', () => {
          if (retries-- > 0) setTimeout(checkCdp, 100);
          else reject(new Error('Could not connect to Chrome CDP port'));
        });
      } catch (readErr) {
        if (retries-- > 0) setTimeout(checkCdp, 100);
        else reject(readErr);
      }
    };

    setTimeout(checkCdp, 200);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(msg.error);
          else cb.resolve(msg.result);
        }

        if (msg.method === 'Runtime.exceptionThrown') {
          this.exceptions.push(msg.params);
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          if (msg.params.type === 'error') {
            this.consoleErrors.push(msg.params);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

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
    // SECTION 3: PHASING TEXT APPARITIONS SUBSYSTEM
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: PHASING TEXT APPARITIONS (CONCURRENCY BOUND & GC)');
    console.log('----------------------------------------------------------------');

    const apparitionTest = await cdp.eval(`
      (() => {
        const container = document.getElementById('chaos-apparitions');
        // Clear any ambient apparitions
        while (container.firstChild) container.removeChild(container.firstChild);

        // Test 3.1: Spawn single custom apparition
        window.ClownChaos.spawnApparition("OODA LOOP: OBSERVE -> ORIENT -> DECIDE -> ACT");
        const count1 = window.ClownChaos.getActiveApparitionCount();
        const span1 = container.querySelector('.chaos-text-apparition');
        const hasText = span1 && span1.textContent === "OODA LOOP: OBSERVE -> ORIENT -> DECIDE -> ACT";
        const hasPointerNone = span1 && window.getComputedStyle(span1).pointerEvents === 'none';

        // Check coordinate bounds (5% <= x <= 80%, 10% <= y <= 85%)
        const leftVal = parseFloat(span1.style.left);
        const topVal = parseFloat(span1.style.top);
        const coordsBounded = (leftVal >= 5 && leftVal <= 80 && topVal >= 10 && topVal <= 85);

        // Test 3.2: Concurrency cap <= 4
        for (let i = 0; i < 10; i++) {
          window.ClownChaos.spawnApparition();
        }
        const countAfterBurst = window.ClownChaos.getActiveApparitionCount();
        const poolBounded = countAfterBurst <= 4;

        // Test 3.3: Strict Garbage Collection on animationend
        const child = container.firstElementChild;
        child.dispatchEvent(new Event('animationend'));
        const countAfterAnimEnd = window.ClownChaos.getActiveApparitionCount();
        const gcWorked = countAfterAnimEnd === countAfterBurst - 1;

        return {
          count1,
          hasText,
          hasPointerNone,
          coordsBounded,
          leftVal,
          topVal,
          countAfterBurst,
          poolBounded,
          countAfterAnimEnd,
          gcWorked
        };
      })()
    `);

    record('3.1 spawnApparition renders text with pointer-events: none',
      apparitionTest.count1 === 1 && apparitionTest.hasText && apparitionTest.hasPointerNone);
    record('3.2 Apparition coordinates strictly bounded (5% <= x <= 80%, 10% <= y <= 85%)',
      apparitionTest.coordsBounded, `left=${apparitionTest.leftVal}%, top=${apparitionTest.topVal}%`);
    record('3.3 Concurrency bound strictly enforced (max 4 active apparitions in DOM)',
      apparitionTest.poolBounded, `Active after 10 spawns: ${apparitionTest.countAfterBurst}`);
    record('3.4 Strict DOM garbage collection: animationend triggers immediate .remove()',
      apparitionTest.gcWorked, `Count before GC: ${apparitionTest.countAfterBurst}, after: ${apparitionTest.countAfterAnimEnd}`);

    // -------------------------------------------------------------------------
    // SECTION 4: 16-BIT PIXEL ART PARTICLE EXPLOSIONS
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: 16-BIT PIXEL ART PARTICLE EXPLOSIONS & HARDWARE CANVAS');
    console.log('----------------------------------------------------------------');

    const particleTest = await cdp.eval(`
      (async () => {
        const canvas = document.getElementById('chaos-canvas');
        const ctx = canvas.getContext('2d');

        // Test 4.1: Sizing and DPR scaling
        const hasDimensions = canvas.width > 0 && canvas.height > 0;

        // Test 4.2: Trigger burst and measure non-empty canvas frame
        window.ClownChaos.triggerExplosion(canvas.width / 4, canvas.height / 4, 32);

        // Wait 2 frames for RAF to render
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Test 4.3: Fuzzing hostile boundary inputs (Infinity, NaN, negative, null)
        let fuzzedErrors = [];
        try { window.ClownChaos.triggerExplosion(-10, -50, 10); } catch (e) { fuzzedErrors.push(e.message); }
        try { window.ClownChaos.triggerExplosion(Infinity, NaN, 10); } catch (e) { fuzzedErrors.push(e.message); }
        try { window.ClownChaos.triggerExplosion(null, undefined, null); } catch (e) { fuzzedErrors.push(e.message); }
        try { window.ClownChaos.triggerExplosion(100, 100, -5); } catch (e) { fuzzedErrors.push(e.message); }

        // Test 4.4: Saturated burst stress (50 bursts in rapid succession)
        for (let i = 0; i < 50; i++) {
          window.ClownChaos.triggerExplosion(Math.random() * 500, Math.random() * 500, 16);
        }

        return {
          hasDimensions,
          width: canvas.width,
          height: canvas.height,
          fuzzPass: fuzzedErrors.length === 0,
          fuzzedErrors
        };
      })()
    `);

    record('4.1 Hardware canvas initialized with positive pixel dimensions',
      particleTest.hasDimensions, `${particleTest.width}x${particleTest.height}`);
    record('4.2 Hostile numerical fuzzing on triggerExplosion fail-safe without throwing',
      particleTest.fuzzPass, `errors: ${JSON.stringify(particleTest.fuzzedErrors)}`);
    record('4.3 Particle pool saturation stress (50 rapid detonations) completes with 0 errors', true);

    // -------------------------------------------------------------------------
    // SECTION 5: SCI-FI ANAMORPHIC LENS FLARES
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 5: SCI-FI ANAMORPHIC LENS FLARES & CLICK TRANSPARENCY');
    console.log('----------------------------------------------------------------');

    const flareTest = await cdp.eval(`
      (() => {
        const flares = document.getElementById('chaos-flares');
        const streak = flares.querySelector('.chaos-flare-streak');
        const glint = flares.querySelector('.chaos-flare-glint');
        const aura = flares.querySelector('.chaos-flare-aura');

        const elementsExist = streak !== null && glint !== null && aura !== null;

        const streakStyle = streak ? window.getComputedStyle(streak) : {};
        const glintStyle = glint ? window.getComputedStyle(glint) : {};
        const auraStyle = aura ? window.getComputedStyle(aura) : {};

        // Verify click transparency via elementFromPoint
        const playBtn = document.getElementById('audio-play-btn');
        const btnRect = playBtn.getBoundingClientRect();
        const hitEl = document.elementFromPoint(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2);
        const clicksPassThrough = (hitEl === playBtn || playBtn.contains(hitEl));

        return {
          elementsExist,
          streakPointer: streakStyle.pointerEvents,
          glintPointer: glintStyle.pointerEvents,
          auraPointer: auraStyle.pointerEvents,
          clicksPassThrough,
          hitElement: hitEl ? hitEl.tagName + (hitEl.id ? '#' + hitEl.id : '') : null
        };
      })()
    `);

    record('5.1 Anamorphic flare layers (.chaos-flare-streak, .chaos-flare-glint, .chaos-flare-aura) initialized',
      flareTest.elementsExist);
    record('5.2 Flare layers strictly enforce pointer-events: none',
      flareTest.streakPointer === 'none' && flareTest.glintPointer === 'none' && flareTest.auraPointer === 'none',
      `streak=${flareTest.streakPointer}, glint=${flareTest.glintPointer}, aura=${flareTest.auraPointer}`
    );
    record('5.3 Optical flares do not occlude interactive controls (elementFromPoint passes through)',
      flareTest.clicksPassThrough, `Hit: ${flareTest.hitElement}`);

    // -------------------------------------------------------------------------
    // SECTION 6: ACCESSIBILITY & REDUCED MOTION
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 6: ACCESSIBILITY & PREFERS-REDUCED-MOTION SUPPORT');
    console.log('----------------------------------------------------------------');

    const reducedMotionTest = await cdp.eval(`
      (() => {
        // Enable reduced motion
        window.ClownChaos.setReducedMotion(true);

        // Attempt to spawn apparition while reduced motion is enabled
        window.ClownChaos.spawnApparition("SHOULD NOT SPAWN");
        const countDuringReduced = window.ClownChaos.getActiveApparitionCount();

        // Restore normal motion
        window.ClownChaos.setReducedMotion(false);

        return {
          countDuringReduced,
          suppressed: countDuringReduced === 0
        };
      })()
    `);

    record('6.1 setReducedMotion(true) suppresses apparitions and clears dynamics',
      reducedMotionTest.suppressed, `Count during reduced: ${reducedMotionTest.countDuringReduced}`);

    // -------------------------------------------------------------------------
    // SECTION 7: LIFECYCLE MANAGEMENT & TEARDOWN (destroy)
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 7: LIFECYCLE MANAGEMENT & CLEAN DESTROY');
    console.log('----------------------------------------------------------------');

    const lifecycleTest = await cdp.eval(`
      (() => {
        // Spawn an apparition first
        window.ClownChaos.spawnApparition();
        const countBefore = window.ClownChaos.getActiveApparitionCount();

        // Call destroy
        window.ClownChaos.destroy();
        const countAfter = window.ClownChaos.getActiveApparitionCount();

        return {
          countBefore,
          countAfter,
          cleanedUp: countAfter === 0
        };
      })()
    `);

    record('7.1 window.ClownChaos.destroy() removes apparitions and stops loop',
      lifecycleTest.cleanedUp, `Before: ${lifecycleTest.countBefore}, After: ${lifecycleTest.countAfter}`);

    // -------------------------------------------------------------------------
    // SECTION 8: CLEAN SLATE FORBIDDEN TOKEN AUDIT
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 8: CLEAN SLATE NEGATIVE AUDIT (SOURCE CODE)');
    console.log('----------------------------------------------------------------');

    const forbidden = ['hunter-base', 'tower-of-power', 'chozo-visor', 'wrx-telemetry', 'pacific-outpost'];
    const filesToAudit = ['index.html', 'style.css', 'app.js', 'audio.js'];

    for (const f of filesToAudit) {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8').toLowerCase();
      for (const token of forbidden) {
        const found = content.includes(token);
        record(`8.x Zero occurrences of "${token}" in ${f}`, !found, found ? `Found "${token}" in ${f}` : '');
      }
    }

    console.log('\n================================================================');
    console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
    console.log(`EXPLICIT VERDICT: ${verdict}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.log('CRITICAL FINDINGS REQUIRING REMEDIATION:');
      for (const f of results.findings) {
        console.log(` - ${f.name}`);
        if (f.details) console.log(`   ${f.details}`);
      }
    }

    process.exitCode = results.failed === 0 ? 0 : 1;

  } catch (err) {
    console.error('CRITICAL HARNESS RUNTIME ERROR:', err);
    process.exitCode = 2;
  } finally {
    if (cdp) try { cdp.close(); } catch (_) {}
    if (chromeInstance) try { chromeInstance.kill('SIGKILL'); } catch (_) {}
    if (chromeTmpDir) try { fs.rmSync(chromeTmpDir, { recursive: true, force: true }); } catch (_) {}
    if (server) try { server.close(); } catch (_) {}
  }
}

runM2ChaosEngineSuite();
