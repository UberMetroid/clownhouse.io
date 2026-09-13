/**
 * Adversarial M1 Stress Testing Harness (Chrome DevTools Protocol)
 * Executes 100-cycle rapid theme thrashing, invariant checking, link verification,
 * and negative falsification against real headless Google Chrome.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8421;
const CDP_PORT = 9421;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const THEMES = [
  'tower-of-power',
  'chozo-visor',
  'wrx-telemetry',
  'hunter-base',
  'pacific-outpost'
];

const DESTINATIONS = {
  openooda: 'https://openooda.org',
  necrometer: 'https://necrometer.dev',
  bumtrips: 'https://bumtrips.com',
  reactle: 'https://reactle.clownhouse.io',
  giggle: 'https://giggle.clownhouse.io',
  contact: 'mailto:jeryd@clownhouse.io'
};

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
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        res.end(data);
      });
    });

    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const chrome = spawn('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${CDP_PORT}`,
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      `http://127.0.0.1:${PORT}/index.html`
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    chrome.on('error', reject);

    // Wait for Chrome CDP to be available
    let retries = 20;
    const checkCdp = () => {
      http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(raw);
            const pageTarget = targets.find(t => t.type === 'page' || t.url.includes('clownhouse') || t.url.includes(String(PORT)));
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
              resolve({ chrome, wsUrl: pageTarget.webSocketDebuggerUrl });
            } else if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
              resolve({ chrome, wsUrl: targets[0].webSocketDebuggerUrl });
            } else if (retries-- > 0) {
              setTimeout(checkCdp, 200);
            } else {
              reject(new Error('No valid CDP page target found'));
            }
          } catch (e) {
            if (retries-- > 0) setTimeout(checkCdp, 200);
            else reject(e);
          }
        });
      }).on('error', () => {
        if (retries-- > 0) setTimeout(checkCdp, 200);
        else reject(new Error('Could not connect to Chrome CDP port'));
      });
    };

    setTimeout(checkCdp, 500);
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
      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else cb.resolve(msg.result);
        }

        if (msg.method === 'Runtime.exceptionThrown') {
          this.exceptions.push(msg.params);
        } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
          this.consoleErrors.push(msg.params.entry);
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
          this.consoleErrors.push(msg.params);
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

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runAdversarialStressTest() {
  console.log('=== STARTING ADVERSARIAL M1 EMPIRICAL STRESS TEST ===');
  console.log('Target: Google Chrome Headless via Chrome DevTools Protocol (CDP)');

  const server = await startStaticServer();
  console.log(`[+] Static HTTP server listening on http://127.0.0.1:${PORT}`);

  let chromeProc, cdp;
  try {
    const launch = await launchChrome();
    chromeProc = launch.chrome;
    cdp = new CdpClient(launch.wsUrl);
    await cdp.connect();
    console.log('[+] Connected to Chrome DevTools Protocol via native WebSocket.');

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');

    // Wait for DOM ready & clownhouse init
    console.log('[+] Waiting for page ready and clownhouse initialization...');
    await cdp.eval(`
      new Promise((resolve) => {
        if (window.clownhouse && document.readyState === 'complete') {
          resolve(true);
        } else {
          window.addEventListener('load', () => {
            setTimeout(() => resolve(true), 200);
          });
        }
      })
    `);

    // --- PHASE 1: Baseline Invariant Check ---
    console.log('\n--- PHASE 1: Baseline Invariant Verification ---');
    const initialCheck = await cdp.eval(`
      (() => {
        const rootTheme = document.documentElement.getAttribute('data-theme');
        const bodyTheme = document.body.getAttribute('data-theme');
        const activeButtons = Array.from(document.querySelectorAll('#theme-switcher-bar [data-theme]')).filter(b => b.classList.contains('active'));
        const activeContainers = Array.from(document.querySelectorAll('.theme-container')).filter(c => c.classList.contains('active') && !c.hasAttribute('hidden'));
        const hiddenContainers = Array.from(document.querySelectorAll('.theme-container')).filter(c => c.hasAttribute('hidden'));
        const links = Array.from(document.querySelectorAll('.theme-link'));
        const totalElements = document.querySelectorAll('*').length;

        return {
          rootTheme,
          bodyTheme,
          activeButtonsCount: activeButtons.length,
          activeButtonTheme: activeButtons[0] ? activeButtons[0].getAttribute('data-theme') : null,
          activeContainersCount: activeContainers.length,
          activeContainerId: activeContainers[0] ? activeContainers[0].id : null,
          hiddenContainersCount: hiddenContainers.length,
          totalContainersCount: document.querySelectorAll('.theme-container').length,
          linksCount: links.length,
          totalElements
        };
      })()
    `);

    console.log('Baseline State:', JSON.stringify(initialCheck, null, 2));
    if (initialCheck.rootTheme !== 'tower-of-power') throw new Error(`Initial root theme mismatch: ${initialCheck.rootTheme}`);
    if (initialCheck.activeButtonsCount !== 1) throw new Error(`Expected 1 active button, got ${initialCheck.activeButtonsCount}`);
    if (initialCheck.activeContainersCount !== 1) throw new Error(`Expected 1 active container, got ${initialCheck.activeContainersCount}`);
    if (initialCheck.hiddenContainersCount !== 4) throw new Error(`Expected 4 hidden containers, got ${initialCheck.hiddenContainersCount}`);
    if (initialCheck.linksCount !== 30) throw new Error(`Expected 30 universal links, got ${initialCheck.linksCount}`);
    console.log('[PASS] Phase 1 Baseline Invariants Verified.');

    const baselineElementCount = initialCheck.totalElements;

    // --- PHASE 2: 100-Cycle Rapid Theme Thrashing via Switcher Button Clicks ---
    console.log('\n--- PHASE 2: 100-Cycle Rapid Theme Thrashing (Button Clicks) ---');
    const clickResults = await cdp.eval(`
      (async () => {
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        const failures = [];
        let totalSwitches = 0;

        for (let cycle = 0; cycle < 100; cycle++) {
          // Select theme pseudo-randomly or rotationally to stress irregular transitions
          const targetTheme = themes[cycle % themes.length];
          const btn = document.querySelector(\`#theme-switcher-bar [data-theme="\${targetTheme}"]\`);
          if (!btn) {
            failures.push({ cycle, error: 'Button not found for ' + targetTheme });
            continue;
          }

          // Trigger real click event
          btn.click();
          totalSwitches++;

          // Immediately verify DOM state invariants
          const rootTheme = document.documentElement.getAttribute('data-theme');
          const bodyTheme = document.body.getAttribute('data-theme');
          const storageTheme = localStorage.getItem('clownhouse_theme');
          const activeBtns = Array.from(document.querySelectorAll('#theme-switcher-bar [data-theme].active'));
          const activeConts = Array.from(document.querySelectorAll('.theme-container.active:not([hidden])'));
          const hiddenConts = Array.from(document.querySelectorAll('.theme-container[hidden]'));
          const totalConts = document.querySelectorAll('.theme-container').length;

          // Check invariants
          if (rootTheme !== targetTheme) {
            failures.push({ cycle, targetTheme, error: \`Root data-theme mismatch: got \${rootTheme}\` });
          }
          if (bodyTheme !== targetTheme) {
            failures.push({ cycle, targetTheme, error: \`Body data-theme mismatch: got \${bodyTheme}\` });
          }
          if (storageTheme !== targetTheme) {
            failures.push({ cycle, targetTheme, error: \`Storage theme mismatch: got \${storageTheme}\` });
          }
          if (activeBtns.length !== 1 || activeBtns[0].getAttribute('data-theme') !== targetTheme) {
            failures.push({ cycle, targetTheme, error: \`Active buttons count \${activeBtns.length}\` });
          }
          if (activeBtns[0] && activeBtns[0].getAttribute('aria-pressed') !== 'true') {
            failures.push({ cycle, targetTheme, error: 'Active button missing aria-pressed="true"' });
          }
          if (activeConts.length !== 1 || activeConts[0].id !== 'theme-' + targetTheme) {
            failures.push({ cycle, targetTheme, error: \`Active containers count \${activeConts.length}\` });
          }
          if (hiddenConts.length !== (totalConts - 1)) {
            failures.push({ cycle, targetTheme, error: \`Hidden containers count \${hiddenConts.length} != \${totalConts - 1}\` });
          }

          // Check computed style visibility
          const compDisplay = window.getComputedStyle(activeConts[0]).display;
          if (compDisplay === 'none') {
            failures.push({ cycle, targetTheme, error: 'Active container computed display is none' });
          }
        }

        return { totalSwitches, failures };
      })()
    `);

    console.log(`Phase 2 completed: ${clickResults.totalSwitches} switches.`);
    if (clickResults.failures.length > 0) {
      console.error('Failures encountered in Phase 2:', clickResults.failures);
      throw new Error(`Phase 2 failed with ${clickResults.failures.length} invariant violations!`);
    }
    console.log('[PASS] Phase 2: 100-cycle button click thrashing passed with 0 invariant violations.');

    // --- PHASE 3: 100-Cycle Zero-Delay Synchronous API Thrashing (setTheme) ---
    console.log('\n--- PHASE 3: 100-Cycle Zero-Delay Synchronous API Thrashing (setTheme) ---');
    const apiResults = await cdp.eval(`
      (async () => {
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        const failures = [];
        let totalSwitches = 0;

        // Rapid ping-pong and shuffle thrashing
        for (let i = 0; i < 100; i++) {
          const targetTheme = themes[(i * 3 + 1) % themes.length];
          const ok = window.clownhouse.setTheme(targetTheme);
          totalSwitches++;

          if (!ok) {
            failures.push({ cycle: i, targetTheme, error: 'setTheme returned false' });
          }

          // Check state synchronization
          const activeTheme = window.clownhouse.getActiveTheme();
          const rootTheme = document.documentElement.getAttribute('data-theme');
          const activeConts = document.querySelectorAll('.theme-container.active:not([hidden])');
          const hiddenConts = document.querySelectorAll('.theme-container[hidden]');

          if (activeTheme !== targetTheme) {
            failures.push({ cycle: i, error: \`getActiveTheme \${activeTheme} != \${targetTheme}\` });
          }
          if (rootTheme !== targetTheme) {
            failures.push({ cycle: i, error: \`rootTheme \${rootTheme} != \${targetTheme}\` });
          }
          if (activeConts.length !== 1 || activeConts[0].id !== 'theme-' + targetTheme) {
            failures.push({ cycle: i, error: \`Active containers count \${activeConts.length}\` });
          }
          if (hiddenConts.length !== 4) {
            failures.push({ cycle: i, error: \`Hidden containers count \${hiddenConts.length} != 4\` });
          }
        }

        return { totalSwitches, failures };
      })()
    `);

    console.log(`Phase 3 completed: ${apiResults.totalSwitches} synchronous switches.`);
    if (apiResults.failures.length > 0) {
      console.error('Failures encountered in Phase 3:', apiResults.failures);
      throw new Error(`Phase 3 failed with ${apiResults.failures.length} invariant violations!`);
    }
    console.log('[PASS] Phase 3: 100-cycle synchronous API thrashing passed with 0 invariant violations.');

    // --- PHASE 4: 100-Cycle Keyboard Navigation Thrashing ---
    console.log('\n--- PHASE 4: 100-Cycle Keyboard Navigation Thrashing ---');
    const keyResults = await cdp.eval(`
      (async () => {
        const switcherBar = document.getElementById('theme-switcher-bar');
        const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
        const failures = [];
        let totalKeyEvents = 0;

        // Focus the first button
        const firstBtn = switcherBar.querySelector('[data-theme]');
        firstBtn.focus();

        for (let i = 0; i < 100; i++) {
          const key = keys[i % keys.length];
          const event = new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true });
          switcherBar.dispatchEvent(event);
          totalKeyEvents++;

          // Invariant check
          const activeBtns = Array.from(switcherBar.querySelectorAll('[data-theme].active'));
          const focusedEl = document.activeElement;
          const activeTheme = window.clownhouse.getActiveTheme();
          const activeConts = Array.from(document.querySelectorAll('.theme-container.active:not([hidden])'));

          if (activeBtns.length !== 1) {
            failures.push({ cycle: i, key, error: \`Active buttons count \${activeBtns.length}\` });
          }
          if (activeBtns[0] && activeBtns[0].getAttribute('data-theme') !== activeTheme) {
            failures.push({ cycle: i, key, error: 'Active button theme desynchronized from getActiveTheme()' });
          }
          if (activeConts.length !== 1 || activeConts[0].id !== 'theme-' + activeTheme) {
            failures.push({ cycle: i, key, error: 'Active container desynchronized from keyboard navigation' });
          }
          if (activeBtns[0] && activeBtns[0].getAttribute('tabindex') !== '0') {
            failures.push({ cycle: i, key, error: 'Active tab button does not have tabindex="0"' });
          }
        }

        return { totalKeyEvents, failures };
      })()
    `);

    console.log(`Phase 4 completed: ${keyResults.totalKeyEvents} keyboard navigation cycles.`);
    if (keyResults.failures.length > 0) {
      console.error('Failures encountered in Phase 4:', keyResults.failures);
      throw new Error(`Phase 4 failed with ${keyResults.failures.length} invariant violations!`);
    }
    console.log('[PASS] Phase 4: 100-cycle keyboard navigation thrashing passed with 0 invariant violations.');

    // --- PHASE 5: 100-Cycle Rapid Sound Toggle Thrashing ---
    console.log('\n--- PHASE 5: 100-Cycle Rapid Sound Toggle Thrashing ---');
    const soundResults = await cdp.eval(`
      (() => {
        const toggleBtn = document.getElementById('sound-toggle');
        const failures = [];
        let totalToggles = 0;

        for (let i = 0; i < 100; i++) {
          toggleBtn.click();
          totalToggles++;

          const isMuted = window.clownhouse.isSoundMuted();
          const ariaPressed = toggleBtn.getAttribute('aria-pressed');
          const expectedPressed = isMuted ? 'false' : 'true';
          const storedSound = localStorage.getItem('clownhouse_sound');
          const expectedStorage = isMuted ? 'off' : 'on';

          if (ariaPressed !== expectedPressed) {
            failures.push({ cycle: i, error: \`Sound toggle aria-pressed \${ariaPressed} != \${expectedPressed}\` });
          }
          if (storedSound !== expectedStorage) {
            failures.push({ cycle: i, error: \`Storage sound \${storedSound} != \${expectedStorage}\` });
          }
        }

        return { totalToggles, failures };
      })()
    `);

    console.log(`Phase 5 completed: ${soundResults.totalToggles} sound toggles.`);
    if (soundResults.failures.length > 0) {
      console.error('Failures encountered in Phase 5:', soundResults.failures);
      throw new Error(`Phase 5 failed with ${soundResults.failures.length} invariant violations!`);
    }
    console.log('[PASS] Phase 5: 100-cycle sound toggle thrashing passed with 0 invariant violations.');

    // --- PHASE 6: Post-Thrashing Universal Link Matrix Verification ---
    console.log('\n--- PHASE 6: Universal Link Matrix Verification (30 Links) ---');
    const linkVerification = await cdp.eval(`
      (() => {
        const expectedDestinations = {
          openooda: 'https://openooda.org',
          necrometer: 'https://necrometer.dev',
          bumtrips: 'https://bumtrips.com',
          reactle: 'https://reactle.clownhouse.io',
          giggle: 'https://giggle.clownhouse.io',
          contact: 'mailto:jeryd@clownhouse.io'
        };

        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        const results = {};
        const errors = [];
        let totalVerified = 0;

        themes.forEach(theme => {
          const container = document.getElementById('theme-' + theme);
          if (!container) {
            errors.push('Container missing for theme: ' + theme);
            return;
          }

          const links = container.querySelectorAll('.theme-link');
          results[theme] = { found: links.length, destinations: {} };

          if (links.length !== 6) {
            errors.push(\`Theme \${theme} has \${links.length} links instead of 6\`);
          }

          links.forEach(link => {
            const dest = link.getAttribute('data-destination');
            const href = link.getAttribute('href');
            const rel = link.getAttribute('rel') || '';
            const target = link.getAttribute('target');

            results[theme].destinations[dest] = href;

            if (!expectedDestinations[dest]) {
              errors.push(\`Unknown data-destination \${dest} in theme \${theme}\`);
            } else if (href !== expectedDestinations[dest]) {
              errors.push(\`Destination \${dest} in theme \${theme} has href \${href} != \${expectedDestinations[dest]}\`);
            } else {
              totalVerified++;
            }

            // Verify security attributes for web links
            if (href && href.startsWith('http')) {
              if (target !== '_blank') {
                errors.push(\`Link \${href} missing target="_blank"\`);
              }
              if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
                errors.push(\`Link \${href} missing rel="noopener noreferrer"\`);
              }
            }
          });
        });

        return { totalVerified, results, errors };
      })()
    `);

    console.log(`Universal Links Verified: ${linkVerification.totalVerified}/30.`);
    if (linkVerification.errors.length > 0) {
      console.error('Universal Link errors:', linkVerification.errors);
      throw new Error(`Phase 6 failed: Link matrix verification errors: ${JSON.stringify(linkVerification.errors)}`);
    }
    console.log('[PASS] Phase 6: All 30 universal links verified intact with exact URLs and security rels.');

    // --- PHASE 7: Hostile Adversarial Negative Falsification Tests ---
    console.log('\n--- PHASE 7: Hostile Adversarial Negative Falsification ---');
    const negativeResults = await cdp.eval(`
      (() => {
        const hostilePayloads = [
          null,
          undefined,
          '',
          '   ',
          1337,
          true,
          {},
          [],
          '<script>alert(1)</script>',
          '"><img src=x onerror=alert(1)>',
          'tower-of-power\\0.js',
          '__proto__',
          'constructor',
          'toString',
          'valueOf',
          '../../etc/passwd',
          'tower-of-power; DROP TABLE users;',
          'A'.repeat(500),
          '\\u202Ereversed_theme',
          'commodore-64',
          'amiga-500'
        ];

        const initialTheme = window.clownhouse.getActiveTheme();
        const failures = [];

        hostilePayloads.forEach((payload, idx) => {
          try {
            const res = window.clownhouse.setTheme(payload);
            const activeAfter = window.clownhouse.getActiveTheme();
            const rootThemeAfter = document.documentElement.getAttribute('data-theme');
            const activeConts = document.querySelectorAll('.theme-container.active:not([hidden])');

            if (res !== false) {
              failures.push({ idx, payload: String(payload), error: 'setTheme did not return false on hostile input' });
            }
            if (activeAfter !== initialTheme) {
              failures.push({ idx, payload: String(payload), error: \`Active theme mutated to \${activeAfter}\` });
            }
            if (rootThemeAfter !== initialTheme) {
              failures.push({ idx, payload: String(payload), error: \`Root data-theme mutated to \${rootThemeAfter}\` });
            }
            if (activeConts.length !== 1 || activeConts[0].id !== 'theme-' + initialTheme) {
              failures.push({ idx, payload: String(payload), error: 'Active container desynchronized during hostile input' });
            }
          } catch (err) {
            failures.push({ idx, payload: String(payload), error: 'Exception thrown: ' + err.message });
          }
        });

        return { payloadsTested: hostilePayloads.length, failures };
      })()
    `);

    console.log(`Hostile payloads tested: ${negativeResults.payloadsTested}. Failures: ${negativeResults.failures.length}`);
    if (negativeResults.failures.length > 0) {
      console.error('Failures encountered in Phase 7:', negativeResults.failures);
      throw new Error(`Phase 7 failed: Hostile inputs bypassed validation!`);
    }
    console.log('[PASS] Phase 7: All 21 hostile attack payloads rejected cleanly with zero state mutation.');

    // --- PHASE 8: DOM Leak and Console Error Audit ---
    console.log('\n--- PHASE 8: DOM Node Leak and Error Log Audit ---');
    const finalDomCheck = await cdp.eval(`
      (() => {
        const finalElementCount = document.querySelectorAll('*').length;
        const totalContainers = document.querySelectorAll('.theme-container').length;
        const activeContainers = document.querySelectorAll('.theme-container.active:not([hidden])').length;
        const hiddenContainers = document.querySelectorAll('.theme-container[hidden]').length;
        const totalLinks = document.querySelectorAll('.theme-link').length;

        return {
          finalElementCount,
          totalContainers,
          activeContainers,
          hiddenContainers,
          totalLinks
        };
      })()
    `);

    console.log('Final DOM State:', JSON.stringify(finalDomCheck, null, 2));
    if (finalDomCheck.finalElementCount !== baselineElementCount) {
      throw new Error(`DOM node count drifted: baseline ${baselineElementCount} vs final ${finalDomCheck.finalElementCount}`);
    }
    if (finalDomCheck.activeContainers !== 1) {
      throw new Error(`Expected exactly 1 active container, found ${finalDomCheck.activeContainers}`);
    }
    if (finalDomCheck.hiddenContainers !== 4) {
      throw new Error(`Expected exactly 4 hidden containers, found ${finalDomCheck.hiddenContainers}`);
    }
    if (finalDomCheck.totalLinks !== 30) {
      throw new Error(`Expected 30 universal links, found ${finalDomCheck.totalLinks}`);
    }

    console.log(`Chrome Console Errors: ${cdp.consoleErrors.length}`);
    console.log(`Chrome Unhandled Exceptions: ${cdp.exceptions.length}`);
    if (cdp.consoleErrors.length > 0) {
      console.warn('Console errors:', cdp.consoleErrors);
    }
    if (cdp.exceptions.length > 0) {
      console.error('Unhandled exceptions:', cdp.exceptions);
      throw new Error(`Chrome reported ${cdp.exceptions.length} unhandled runtime exceptions!`);
    }
    console.log('[PASS] Phase 8: DOM node count perfectly invariant (0 leaked elements); 0 runtime exceptions.');

    console.log('\n==============================================================');
    console.log('   EMPIRICAL CHALLENGER VERDICT: CONFIRM (PASS)');
    console.log('==============================================================');
    console.log('Total theme hot-swaps executed: > 300 cycles.');
    console.log('DOM state synchronization: 100% synchronized across all cycles.');
    console.log('Single active container enforcement: Exactly 1 active at all times.');
    console.log('Universal link matrix integrity: All 30 links intact and accessible.');
    console.log('Negative fuzzing & falsification: All 21 hostile attack payloads fail-closed.');
    console.log('Memory & DOM leaks: 0 node drift.');
    console.log('Unhandled errors: 0.');

    return { status: 'CONFIRM', switchesExecuted: 300, invariantViolations: 0, linksVerified: 30 };
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) {
      chromeProc.kill();
      try { process.kill(-chromeProc.pid); } catch (e) {}
    }
    server.close();
  }
}

runAdversarialStressTest()
  .then(res => {
    process.exit(0);
  })
  .catch(err => {
    console.error('\n[FATAL CHALLENGE FAILURE]:', err.message);
    process.exit(1);
  });
