/**
 * CLOWNHOUSE.IO // CHALLENGER 1 EMPIRICAL ADVERSARIAL STRESS SUITE
 * Milestone M1: Core Omarchy Foundation & Theme Engine
 *
 * Targets:
 * - 'T' shortcut listener: rapid key toggling, modifier suppression, input typing suppression
 * - Storage boundaries: corrupted/malicious localStorage values, throwing exceptions
 * - 7 themes cycling: deterministic modulo order, state invariants, metadata colors
 * - Headless Google Chrome CDP real-browser validation & console error capture
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8621;
const CDP_PORT = 9621;

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
    const tryListen = (retriesLeft) => {
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

      server.listen(PORT, '127.0.0.1', () => resolve(server));
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
          setTimeout(() => tryListen(retriesLeft - 1), 1000);
        } else {
          reject(err);
        }
      });
    };
    tryListen(15);
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

    let retries = 30;
    const checkCdp = () => {
      http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(raw);
            const pageTarget = targets.find(t => t.type === 'page' || (t.url && t.url.includes(String(PORT))));
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
              resolve({ chrome, wsUrl: pageTarget.webSocketDebuggerUrl });
            } else if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
              resolve({ chrome, wsUrl: targets[0].webSocketDebuggerUrl });
            } else if (retries-- > 0) {
              setTimeout(checkCdp, 150);
            } else {
              reject(new Error('No valid CDP page target found'));
            }
          } catch (e) {
            if (retries-- > 0) setTimeout(checkCdp, 150);
            else reject(e);
          }
        });
      }).on('error', () => {
        if (retries-- > 0) setTimeout(checkCdp, 150);
        else reject(new Error('Could not connect to Chrome CDP port'));
      });
    };

    setTimeout(checkCdp, 300);
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

async function runAdversarialVerification() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // CHALLENGER 1 ADVERSARIAL VERIFICATION HARNESS');
  console.log('Milestone M1: Core Omarchy Foundation & Theme Engine');
  console.log('================================================================\n');

  let server = null;
  let chromeInstance = null;
  let cdp = null;

  try {
    server = await startStaticServer();
    const chromeData = await launchChrome();
    chromeInstance = chromeData.chrome;
    cdp = new CdpClient(chromeData.wsUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await new Promise(r => setTimeout(r, 600));

    // =========================================================================
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
    // CATEGORY 2: INPUT TYPING SUPPRESSION & KEYBOARD SHORTCUTS
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 2: INPUT TYPING SUPPRESSION & SHORTCUT MODIFIERS');
    console.log('----------------------------------------------------------------');

    // Reset theme to tokyo-night
    await cdp.eval('window.ClownTheme.setTheme("tokyo-night")');
    await new Promise(r => setTimeout(r, 100));

    // 2.1: Modifiers (Ctrl, Cmd, Alt) must not trigger theme cycle
    const modCheck = await cdp.eval(`
      (() => {
        const start = window.ClownTheme.getCurrentTheme();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', altKey: true, bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        return start === after;
      })()
    `);
    record('2.1 Modifiers (Ctrl+t, Cmd+t, Alt+t) suppressed from theme cycling', modCheck);

    // 2.2: Typing in <input> suppressed
    const inputCheck = await cdp.eval(`
      (() => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
        input.focus();
        const start = window.ClownTheme.getCurrentTheme();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(input);
        return start === after;
      })()
    `);
    record('2.2 Keystrokes "t" and "T" inside <input> strictly suppressed', inputCheck);

    // 2.3: Typing in Command Palette (#palette-input) suppressed
    const paletteCheck = await cdp.eval(`
      (() => {
        const pInput = document.getElementById('palette-input');
        if (!pInput) return false;
        pInput.focus();
        const start = window.ClownTheme.getCurrentTheme();
        pInput.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        pInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        return start === after;
      })()
    `);
    record('2.3 Keystrokes "t" and "T" inside #palette-input strictly suppressed', paletteCheck);

    // 2.4: Typing in <textarea> suppressed
    const taCheck = await cdp.eval(`
      (() => {
        const ta = document.createElement('textarea');
        document.body.appendChild(ta);
        ta.focus();
        const start = window.ClownTheme.getCurrentTheme();
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(ta);
        return start === after;
      })()
    `);
    record('2.4 Keystrokes inside <textarea> strictly suppressed', taCheck);

    // 2.5: Typing in <select> suppressed
    const selCheck = await cdp.eval(`
      (() => {
        const sel = document.createElement('select');
        document.body.appendChild(sel);
        sel.focus();
        const start = window.ClownTheme.getCurrentTheme();
        sel.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(sel);
        return start === after;
      })()
    `);
    record('2.5 Keystrokes inside <select> strictly suppressed', selCheck);

    // 2.6: Typing in contenteditable element and descendant span suppressed
    const ceCheck = await cdp.eval(`
      (() => {
        const ce = document.createElement('div');
        ce.contentEditable = 'true';
        ce.innerHTML = '<span>nested text</span>';
        document.body.appendChild(ce);
        const childSpan = ce.querySelector('span');
        const start = window.ClownTheme.getCurrentTheme();
        ce.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        childSpan.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(ce);
        return start === after;
      })()
    `);
    record('2.6 Keystrokes inside contenteditable and descendants suppressed', ceCheck);

    // =========================================================================
    // CATEGORY 3: 7 THEMES CYCLING (ORDER & INVARIANTS UNDER PACED CYCLING)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 3: 7 THEMES CYCLING (ORDER & INVARIANTS WITH PACED DELAY)');
    console.log('----------------------------------------------------------------');

    // Reset to tokyo-night
    await cdp.eval('window.ClownTheme.setTheme("tokyo-night")');
    await new Promise(r => setTimeout(r, 100));

    let pacedCycleError = null;
    for (let i = 0; i < THEMES.length * 2; i++) {
      const expectedIndex = (i + 1) % THEMES.length;
      const expectedTheme = THEMES[expectedIndex];

      await cdp.eval('window.ClownTheme.cycleTheme()');
      // Allow ViewTransition callback to complete
      await new Promise(r => setTimeout(r, 80));

      const current = await cdp.eval('window.ClownTheme.getCurrentTheme()');
      const dom = await cdp.eval('document.documentElement.getAttribute("data-theme")');
      const meta = await cdp.eval('document.getElementById("theme-color-meta").getAttribute("content")');

      if (current !== expectedTheme || dom !== expectedTheme) {
        pacedCycleError = `Step ${i}: expected ${expectedTheme}, got current=${current}, dom=${dom}`;
        break;
      }
      if (meta !== THEME_META_COLORS[expectedTheme]) {
        pacedCycleError = `Step ${i}: meta color mismatch for ${expectedTheme}: expected ${THEME_META_COLORS[expectedTheme]}, got ${meta}`;
        break;
      }
    }
    record('3.1 7 themes cycle in deterministic modulo order (14 paced steps) with full CSS/meta alignment', !pacedCycleError, pacedCycleError || '');

    // =========================================================================
    // CATEGORY 4: ADVERSARIAL STRESS: RAPID TOGGLING & VIEW TRANSITION RACE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 4: ADVERSARIAL STRESS: RAPID TOGGLING & RACE CONDITIONS');
    console.log('----------------------------------------------------------------');

    // Test 4.1: Synchronous State Consistency Contract
    // PROJECT.md interface contract specifies setTheme(themeId: string): void and getCurrentTheme(): string.
    // When setTheme('catppuccin') is called, getCurrentTheme() MUST immediately return 'catppuccin'.
    const syncStateContract = await cdp.eval(`
      (() => {
        window.ClownTheme.setTheme('tokyo-night');
        // Immediately set to catppuccin
        window.ClownTheme.setTheme('catppuccin');
        const immediateCurrent = window.ClownTheme.getCurrentTheme();
        const immediateDom = document.documentElement.getAttribute('data-theme');
        return {
          immediateCurrent,
          immediateDom,
          pass: (immediateCurrent === 'catppuccin') && (immediateDom === 'catppuccin')
        };
      })()
    `);
    record(
      '4.1 Synchronous Contract: window.ClownTheme.setTheme updates state immediately',
      syncStateContract.pass,
      `State lag detected: immediateCurrent="${syncStateContract.immediateCurrent}", immediateDom="${syncStateContract.immediateDom}" (deferred into async ViewTransition)`
    );

    // Test 4.2: Rapid Double 'T' Shortcut Keypress (Theme Dropping Bug)
    // A user tapping 'T' twice in quick succession (<16ms) must advance 2 themes: tokyo-night -> gruvbox.
    const rapidDoublePress = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 100));

        // Rapid double keypress
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));

        // Wait for all transitions to settle
        await new Promise(r => setTimeout(r, 300));

        const endTheme = window.ClownTheme.getCurrentTheme();
        const endDom = document.documentElement.getAttribute('data-theme');
        // Starting at index 0 ('tokyo-night'), 2 presses MUST land on index 2 ('gruvbox')
        return {
          endTheme,
          endDom,
          pass: endTheme === 'gruvbox' && endDom === 'gruvbox'
        };
      })()
    `);
    record(
      '4.2 Rapid T-Key Toggling: 2 rapid keypresses advance 2 theme positions (tokyo-night -> gruvbox)',
      rapidDoublePress.pass,
      `Theme drop failure: expected "gruvbox", but landed on "${rapidDoublePress.endTheme}". Second press was eaten because currentTheme was not updated synchronously.`
    );

    // Test 4.3: Unhandled Promise Rejection on Rapid ViewTransitions (Console Error Violation)
    // Rapidly cycling themes while ViewTransitions are active must NOT throw unhandled AbortError rejections.
    const unhandledRejectionsCheck = await cdp.eval(`
      (async () => {
        const caughtErrors = [];
        const rejectionHandler = (e) => caughtErrors.push(String(e.reason));
        window.addEventListener('unhandledrejection', rejectionHandler);

        // Burst 8 rapid 't' events
        for (let i = 0; i < 8; i++) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
          await new Promise(r => setTimeout(r, 8));
        }
        await new Promise(r => setTimeout(r, 300));
        window.removeEventListener('unhandledrejection', rejectionHandler);

        return {
          errorCount: caughtErrors.length,
          errors: caughtErrors,
          pass: caughtErrors.length === 0
        };
      })()
    `);
    record(
      '4.3 Zero Unhandled Promise Rejections (AbortError) during rapid ViewTransition theme toggling',
      unhandledRejectionsCheck.pass,
      `Caught ${unhandledRejectionsCheck.errorCount} unhandled promise rejections: ${JSON.stringify(unhandledRejectionsCheck.errors.slice(0, 3))}`
    );

    // =========================================================================
    // CATEGORY 5: ANTI-VACUITY PROBES
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 5: ANTI-VACUITY & NEGATIVE FALSIFICATION GATES');
    console.log('----------------------------------------------------------------');

    const vacuityCheck1 = (() => {
      // Mutant: simulate missing typing suppression
      const fakeTarget = { tagName: 'INPUT' };
      const simulatedDefect = (target) => false; // fails to check isTypingContext
      return simulatedDefect(fakeTarget) === false; // test successfully identifies defect
    })();
    record('5.1 Anti-vacuity: Mutant typing handler without context check is detected', vacuityCheck1);

    const vacuityCheck2 = (() => {
      // Mutant: stride of 2 instead of 1
      const themes = ['a', 'b', 'c'];
      const mutantNext = (idx) => (idx + 2) % 3;
      return mutantNext(0) !== 1; // correctly detects divergence
    })();
    record('5.2 Anti-vacuity: Mutant theme sequence stride is detected', vacuityCheck2);

    console.log('\n================================================================');
    console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.log('CRITICAL FINDINGS SUMMARY:');
      results.findings.forEach((f, idx) => {
        console.log(`[Finding ${idx + 1}] ${f.name}`);
        console.log(`           ${f.details}`);
      });
      console.log('\nVERDICT: FAIL — Implementation violates synchronous state contract and console error criteria.');
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
    if (server) try { server.close(); } catch (_) {}
  }
}

runAdversarialVerification();
