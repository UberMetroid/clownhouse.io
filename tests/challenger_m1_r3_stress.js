/**
 * CLOWNHOUSE.IO // CHALLENGER 1 EMPIRICAL STRESS HARNESS (M1 R3)
 * Adversarial Testing:
 * 1. Stage Card Event Duplication & Burst Stress (Space double-click, duplicate sfx)
 * 2. Audio Prototype Pollution & Hostile Type Safety on window.ClownAudio.playSfx()
 * 3. Rapid Hover Sweeps across All 5 Stage Cards (Audio init & uninit)
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
  '.json': 'application/json'
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
          'Content-Type': MIME_TYPES[ext] || 'text/plain',
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
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'chrome-challenger-m1-r3-'));
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

async function runEmpiricalStressSuite() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // CHALLENGER 1 M1-R3 ADVERSARIAL STRESS HARNESS');
  console.log('Stage-Select Dock, Audio Prototype Pollution & Burst Interactions');
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

    // Wait for DOM and window.ClownAudio to be ready
    let isReady = false;
    for (let i = 0; i < 50; i++) {
      try {
        const check = await cdp.eval('typeof window.ClownAudio !== "undefined" && typeof window.ClownAudio.playSfx === "function" && document.getElementById("stage-select-dock") !== null');
        if (check) {
          isReady = true;
          break;
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 100));
    }
    if (!isReady) throw new Error('Stage-select dock or window.ClownAudio failed to initialize');

    // =========================================================================
    // SECTION 1: DUPLICATE EVENT BINDING & RE-TRIGGERING INVESTIGATION
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: EVENT LISTENER INVARIANTS & DUPLICATE DISPATCH PROBES');
    console.log('----------------------------------------------------------------');

    // Test 1.1: Measure duplicate sound synthesis on hover (Oscillator count)
    const hoverOscTest = await cdp.eval(`
      (async () => {
        let oscCount = 0;
        const origCreateOsc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
          oscCount++;
          return origCreateOsc.apply(this, arguments);
        };

        // Ensure audio context is created
        if (window.ClownAudio.getState().isMuted) {
          window.ClownAudio.toggleMute();
        }

        const card = document.querySelector('.stage-card');
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));

        await new Promise(r => setTimeout(r, 20));
        AudioContext.prototype.createOscillator = origCreateOsc;

        return {
          oscCount,
          pass: oscCount === 1 // Hover SFX is a single oscillator (800Hz -> 1400Hz)
        };
      })()
    `);
    record(
      '1.1 Single stage card mouseenter creates exactly 1 oscillator (no duplicate synthesis)',
      hoverOscTest.pass,
      `Actual oscillators created: ${hoverOscTest.oscCount} (expected 1, got ${hoverOscTest.oscCount} due to dual listener in audio.js + app.js)`
    );

    // Test 1.2: Measure duplicate sound synthesis on click (Oscillator count)
    const clickOscTest = await cdp.eval(`
      (async () => {
        let oscCount = 0;
        const origCreateOsc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
          oscCount++;
          return origCreateOsc.apply(this, arguments);
        };

        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => e.preventDefault();
        card.addEventListener('click', clickWatcher);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        await new Promise(r => setTimeout(r, 20));
        card.removeEventListener('click', clickWatcher);
        AudioContext.prototype.createOscillator = origCreateOsc;

        return {
          oscCount,
          pass: oscCount === 2 // Select SFX is a two-tone chime (1200Hz + 1800Hz) = 2 oscillators
        };
      })()
    `);
    record(
      '1.2 Single stage card click creates exactly 2 oscillators (no duplicate synthesis)',
      clickOscTest.pass,
      `Actual oscillators created: ${clickOscTest.oscCount} (expected 2, got ${clickOscTest.oscCount} due to dual listener in audio.js + app.js)`
    );

    // Test 1.3: Single Space Keydown on Stage Card must trigger at most ONE click event
    const spaceKeyTest = await cdp.eval(`
      (() => {
        let clickEventsFired = 0;
        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => {
          clickEventsFired++;
          e.preventDefault(); // Prevent real navigation in test
        };
        card.addEventListener('click', clickWatcher);

        // Dispatch single Space keydown
        card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));

        card.removeEventListener('click', clickWatcher);

        return {
          clickEventsFired,
          pass: clickEventsFired === 1
        };
      })()
    `);
    record(
      '1.3 Single Space keydown on stage card dispatches exactly 1 click event (no duplicate click execution)',
      spaceKeyTest.pass,
      `Actual click events fired: ${spaceKeyTest.clickEventsFired} (expected 1)`
    );

    // Test 1.4: Single Space Keydown on Stage Card creates at most 2 oscillators
    const spaceOscTest = await cdp.eval(`
      (async () => {
        let oscCount = 0;
        const origCreateOsc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
          oscCount++;
          return origCreateOsc.apply(this, arguments);
        };

        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => e.preventDefault();
        card.addEventListener('click', clickWatcher);

        card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));

        await new Promise(r => setTimeout(r, 20));
        card.removeEventListener('click', clickWatcher);
        AudioContext.prototype.createOscillator = origCreateOsc;

        return {
          oscCount,
          pass: oscCount <= 2
        };
      })()
    `);
    record(
      '1.4 Single Space keydown on stage card creates at most 2 oscillators',
      spaceOscTest.pass,
      `Actual oscillators created: ${spaceOscTest.oscCount} (expected <= 2, got ${spaceOscTest.oscCount})`
    );


    // =========================================================================
    // SECTION 2: AUDIO PROTOTYPE POLLUTION & HOSTILE TYPE TESTING
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: AUDIO PROTOTYPE POLLUTION & HOSTILE TYPE VECTORS');
    console.log('----------------------------------------------------------------');

    const hostileVectorsTest = await cdp.eval(`
      (() => {
        const tests = [];
        const dangerousKeys = [
          '__proto__',
          'constructor',
          'prototype',
          'toString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'toLocaleString',
          '__defineGetter__',
          '__defineSetter__',
          '__lookupGetter__',
          '__lookupSetter__'
        ];

        // 1. Prototype property attacks
        for (const key of dangerousKeys) {
          try {
            const res = window.ClownAudio.playSfx(key);
            tests.push({
              vector: key,
              type: typeof key,
              result: res,
              pass: res === false,
              threw: false
            });
          } catch (err) {
            tests.push({
              vector: key,
              type: typeof key,
              result: null,
              pass: false,
              threw: true,
              error: err.message
            });
          }
        }

        // 2. Hostile primitive & non-string types
        const nonStrings = [
          { name: 'null', val: null },
          { name: 'undefined', val: undefined },
          { name: 'number-0', val: 0 },
          { name: 'number-1', val: 1 },
          { name: 'NaN', val: NaN },
          { name: 'Infinity', val: Infinity },
          { name: 'boolean-true', val: true },
          { name: 'boolean-false', val: false },
          { name: 'object-empty', val: {} },
          { name: 'array-empty', val: [] },
          { name: 'function', val: () => {} },
          { name: 'symbol', val: Symbol('exploit') }
        ];

        for (const item of nonStrings) {
          try {
            const res = window.ClownAudio.playSfx(item.val);
            tests.push({
              vector: item.name,
              type: typeof item.val,
              result: res,
              pass: res === false,
              threw: false
            });
          } catch (err) {
            tests.push({
              vector: item.name,
              type: typeof item.val,
              result: null,
              pass: false,
              threw: true,
              error: err.message
            });
          }
        }

        // 3. Verify Object.prototype was NOT polluted
        const protoPristine = (
          typeof Object.prototype.hover === 'undefined' &&
          typeof Object.prototype.select === 'undefined' &&
          typeof Object.prototype.polluted === 'undefined'
        );

        const allPass = tests.every(t => t.pass) && protoPristine;
        return {
          allPass,
          protoPristine,
          failedCount: tests.filter(t => !t.pass).length,
          failures: tests.filter(t => !t.pass),
          totalTested: tests.length
        };
      })()
    `);
    record(
      `2.1 Hostile type & prototype pollution matrix (${hostileVectorsTest.totalTested} vectors fail-closed without throwing)`,
      hostileVectorsTest.allPass,
      `Failures: ${JSON.stringify(hostileVectorsTest.failures)}`
    );

    // =========================================================================
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
    // SECTION 4: RAPID HOVER SWEEPS ACROSS ALL 5 CARDS
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: RAPID HOVER SWEEPS ACROSS ALL 5 CARDS');
    console.log('----------------------------------------------------------------');

    // 4.1 Rapid hover sweep while audio uninitialized
    const uninitHoverTest = await cdp.eval(`
      (async () => {
        const cards = Array.from(document.querySelectorAll('.stage-card'));
        let errors = [];
        const errHandler = (e) => errors.push(e.message || String(e));
        window.addEventListener('error', errHandler);

        // Sweep back and forth across all 5 cards 20 times (200 mouseenter events)
        for (let round = 0; round < 20; round++) {
          for (let i = 0; i < cards.length; i++) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
          for (let i = cards.length - 1; i >= 0; i--) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
        }

        await new Promise(r => setTimeout(r, 50));
        window.removeEventListener('error', errHandler);

        return {
          cardsCount: cards.length,
          errors,
          pass: cards.length === 5 && errors.length === 0
        };
      })()
    `);
    record(
      '4.1 Rapid hover sweep (200 events) across all 5 cards with uninitialized audio yields 0 errors',
      uninitHoverTest.pass,
      `errors: ${JSON.stringify(uninitHoverTest.errors)}`
    );

    // 4.2 Rapid hover sweep while audio is initialized & unmuted
    const initHoverTest = await cdp.eval(`
      (async () => {
        const cards = Array.from(document.querySelectorAll('.stage-card'));
        let errors = [];
        const errHandler = (e) => errors.push(e.message || String(e));
        window.addEventListener('error', errHandler);

        // Initialize audio by toggling or calling play
        if (window.ClownAudio.getState().isMuted) {
          window.ClownAudio.toggleMute();
        }

        // Rapid sweep back and forth
        for (let round = 0; round < 20; round++) {
          for (let i = 0; i < cards.length; i++) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
          for (let i = cards.length - 1; i >= 0; i--) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
        }

        await new Promise(r => setTimeout(r, 100));
        window.removeEventListener('error', errHandler);

        return {
          errors,
          pass: errors.length === 0
        };
      })()
    `);
    record(
      '4.2 Rapid hover sweep (200 events) across all 5 cards with active/unmuted audio yields 0 errors',
      initHoverTest.pass,
      `errors: ${JSON.stringify(initHoverTest.errors)}`
    );

    console.log('\n================================================================');
    console.log(`STRESS SUITE TOTAL: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.log('FINDINGS:');
      results.findings.forEach(f => console.log(`- ${f.name}: ${f.details}`));
      process.exitCode = 1;
    } else {
      console.log('VERDICT: APPROVE');
      process.exitCode = 0;
    }

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

runEmpiricalStressSuite();
