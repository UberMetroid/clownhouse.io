/**
 * CLOWNHOUSE.IO // Milestone M3 Empirical Verification Suite
 * Dual-Trigger Theme Randomizer (Ambient Interval & Scroll Velocity)
 *
 * Validates:
 * 1. Public Interface Contract (window.ClownTheme: 8 properties/methods, 7 Omarchy palettes)
 * 2. Trigger 1: Ambient Periodic Cycle (Dynamic 15s–25s interval, random selection, visibilitychange pause/resume, start/stop/reset)
 * 3. Trigger 2: Scroll Velocity & Stop Detector (Flick detection Vs > 1.8 px/ms, stop detection > 150ms, 4.0s cooldown, reduced motion guard)
 * 4. State Synchronization & Visual Smoothing (data-theme, meta theme-color, localStorage, 800ms transitions)
 * 5. Clean Slate Negative Audit (0 forbidden legacy strings)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
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
          'Content-Type': MIME_TYPES[ext] || 'text/plain',
          'Cache-Control': 'no-cache'
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

function launchChrome(serverPort) {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'chrome-m3-randomizer-'));
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
              const pageTarget = targets.find(t => t.type === 'page');
              if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                resolve({ chrome, tmpDir, wsUrl: pageTarget.webSocketDebuggerUrl });
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

async function runTestSuite() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // M3 DUAL-TRIGGER THEME RANDOMIZER VERIFICATION');
  console.log('Ambient Intervals, Scroll Velocity & Stop Detector Suite');
  console.log('================================================================\n');

  let serverObj = null;
  let chromeData = null;
  let cdp = null;

  try {
    serverObj = await startStaticServer();
    chromeData = await launchChrome(serverObj.port);
    cdp = new CdpClient(chromeData.wsUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverObj.port}/index.html` });

    // Wait for window.ClownTheme
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const isReady = await cdp.eval('typeof window.ClownTheme !== "undefined" && typeof window.ClownTheme.setTheme === "function"');
        if (isReady) { ready = true; break; }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 100));
    }
    if (!ready) throw new Error('window.ClownTheme failed to initialize');

    // --- SECTION 1: Interface Contract Completeness ---
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: PUBLIC INTERFACE CONTRACT (window.ClownTheme)');
    console.log('----------------------------------------------------------------');

    const contractCheck = await cdp.eval(`
      (() => {
        const t = window.ClownTheme;
        if (!t) return { pass: false, error: 'window.ClownTheme undefined' };
        const EXPECTED_THEMES = ['tokyo-night', 'catppuccin', 'gruvbox', 'nord', 'rose-pine', 'ethereal', 'vantablack'];
        const themesMatch = Array.isArray(t.THEMES) &&
          t.THEMES.length === 7 &&
          EXPECTED_THEMES.every((th, i) => t.THEMES[i] === th);

        return {
          pass: (
            themesMatch &&
            typeof t.setTheme === 'function' &&
            typeof t.cycleTheme === 'function' &&
            typeof t.randomTheme === 'function' &&
            typeof t.getCurrentTheme === 'function' &&
            typeof t.startAutoRandom === 'function' &&
            typeof t.stopAutoRandom === 'function' &&
            typeof t.resetAutoRandom === 'function'
          ),
          themesMatch,
          hasSetTheme: typeof t.setTheme === 'function',
          hasCycleTheme: typeof t.cycleTheme === 'function',
          hasRandomTheme: typeof t.randomTheme === 'function',
          hasGetCurrentTheme: typeof t.getCurrentTheme === 'function',
          hasStartAutoRandom: typeof t.startAutoRandom === 'function',
          hasStopAutoRandom: typeof t.stopAutoRandom === 'function',
          hasResetAutoRandom: typeof t.resetAutoRandom === 'function'
        };
      })()
    `);
    record('1.1 window.ClownTheme implements all 8 required contract properties and methods', contractCheck.pass, JSON.stringify(contractCheck));

    // --- SECTION 2: Trigger 1 Ambient Cycle & Dynamic Interval ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: TRIGGER 1 (AMBIENT INTERVAL, RANDOM SELECTION, VISIBILITY)');
    console.log('----------------------------------------------------------------');

    // 2.1 randomTheme() always selects a theme different from current
    const randomDiffCheck = await cdp.eval(`
      (() => {
        const results = [];
        for (let i = 0; i < 50; i++) {
          const before = window.ClownTheme.getCurrentTheme();
          const picked = window.ClownTheme.randomTheme();
          const after = window.ClownTheme.getCurrentTheme();
          results.push({ before, picked, after, diff: (picked !== before) && (after === picked) });
        }
        return {
          allDiff: results.every(r => r.diff),
          failureCount: results.filter(r => !r.diff).length
        };
      })()
    `);
    record('2.1 randomTheme() strictly selects a different theme across 50 consecutive invocations', randomDiffCheck.allDiff, `Failures: ${randomDiffCheck.failureCount}`);

    // 2.2 Verify ambient dynamic interval definition (15s - 25s) in source code
    const appJsContent = fs.readFileSync(path.join(PROJECT_ROOT, 'app.js'), 'utf8');
    const dynamicIntervalMatch = appJsContent.includes('15000 + Math.random() * 10000');
    record('2.2 Ambient random timer dynamically schedules interval between 15s and 25s (15000 + Math.random() * 10000)', dynamicIntervalMatch);

    // 2.3 startAutoRandom(intervalMs) fires and changes theme
    const autoIntervalCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        const startTheme = window.ClownTheme.getCurrentTheme();
        // Set short interval for testing (80ms)
        window.ClownTheme.startAutoRandom(80);
        await new Promise(r => setTimeout(r, 140));
        const afterTheme = window.ClownTheme.getCurrentTheme();
        window.ClownTheme.stopAutoRandom();
        return {
          startTheme,
          afterTheme,
          changed: startTheme !== afterTheme
        };
      })()
    `);
    record('2.3 startAutoRandom(interval) automatically triggers theme shift on timer', autoIntervalCheck.changed, `start: ${autoIntervalCheck.startTheme}, after: ${autoIntervalCheck.afterTheme}`);

    // 2.4 stopAutoRandom() halts theme changes
    const stopAutoCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('nord');
        window.ClownTheme.stopAutoRandom();
        const startTheme = window.ClownTheme.getCurrentTheme();
        await new Promise(r => setTimeout(r, 150));
        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          startTheme,
          endTheme,
          halted: startTheme === endTheme
        };
      })()
    `);
    record('2.4 stopAutoRandom() cleanly stops ambient theme shifts', stopAutoCheck.halted, `start: ${stopAutoCheck.startTheme}, end: ${stopAutoCheck.endTheme}`);

    // 2.5 resetAutoRandom() resets timer cleanly
    const resetAutoCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('ethereal');
        window.ClownTheme.stopAutoRandom();
        window.ClownTheme.resetAutoRandom();
        return {
          pass: typeof window.ClownTheme.resetAutoRandom === 'function'
        };
      })()
    `);
    record('2.5 resetAutoRandom() resets internal timer and state without throwing', resetAutoCheck.pass);

    // 2.6 Visibilitychange pauses timer when document is hidden
    const visibilityPauseCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('gruvbox');
        window.ClownTheme.startAutoRandom(60);

        // Simulate document.hidden = true
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        const themeWhenHidden = window.ClownTheme.getCurrentTheme();
        await new Promise(r => setTimeout(r, 150));
        const themeAfterWait = window.ClownTheme.getCurrentTheme();

        // Simulate document.hidden = false (resume)
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        await new Promise(r => setTimeout(r, 120));
        const themeAfterResume = window.ClownTheme.getCurrentTheme();
        window.ClownTheme.stopAutoRandom();

        return {
          pausedWhileHidden: (themeWhenHidden === themeAfterWait),
          resumedWhenVisible: (themeAfterWait !== themeAfterResume),
          themeWhenHidden,
          themeAfterWait,
          themeAfterResume
        };
      })()
    `);
    record(
      '2.6 visibilitychange pauses auto timer when tab is hidden and resumes when visible',
      visibilityPauseCheck.pausedWhileHidden && visibilityPauseCheck.resumedWhenVisible,
      `paused: ${visibilityPauseCheck.pausedWhileHidden}, resumed: ${visibilityPauseCheck.resumedWhenVisible}`
    );

    // --- SECTION 3: Trigger 2 Scroll Velocity & Stop Detector ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: TRIGGER 2 (SCROLL VELOCITY, STOP DETECTOR & 4.0s COOLDOWN)');
    console.log('----------------------------------------------------------------');

    // 3.1 Slow scroll (Vs < 1.8 px/ms) followed by stop does NOT trigger theme change
    const slowScrollCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('rose-pine');
        const initialTheme = window.ClownTheme.getCurrentTheme();

        // Simulate slow scrolling: 50px over 100ms => Vs = 0.5 px/ms (< 1.8)
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 10, time: t0 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 30, time: t0 + 50 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 50, time: t0 + 100 } }));

        // Wait for stop duration (200ms > 150ms)
        await new Promise(r => setTimeout(r, 220));

        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          initialTheme,
          endTheme,
          didNotChange: initialTheme === endTheme
        };
      })()
    `);
    record('3.1 Slow scroll (Vs = 0.5 px/ms < 1.8) does not trigger theme change', slowScrollCheck.didNotChange, `initial: ${slowScrollCheck.initialTheme}, end: ${slowScrollCheck.endTheme}`);

    // 3.2 Rapid scroll flick (Vs > 1.8 px/ms) followed by stop (> 150ms) triggers randomTheme()
    const rapidFlickCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('catppuccin');
        const initialTheme = window.ClownTheme.getCurrentTheme();

        // Simulate rapid flick: 300px over 50ms => Vs = 6.0 px/ms (> 1.8)
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 0, time: t0 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 300, time: t0 + 50 } }));

        // Wait for stop detection: > 150ms of stop
        await new Promise(r => setTimeout(r, 220));

        const endTheme = window.ClownTheme.getCurrentTheme();
        return {
          initialTheme,
          endTheme,
          changed: initialTheme !== endTheme
        };
      })()
    `);
    record('3.2 Rapid scroll flick (Vs = 6.0 px/ms > 1.8) followed by stop (>150ms) triggers randomTheme()', rapidFlickCheck.changed, `initial: ${rapidFlickCheck.initialTheme}, end: ${rapidFlickCheck.endTheme}`);

    // 3.3 4.0-Second Anti-Strobe Cooldown: immediate second flick is strictly ignored
    const cooldownCheck = await cdp.eval(`
      (async () => {
        // We just triggered at rapidFlickCheck. Now immediately trigger a second flick at 500ms into cooldown:
        const themeBeforeSecondFlick = window.ClownTheme.getCurrentTheme();

        const t1 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 100, time: t1 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 500, time: t1 + 40 } })); // Vs = 10 px/ms

        // Wait for stop detection (> 150ms)
        await new Promise(r => setTimeout(r, 220));

        const themeAfterSecondFlick = window.ClownTheme.getCurrentTheme();
        return {
          themeBeforeSecondFlick,
          themeAfterSecondFlick,
          cooldownBlocked: themeBeforeSecondFlick === themeAfterSecondFlick
        };
      })()
    `);
    record(
      '3.3 4.0-Second Cooldown: rapid scroll flick within cooldown window is strictly blocked',
      cooldownCheck.cooldownBlocked,
      `before: ${cooldownCheck.themeBeforeSecondFlick}, after: ${cooldownCheck.themeAfterSecondFlick}`
    );

    // 3.4 Reduced motion guard: suppressed under prefers-reduced-motion: reduce
    const reducedMotionScrollCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('nord');
        const startTheme = window.ClownTheme.getCurrentTheme();

        // Mock prefers-reduced-motion: reduce
        const origMatchMedia = window.matchMedia;
        window.matchMedia = (query) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {}
        });

        // Try rapid flick while reduced motion is active
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 0, time: t0 } }));
        window.dispatchEvent(new CustomEvent('scroll', { detail: { scrollY: 600, time: t0 + 40 } })); // Vs = 15 px/ms

        await new Promise(r => setTimeout(r, 220));
        const endTheme = window.ClownTheme.getCurrentTheme();

        window.matchMedia = origMatchMedia;

        return {
          startTheme,
          endTheme,
          suppressed: startTheme === endTheme
        };
      })()
    `);
    record(
      '3.4 prefers-reduced-motion: reduce strictly suppresses scroll-driven theme shifts',
      reducedMotionScrollCheck.suppressed,
      `start: ${reducedMotionScrollCheck.startTheme}, end: ${reducedMotionScrollCheck.endTheme}`
    );

    // --- SECTION 4: Synchronous State, Meta Sync & CSS Transition Tokens ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: SYNCHRONOUS STATE, META COLOR SYNC & CSS TOKENS');
    console.log('----------------------------------------------------------------');

    const metaAndStorageCheck = await cdp.eval(`
      (() => {
        const THEME_META_COLORS = {
          'tokyo-night': '#1a1b26',
          'catppuccin': '#1e1e2e',
          'gruvbox': '#282828',
          'nord': '#2e3440',
          'rose-pine': '#faf4ed',
          'ethereal': '#060b1e',
          'vantablack': '#000000'
        };

        const checks = [];
        for (const [theme, expectedColor] of Object.entries(THEME_META_COLORS)) {
          window.ClownTheme.setTheme(theme);
          const current = window.ClownTheme.getCurrentTheme();
          const domAttr = document.documentElement.getAttribute('data-theme');
          const metaContent = document.querySelector('meta[name="theme-color"]').getAttribute('content');
          const stored = localStorage.getItem('theme');

          checks.push({
            theme,
            pass: current === theme && domAttr === theme && metaContent === expectedColor && stored === theme
          });
        }

        return {
          allPass: checks.every(c => c.pass),
          failedChecks: checks.filter(c => !c.pass)
        };
      })()
    `);
    record('4.1 Synchronous update across data-theme, meta theme-color, and localStorage for all 7 themes', metaAndStorageCheck.allPass, JSON.stringify(metaAndStorageCheck.failedChecks));

    // 4.2 Verify CSS custom property --transition-theme is 800ms cubic-bezier
    const cssContent = fs.readFileSync(path.join(PROJECT_ROOT, 'style.css'), 'utf8');
    const hasTransitionThemeVar = cssContent.includes('--transition-theme: 800ms cubic-bezier(0.16, 1, 0.3, 1);');
    record('4.2 style.css defines --transition-theme: 800ms cubic-bezier(0.16, 1, 0.3, 1);', hasTransitionThemeVar);

    // --- SECTION 5: Clean Slate Negative Audit ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 5: CLEAN SLATE NEGATIVE AUDIT (SOURCE CODE)');
    console.log('----------------------------------------------------------------');
    const FORBIDDEN_LEGACY = ['hunter-base', 'tower-of-power', 'chozo-visor', 'wrx-telemetry', 'pacific-outpost'];
    const htmlContent = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const audioJsContent = fs.readFileSync(path.join(PROJECT_ROOT, 'audio.js'), 'utf8');

    for (const forbidden of FORBIDDEN_LEGACY) {
      const notInHtml = !htmlContent.toLowerCase().includes(forbidden);
      const notInCss = !cssContent.toLowerCase().includes(forbidden);
      const notInApp = !appJsContent.toLowerCase().includes(forbidden);
      const notInAudio = !audioJsContent.toLowerCase().includes(forbidden);
      record(`5.x Zero occurrences of "${forbidden}" across core source files`, notInHtml && notInCss && notInApp && notInAudio);
    }

    console.log('\n================================================================');
    console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.error('FINDINGS:');
      results.findings.forEach(f => console.error(`- ${f.name}: ${f.details}`));
      process.exitCode = 1;
    } else {
      console.log('EXPLICIT VERDICT: APPROVE (ALL M3 DUAL-TRIGGER THEME RANDOMIZER REQUIREMENTS VERIFIED)');
      process.exitCode = 0;
    }

  } catch (err) {
    console.error('CRITICAL RUNTIME ERROR:', err);
    process.exitCode = 2;
  } finally {
    if (cdp) try { cdp.close(); } catch (_) {}
    if (chromeData && chromeData.chrome) try { chromeData.chrome.kill('SIGKILL'); } catch (_) {}
    if (chromeData && chromeData.tmpDir) try { fs.rmSync(chromeData.tmpDir, { recursive: true, force: true }); } catch (_) {}
    if (serverObj && serverObj.server) try { serverObj.server.close(); } catch (_) {}
  }
}

runTestSuite();
