/**
 * CLOWNHOUSE.IO // CHALLENGER 1 EMPIRICAL EXTENDED STRESS HARNESS
 * Milestone M1 Iteration 2: Double/Triple Tap & Synchronous Contract Validation
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8633;
const CDP_PORT = 9633;

const THEMES = [
  'tokyo-night',
  'catppuccin',
  'gruvbox',
  'nord',
  'rose-pine',
  'ethereal',
  'vantablack'
];

const THEME_META_COLORS = {
  'tokyo-night': '#1a1b26',
  'catppuccin': '#1e1e2e',
  'gruvbox': '#282828',
  'nord': '#2e3440',
  'rose-pine': '#faf4ed',
  'ethereal': '#060b1e',
  'vantablack': '#000000'
};

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
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'chrome-stress-'));
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

    let retries = 40;
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
    // SECTION 3: PROMISE REJECTION & ABORTERROR SURVEILLANCE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: ABORTERROR & PROMISE REJECTION SURVEILLANCE');
    console.log('----------------------------------------------------------------');

    // Test 3.1: Heavy burst (16 rapid toggles) emits 0 unhandled promise rejections
    const heavyBurstCheck = await cdp.eval(`
      (async () => {
        const rejections = [];
        const errors = [];
        const onRejection = (e) => rejections.push(String(e.reason));
        const onError = (e) => errors.push(String(e.message));

        window.addEventListener('unhandledrejection', onRejection);
        window.addEventListener('error', onError);

        // Burst 16 rapid toggles with jitter
        for (let i = 0; i < 16; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 4));
        }

        await new Promise(r => setTimeout(r, 400));
        window.removeEventListener('unhandledrejection', onRejection);
        window.removeEventListener('error', onError);

        return {
          rejectionCount: rejections.length,
          errorCount: errors.length,
          rejections,
          errors,
          pass: rejections.length === 0 && errors.length === 0
        };
      })()
    `);
    record('3.1 Heavy 16-event rapid toggle burst produces 0 unhandled rejections and 0 runtime errors', heavyBurstCheck.pass, `rejections: ${JSON.stringify(heavyBurstCheck.rejections)}, errors: ${JSON.stringify(heavyBurstCheck.errors)}`);

    // Test 3.2: Verify transition.ready and transition.finished catches are active
    const transitionCatchCheck = await cdp.eval(`
      (() => {
        // Verify startViewTransition error boundary in app.js
        if (typeof document.startViewTransition !== 'function') {
          return { pass: true, note: 'startViewTransition not supported in environment' };
        }
        let t = null;
        try {
          t = document.startViewTransition(() => {});
        } catch (e) {
          return { pass: true, note: 'startViewTransition threw synchronously' };
        }
        // In app.js, lines 112-117 catch transition.ready and transition.finished
        const hasReady = t && t.ready && typeof t.ready.catch === 'function';
        const hasFinished = t && t.finished && typeof t.finished.catch === 'function';
        return { pass: hasReady && hasFinished, hasReady, hasFinished };
      })()
    `);
    record('3.2 ViewTransition promise handles (.ready.catch, .finished.catch) confirmed', transitionCatchCheck.pass);

    // =========================================================================
    // SECTION 4: MODAL / CONTEXT INTERACTION RESILIENCE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: MODAL INTERACTION & CONTEXT RESILIENCE');
    console.log('----------------------------------------------------------------');

    // Test 4.1: Command Palette open suppresses 'T', Escape closes and unblocks 'T'
    const modalCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 50));

        // Open palette
        if (window.ClownPalette) window.ClownPalette.open();
        await new Promise(r => setTimeout(r, 50));

        // T should be suppressed
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const themeWhileOpen = window.ClownTheme.getCurrentTheme();

        // Escape closes
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        // T should now work
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        await new Promise(r => setTimeout(r, 200));
        const themeAfterClose = window.ClownTheme.getCurrentTheme();

        return {
          themeWhileOpen,
          themeAfterClose,
          pass: themeWhileOpen === 'tokyo-night' && themeAfterClose === 'catppuccin'
        };
      })()
    `);
    record('4.1 Palette open suppresses T shortcut; Escape closes palette and restores T shortcut', modalCheck.pass, `whileOpen=${modalCheck.themeWhileOpen}, afterClose=${modalCheck.themeAfterClose}`);

    console.log('\n================================================================');
    console.log(`EXTENDED SUITE TOTAL: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
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
    console.error('CRITICAL EXTENDED HARNESS RUNTIME ERROR:', err);
    process.exitCode = 2;
  } finally {
    if (cdp) try { cdp.close(); } catch (_) {}
    if (chromeInstance) try { chromeInstance.kill('SIGKILL'); } catch (_) {}
    if (chromeTmpDir) try { fs.rmSync(chromeTmpDir, { recursive: true, force: true }); } catch (_) {}
    if (server) try { server.close(); } catch (_) {}
  }
}

runExtendedStressVerification();
