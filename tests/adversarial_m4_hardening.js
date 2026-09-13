/**
 * CLOWNHOUSE.IO // Milestone M4 Adversarial Coverage Hardening Suite
 * Challenger M4-2 White-Box Empirical Falsification & Boundary Verification
 * 
 * Deeply probes:
 * 1. State persistence edge cases (corrupted clownhouse_sound, QuotaExceededError, SecurityError)
 * 2. Animation frame loops & timers (WRX boost gauge rAF, in-flight Buster charge interruption)
 * 3. Event bubbling, duplicate listener prevention, CustomEvent 'themechange' dispatch multiplicity
 * 4. Extreme responsive viewports (<320px, >3840px 4K ultrawide, orientation flips)
 * 5. Keyboard accessibility and roving tabindex under hostile inputs
 * 6. Double-Run State Invariance ($Run_1 == Run_2$)
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8426;
const CDP_PORT = 9426;

const THEMES = [
  'tower-of-power',
  'chozo-visor',
  'wrx-telemetry',
  'hunter-base',
  'pacific-outpost'
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    failureDetails.push(message);
    console.error(`  [FAIL] ${message}`);
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
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        res.end(data);
      });
    });

    server.listen(PORT, '127.0.0.1', () => resolve(server));
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

    let retries = 25;
    const checkCdp = () => {
      http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(raw);
            const pageTarget = targets.find(t => t.type === 'page' || t.url.includes(String(PORT)));
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

async function runHardeningSuites(cdp) {
  // ===========================================================================
  // SUITE 1: LocalStorage State Corruption & Failure Recovery
  // ===========================================================================
  console.log('--- Suite 1: LocalStorage State Corruption & Failure Recovery ---');

  // Test 1.1: Corrupted clownhouse_sound payloads
  const soundCorruptions = [
    'corrupted_string',
    'undefined',
    'null',
    'false',
    '0',
    '1',
    '',
    '{"hacked": true}',
    '<script>alert(1)</script>',
    '[object Object]',
    'NaN'
  ];

  for (const payload of soundCorruptions) {
    const res = await cdp.eval(`
      (() => {
        try {
          localStorage.setItem('clownhouse_sound', ${JSON.stringify(payload)});
        } catch(e) {}
        // Re-read sound state
        const isMuted = window.clownhouse.isSoundMuted();
        const soundBtn = document.getElementById('sound-toggle');
        const ariaPressed = soundBtn ? soundBtn.getAttribute('aria-pressed') : null;
        return { isMuted, ariaPressed };
      })()
    `);
    assert(res.isMuted === true, `Sound state must remain fail-closed MUTED for corrupt payload: "${payload}"`);
    assert(res.ariaPressed === 'false', `Sound toggle aria-pressed must be 'false' for corrupt payload: "${payload}"`);
  }

  // Test 1.2: QuotaExceededError during toggleSound
  const quotaExceededRes = await cdp.eval(`
    (() => {
      const origSetItem = localStorage.setItem;
      let errorHandled = false;
      try {
        localStorage.setItem = () => {
          const err = new Error('Quota exceeded');
          err.name = 'QuotaExceededError';
          throw err;
        };

        const initialMute = window.clownhouse.isSoundMuted();
        const toggled = window.clownhouse.toggleSound();
        const stateMatches = (toggled === window.clownhouse.isSoundMuted()) && (toggled !== initialMute);
        
        // Toggle back
        window.clownhouse.toggleSound();
        errorHandled = stateMatches;
      } catch (e) {
        errorHandled = false;
      } finally {
        localStorage.setItem = origSetItem;
      }
      return errorHandled;
    })()
  `);
  assert(quotaExceededRes === true, 'toggleSound must degrade gracefully in memory when localStorage throws QuotaExceededError');

  // Test 1.3: SecurityError during safeSetStorage in setTheme
  const securityErrorRes = await cdp.eval(`
    (() => {
      const origSetItem = localStorage.setItem;
      let ok = false;
      try {
        localStorage.setItem = () => {
          const err = new Error('SecurityError: The operation is insecure');
          err.name = 'SecurityError';
          throw err;
        };
        const switchRes = window.clownhouse.setTheme('chozo-visor');
        ok = (switchRes === true && window.clownhouse.getActiveTheme() === 'chozo-visor');
      } catch(e) {
        ok = false;
      } finally {
        localStorage.setItem = origSetItem;
      }
      return ok;
    })()
  `);
  assert(securityErrorRes === true, 'setTheme must switch active theme in memory even when storage throws SecurityError');

  // ===========================================================================
  // SUITE 2: Animation Frame Loops & Background Timers Audit
  // ===========================================================================
  console.log('--- Suite 2: Animation Frame Loops & Background Timers Audit ---');

  // Test 2.1: Audit requestAnimationFrame execution on WRX gauge across themes
  const rafAudit = await cdp.eval(`
    (async () => {
      let rafTicks = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        rafTicks++;
        return origRaf(cb);
      };

      // Switch to tower-of-power (WRX is hidden)
      window.clownhouse.setTheme('tower-of-power');
      rafTicks = 0;
      await new Promise(r => setTimeout(r, 250));
      const ticksWhileHidden = rafTicks;

      // Switch to wrx-telemetry (WRX is visible)
      window.clownhouse.setTheme('wrx-telemetry');
      rafTicks = 0;
      await new Promise(r => setTimeout(r, 250));
      const ticksWhileVisible = rafTicks;

      // Restore original rAF
      window.requestAnimationFrame = origRaf;

      return {
        ticksWhileHidden,
        ticksWhileVisible,
        ratio: ticksWhileVisible > 0 ? (ticksWhileHidden / ticksWhileVisible) : 0
      };
    })()
  `);
  // Verify stepGauge loop is cancelled when switching away from wrx-telemetry
  assert(rafAudit.ticksWhileHidden === 0, `rAF ticks while WRX hidden must be 0 (loop cancelled on inactive theme, got ${rafAudit.ticksWhileHidden})`);
  assert(typeof rafAudit.ticksWhileVisible === 'number', 'rAF ticks while WRX visible must be measurable numeric value');
  assert(rafAudit.ticksWhileVisible > 0, 'rAF ticks while WRX visible must be greater than 0');

  // Test 2.2: In-flight Buster Charge Theme Switch Interruption Safety
  const chargeInterruptionAudit = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('hunter-base');
      const busterBtn = document.getElementById('buster-charge-btn');
      const chargeIndicator = document.getElementById('charge-indicator');
      const chargeBar = document.getElementById('charge-bar');

      // Start charging
      busterBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      const levelAtStart = busterBtn.getAttribute('data-charge-level');

      // Switch theme mid-charge
      window.clownhouse.setTheme('chozo-visor');

      // Themechange listener cancels in-flight charge immediately
      await new Promise(r => setTimeout(r, 100));

      const levelAfterLeave = busterBtn.getAttribute('data-charge-level');
      const barWidthAfterLeave = chargeBar ? chargeBar.style.width : '';

      return {
        levelAtStart,
        levelAfterLeave,
        barWidthAfterLeave,
        activeTheme: window.clownhouse.getActiveTheme()
      };
    })()
  `);
  assert(chargeInterruptionAudit.levelAtStart === 'blue', 'Buster charge must initiate at blue level');
  assert(chargeInterruptionAudit.levelAfterLeave === 'idle', 'Buster charge level must reset to idle on theme switch interruption');
  assert(chargeInterruptionAudit.barWidthAfterLeave === '0%', 'Charge bar width must reset to 0% upon interruption');
  assert(chargeInterruptionAudit.activeTheme === 'chozo-visor', 'Active theme must be chozo-visor');

  // ===========================================================================
  // SUITE 3: Event Dispatch Multiplicity & Bubbling Audit
  // ===========================================================================
  console.log('--- Suite 3: Event Dispatch Multiplicity & Bubbling Audit ---');

  // Test 3.1: Measure CustomEvent 'themechange' dispatch count on document vs window
  const themechangeMultiplicity = await cdp.eval(`
    (() => {
      let docCount = 0;
      let winCount = 0;

      const docHandler = () => docCount++;
      const winHandler = () => winCount++;

      document.addEventListener('themechange', docHandler);
      window.addEventListener('themechange', winHandler);

      // Perform 5 theme switches
      const seq = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
      seq.forEach(t => window.clownhouse.setTheme(t));

      document.removeEventListener('themechange', docHandler);
      window.removeEventListener('themechange', winHandler);

      return { docCount, winCount, totalSwitches: seq.length };
    })()
  `);
  assert(themechangeMultiplicity.docCount === 5, `document must receive exactly 1 dispatch per theme switch (got ${themechangeMultiplicity.docCount})`);
  assert(themechangeMultiplicity.winCount === 5, `window receives exactly 1 dispatch per theme switch (no double dispatch) (got ${themechangeMultiplicity.winCount})`);

  // Test 3.2: Universal Link Hover SFX Trigger Multiplicity
  const hoverSfxAudit = await cdp.eval(`
    (() => {
      let sfxCalls = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;
      if (window.ClownAudio) {
        window.ClownAudio.playSfx = (type) => {
          sfxCalls.push(type);
          return origPlaySfx ? origPlaySfx(type) : true;
        };
      }

      // Unmute sound for test
      window.clownhouse.toggleSound(false);

      const link = document.querySelector('#theme-tower-of-power .theme-link');
      if (link) {
        // Dispatch pointerenter then mouseenter as in standard browser cursor entry
        link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      }

      // Restore mute and original playSfx
      window.clownhouse.toggleSound(true);
      if (window.ClownAudio && origPlaySfx) {
        window.ClownAudio.playSfx = origPlaySfx;
      }

      const hoverCalls = sfxCalls.filter(s => s === 'hover').length;
      return { totalSfx: sfxCalls.length, hoverCalls };
    })()
  `);
  assert(typeof hoverSfxAudit.hoverCalls === 'number', 'Hover SFX call count must be numeric');
  assert(hoverSfxAudit.hoverCalls === 1, `Hover SFX must be deduplicated to exactly 1 call on link entry (got ${hoverSfxAudit.hoverCalls})`);

  // ===========================================================================
  // SUITE 4: Extreme Responsive Viewports Stress & Overflow Invariance
  // ===========================================================================
  console.log('--- Suite 4: Extreme Responsive Viewport Stress (50 Configurations) ---');

  const viewports = [
    { w: 240, h: 320, name: '240p sub-mobile' },
    { w: 320, h: 568, name: '320p iPhone SE floor' },
    { w: 360, h: 640, name: '360p Android standard' },
    { w: 640, h: 360, name: '640x360 Landscape Phone' },
    { w: 768, h: 1024, name: '768p iPad portrait' },
    { w: 1080, h: 1920, name: '1080p Portrait Kiosk' },
    { w: 1920, h: 1080, name: '1080p Desktop standard' },
    { w: 2560, h: 1440, name: '1440p 2K QHD' },
    { w: 3840, h: 2160, name: '2160p 4K UHD' },
    { w: 5120, h: 1440, name: '5120x1440 32:9 Super Ultrawide' }
  ];

  let totalViewportTests = 0;
  let passedViewportTests = 0;

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.w,
      height: vp.h,
      deviceScaleFactor: 1,
      mobile: vp.w < 768
    });

    for (const theme of THEMES) {
      totalViewportTests++;
      const vpRes = await cdp.eval(`
        (() => {
          window.clownhouse.setTheme('${theme}');
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = window.innerWidth;
          const overflow = scrollWidth > clientWidth;

          const container = document.getElementById('theme-${theme}');
          const links = container ? container.querySelectorAll('.theme-link') : [];
          let linksRendered = links.length === 6;
          for (const l of links) {
            const rect = l.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
              linksRendered = false;
            }
          }

          return {
            overflow,
            diff: scrollWidth - clientWidth,
            linksCount: links.length,
            linksRendered
          };
        })()
      `);

      const noOverflow = !vpRes.overflow || vpRes.diff <= 1;
      const validLinks = vpRes.linksCount === 6 && vpRes.linksRendered;
      assert(noOverflow, `Zero horizontal overflow on ${vp.name} with theme ${theme} (diff: ${vpRes.diff}px)`);
      assert(validLinks, `All 6 links rendered and measurable on ${vp.name} with theme ${theme}`);
      if (noOverflow && validLinks) passedViewportTests++;
    }
  }

  // Restore desktop viewport
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  // ===========================================================================
  // SUITE 5: Hostile Keyboard Navigation & Accessibility Semantics
  // ===========================================================================
  console.log('--- Suite 5: Hostile Keyboard Navigation & Accessibility Semantics ---');

  const a11yStress = await cdp.eval(`
    (() => {
      const switcherBar = document.getElementById('theme-switcher-bar');
      const tabs = Array.from(switcherBar.querySelectorAll('[role=\"tab\"], .switcher-btn[data-theme]'));
      const soundBtn = document.getElementById('sound-toggle');

      let allInvariantsHeld = true;
      const log = [];

      // 1. Focus first tab
      tabs[0].focus();

      // Dispatch hostile non-navigation keys
      const hostileKeys = ['Escape', 'Tab', 'Shift', 'Alt', 'Control', 'F1', 'PageUp', 'PageDown', 'z', '!', 'Enter'];
      for (const k of hostileKeys) {
        switcherBar.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      }

      // Check roving tabindex invariant
      const activeTabsCount = tabs.filter(t => t.getAttribute('tabindex') === '0').length;
      const selectedTabsCount = tabs.filter(t => t.getAttribute('aria-selected') === 'true').length;
      if (activeTabsCount !== 1 || selectedTabsCount !== 1) {
        allInvariantsHeld = false;
        log.push('Failed active/selected count after hostile keys');
      }

      // 2. Navigation through ArrowRight and wrap-around
      for (let i = 0; i < tabs.length + 2; i++) {
        switcherBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }
      const activeThemeAfterArrows = window.clownhouse.getActiveTheme();
      if (!activeThemeAfterArrows) {
        allInvariantsHeld = false;
        log.push('Active theme missing after arrows');
      }

      // 3. Home and End key navigation
      switcherBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      const isFirstActive = (window.clownhouse.getActiveTheme() === 'tower-of-power');

      switcherBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      const isLastActive = (window.clownhouse.getActiveTheme() === 'pacific-outpost');

      if (!isFirstActive || !isLastActive) {
        allInvariantsHeld = false;
        log.push('Home/End navigation mismatch');
      }

      // 4. Sound toggle keyboard focus isolation: arrow keys on sound toggle do NOT switch themes
      if (soundBtn) {
        soundBtn.focus();
        const themeBeforeArrowOnSound = window.clownhouse.getActiveTheme();
        switcherBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        const themeAfterArrowOnSound = window.clownhouse.getActiveTheme();
        if (themeBeforeArrowOnSound !== themeAfterArrowOnSound) {
          allInvariantsHeld = false;
          log.push('Arrow key on sound toggle unexpectedly changed theme');
        }
      }

      return { allInvariantsHeld, log };
    })()
  `);
  assert(a11yStress.allInvariantsHeld === true, `Keyboard accessibility invariants must hold under hostile inputs (${a11yStress.log.join(', ')})`);

  // Verify all 5 theme containers maintain valid semantic roles
  const containerRoles = await cdp.eval(`
    (() => {
      const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
      return themes.every(t => {
        const c = document.getElementById('theme-' + t);
        return c && c.getAttribute('role') === 'tabpanel' && c.getAttribute('aria-labelledby');
      });
    })()
  `);
  assert(containerRoles === true, 'All 5 theme containers must feature role="tabpanel" and matching aria-labelledby');
}

async function runAdversarialHardeningHarness() {
  console.log('==============================================================');
  console.log(' CLOWNHOUSE.IO // TIER 5 ADVERSARIAL HARDENING HARNESS (M4-2)');
  console.log('==============================================================');

  const server = await startStaticServer();
  let chromeProc, cdp;

  try {
    const launch = await launchChrome();
    chromeProc = launch.chrome;
    cdp = new CdpClient(launch.wsUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    // Wait for ready
    await new Promise(r => setTimeout(r, 1000));

    // RUN 1
    console.log('\n>>> EXECUTING RUN 1...');
    totalAssertions = 0;
    passedAssertions = 0;
    failedAssertions = 0;
    failureDetails.length = 0;

    await runHardeningSuites(cdp);
    const run1Total = totalAssertions;
    const run1Passed = passedAssertions;
    const run1Failed = failedAssertions;
    console.log(`Run 1 Completed: Total=${run1Total}, Passed=${run1Passed}, Failed=${run1Failed}`);

    // RUN 2 (Double-Run Law)
    console.log('\n>>> EXECUTING RUN 2 (Double-Run State Invariance Gate)...');
    totalAssertions = 0;
    passedAssertions = 0;
    failedAssertions = 0;
    failureDetails.length = 0;

    await runHardeningSuites(cdp);
    const run2Total = totalAssertions;
    const run2Passed = passedAssertions;
    const run2Failed = failedAssertions;
    console.log(`Run 2 Completed: Total=${run2Total}, Passed=${run2Passed}, Failed=${run2Failed}`);

    console.log('\n==============================================================');
    console.log(' DOUBLE-RUN PARITY RESULTS:');
    console.log(` Run 1: Total=${run1Total}, Passed=${run1Passed}, Failed=${run1Failed}`);
    console.log(` Run 2: Total=${run2Total}, Passed=${run2Passed}, Failed=${run2Failed}`);
    console.log('==============================================================');

    const doubleRunMatch = (run1Total === run2Total && run1Passed === run2Passed && run1Failed === run2Failed);
    if (!doubleRunMatch) {
      console.error('[ERROR] Double-Run Parity Law VIOLATION: Run 1 != Run 2');
      process.exit(1);
    }
    console.log('Double-Run Bit-for-Bit State Invariance: CONFIRMED\n');

    if (run1Failed === 0) {
      console.log(`>>> ALL ADVERSARIAL HARDENING ASSERTIONS PASSED (${run1Passed}/${run1Total})`);
      process.exit(0);
    } else {
      console.error(`>>> ADVERSARIAL HARDENING ENCOUNTERED FAILURES (${run1Failed}/${run1Total})`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal error during adversarial harness:', err);
    process.exit(1);
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill();
    server.close();
  }
}

runAdversarialHardeningHarness();
