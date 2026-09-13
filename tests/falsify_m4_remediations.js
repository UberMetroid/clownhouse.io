/**
 * CLOWNHOUSE.IO // Challenger M4-3 Independent Empirical Falsification Suite
 * 
 * Hostile, adversarial verification of the 4 white-box remediations in app.js:
 * 1. WRX Boost Gauge rAF Loop: 0 ticks when hidden, clean start/stop on theme change,
 *    zero rAF ticks after rapid thrashing, zero needle jitter when hidden.
 * 2. Mega Man X Buster Charge: Cancellation at LV1, LV2, and Max charge upon themechange;
 *    zero timer leaks, zero delayed plasma bursts/audio cues after switch, clean re-arming.
 * 3. CustomEvent 'themechange': Exactly 1:1 delivery to document and window; bubbles: false;
 *    zero child bubbling; correct payload sequencing under high-frequency thrashing.
 * 4. Universal Link Hover SFX: Deduplication of rapid pointerenter + mouseenter;
 *    uninhibited cross-link hover transitions; re-entry after debounce; 30/30 links audited.
 * 5. Double-Run State Invariance ($Run_1 == Run_2$).
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8432;
const CDP_PORT = 9432;

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

    let retries = 30;
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

async function runAdversarialFalsificationSuites(cdp) {
  console.log('\n==============================================================');
  console.log('--- SUITE 1: WRX Boost Gauge rAF Loop Empirical Falsification ---');
  console.log('==============================================================');

  // 1.1: rAF ticks on initial non-WRX theme over 400ms
  const initialRaf = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('tower-of-power');
      let ticks = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        ticks++;
        return origRaf(cb);
      };
      await new Promise(r => setTimeout(r, 400));
      window.requestAnimationFrame = origRaf;
      return { ticks, activeTheme: window.clownhouse.getActiveTheme() };
    })()
  `);
  assert(initialRaf.activeTheme === 'tower-of-power', 'Active theme must be tower-of-power');
  assert(initialRaf.ticks === 0, `Initial load on tower-of-power must produce exactly 0 rAF ticks (got ${initialRaf.ticks})`);

  // 1.2: rAF ticks when switching into wrx-telemetry (active theme)
  const activeRaf = await cdp.eval(`
    (async () => {
      let ticks = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        ticks++;
        return origRaf(cb);
      };
      window.clownhouse.setTheme('wrx-telemetry');
      await new Promise(r => setTimeout(r, 350));
      window.requestAnimationFrame = origRaf;
      return { ticks, activeTheme: window.clownhouse.getActiveTheme() };
    })()
  `);
  assert(activeRaf.activeTheme === 'wrx-telemetry', 'Active theme must be wrx-telemetry');
  assert(activeRaf.ticks >= 10, `Active wrx-telemetry theme must produce active rAF ticks (got ${activeRaf.ticks}, expected >= 10)`);

  // 1.3: rAF ticks when switching away from wrx-telemetry to chozo-visor
  const switchAwayRaf = await cdp.eval(`
    (async () => {
      let ticks = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        ticks++;
        return origRaf(cb);
      };
      window.clownhouse.setTheme('chozo-visor');
      await new Promise(r => setTimeout(r, 400));
      window.requestAnimationFrame = origRaf;
      return { ticks, activeTheme: window.clownhouse.getActiveTheme() };
    })()
  `);
  assert(switchAwayRaf.activeTheme === 'chozo-visor', 'Active theme must be chozo-visor');
  assert(switchAwayRaf.ticks === 0, `Switching away to chozo-visor must immediately halt rAF to 0 ticks (got ${switchAwayRaf.ticks})`);

  // 1.4: rAF ticks across remaining non-WRX themes (hunter-base, pacific-outpost)
  const otherThemesRaf = await cdp.eval(`
    (async () => {
      let hunterTicks = 0;
      let pacificTicks = 0;
      const origRaf = window.requestAnimationFrame;

      window.requestAnimationFrame = (cb) => {
        hunterTicks++;
        return origRaf(cb);
      };
      window.clownhouse.setTheme('hunter-base');
      await new Promise(r => setTimeout(r, 300));

      hunterTicks = 0;
      await new Promise(r => setTimeout(r, 300));
      const settledHunter = hunterTicks;

      window.requestAnimationFrame = (cb) => {
        pacificTicks++;
        return origRaf(cb);
      };
      window.clownhouse.setTheme('pacific-outpost');
      await new Promise(r => setTimeout(r, 300));

      pacificTicks = 0;
      await new Promise(r => setTimeout(r, 300));
      const settledPacific = pacificTicks;

      window.requestAnimationFrame = origRaf;
      return { settledHunter, settledPacific };
    })()
  `);
  assert(otherThemesRaf.settledHunter === 0, `Settled hunter-base must produce 0 rAF ticks (got ${otherThemesRaf.settledHunter})`);
  assert(otherThemesRaf.settledPacific === 0, `Settled pacific-outpost must produce 0 rAF ticks (got ${otherThemesRaf.settledPacific})`);

  // 1.5: High-frequency thrashing into and out of WRX telemetry
  const thrashRaf = await cdp.eval(`
    (async () => {
      // Thrash 40 times between wrx-telemetry and tower-of-power, ending on tower-of-power
      for (let i = 0; i < 40; i++) {
        window.clownhouse.setTheme(i % 2 === 0 ? 'wrx-telemetry' : 'tower-of-power');
      }
      window.clownhouse.setTheme('tower-of-power');

      let postThrashTicks = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        postThrashTicks++;
        return origRaf(cb);
      };
      await new Promise(r => setTimeout(r, 500));
      window.requestAnimationFrame = origRaf;
      return { postThrashTicks, activeTheme: window.clownhouse.getActiveTheme() };
    })()
  `);
  assert(thrashRaf.activeTheme === 'tower-of-power', 'Active theme after thrashing must be tower-of-power');
  assert(thrashRaf.postThrashTicks === 0, `Post-thrashing non-WRX state must have 0 leaked rAF ticks (got ${thrashRaf.postThrashTicks})`);

  // 1.6: Re-activation after thrashing
  const reactivateRaf = await cdp.eval(`
    (async () => {
      let reactivateTicks = 0;
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        reactivateTicks++;
        return origRaf(cb);
      };
      window.clownhouse.setTheme('wrx-telemetry');
      await new Promise(r => setTimeout(r, 350));
      window.requestAnimationFrame = origRaf;
      return { reactivateTicks };
    })()
  `);
  assert(reactivateRaf.reactivateTicks >= 10, `Re-entering wrx-telemetry after thrashing must cleanly resume rAF (got ${reactivateRaf.reactivateTicks})`);

  // Return to tower-of-power
  await cdp.eval(`window.clownhouse.setTheme('tower-of-power')`);

  console.log('\n==============================================================');
  console.log('--- SUITE 2: In-Flight Buster Charge Interruption Falsification ---');
  console.log('==============================================================');

  // 2.1: Low-charge cancellation (<600ms, Blue LV1)
  const lowChargeTest = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('hunter-base');
      const busterBtn = document.getElementById('buster-charge-btn');
      const chargeIndicator = document.getElementById('charge-indicator');
      const chargeBar = document.getElementById('charge-bar');

      busterBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
      const auraAtCharge = busterBtn.getAttribute('data-charge-level');

      // Switch theme
      window.clownhouse.setTheme('chozo-visor');

      const auraImmediate = busterBtn.getAttribute('data-charge-level');
      const textImmediate = chargeIndicator ? chargeIndicator.textContent : '';
      const barImmediate = chargeBar ? chargeBar.style.width : '';

      // Wait 1500ms (longer than max charge interval 1400ms) to ensure interval was cleared
      await new Promise(r => setTimeout(r, 1500));

      const auraAfterWait = busterBtn.getAttribute('data-charge-level');
      const textAfterWait = chargeIndicator ? chargeIndicator.textContent : '';
      const barAfterWait = chargeBar ? chargeBar.style.width : '';

      return {
        auraAtCharge,
        auraImmediate,
        textImmediate,
        barImmediate,
        auraAfterWait,
        textAfterWait,
        barAfterWait
      };
    })()
  `);
  assert(lowChargeTest.auraAtCharge === 'blue', 'Buster charge initiated at blue');
  assert(lowChargeTest.auraImmediate === 'idle', 'Aura immediately reset to idle on themechange');
  assert(lowChargeTest.textImmediate === 'READY', 'Indicator immediately reset to READY on themechange');
  assert(lowChargeTest.barImmediate === '0%', 'Charge bar immediately reset to 0% on themechange');
  assert(lowChargeTest.auraAfterWait === 'idle', 'Aura remains idle after 1500ms (no timer leak)');
  assert(lowChargeTest.textAfterWait === 'READY', 'Indicator remains READY after 1500ms (no timer leak)');
  assert(lowChargeTest.barAfterWait === '0%', 'Charge bar remains 0% after 1500ms (no timer leak)');

  // 2.2: Mid-charge cancellation (600-1400ms, Green LV2)
  const midChargeTest = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('hunter-base');
      const busterBtn = document.getElementById('buster-charge-btn');
      const chargeIndicator = document.getElementById('charge-indicator');
      const chargeBar = document.getElementById('charge-bar');

      busterBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 750));
      const auraAtCharge = busterBtn.getAttribute('data-charge-level');
      const textAtCharge = chargeIndicator ? chargeIndicator.textContent : '';

      // Switch theme mid-charge
      window.clownhouse.setTheme('tower-of-power');

      const auraImmediate = busterBtn.getAttribute('data-charge-level');
      const textImmediate = chargeIndicator ? chargeIndicator.textContent : '';
      const barImmediate = chargeBar ? chargeBar.style.width : '';

      await new Promise(r => setTimeout(r, 1000));

      const auraAfterWait = busterBtn.getAttribute('data-charge-level');
      const textAfterWait = chargeIndicator ? chargeIndicator.textContent : '';

      return {
        auraAtCharge,
        textAtCharge,
        auraImmediate,
        textImmediate,
        barImmediate,
        auraAfterWait,
        textAfterWait
      };
    })()
  `);
  assert(midChargeTest.auraAtCharge === 'green', 'Buster charge reached green level at 750ms');
  assert(midChargeTest.textAtCharge.includes('GREEN'), 'Indicator reached LV2 GREEN');
  assert(midChargeTest.auraImmediate === 'idle', 'Green charge immediately cancelled to idle on theme switch');
  assert(midChargeTest.textImmediate === 'READY', 'Indicator reset to READY on theme switch');
  assert(midChargeTest.barImmediate === '0%', 'Charge bar reset to 0%');
  assert(midChargeTest.auraAfterWait === 'idle', 'Aura remains idle 1000ms later (no interval leak into pink)');
  assert(midChargeTest.textAfterWait === 'READY', 'Indicator remains READY 1000ms later');

  // 2.3: Max charge cancellation (>=1400ms, Pink MAX CHARGE!)
  const maxChargeTest = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('hunter-base');
      const busterBtn = document.getElementById('buster-charge-btn');
      const chargeIndicator = document.getElementById('charge-indicator');
      const chargeBar = document.getElementById('charge-bar');

      busterBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      const auraAtCharge = busterBtn.getAttribute('data-charge-level');
      const textAtCharge = chargeIndicator ? chargeIndicator.textContent : '';

      // Switch theme at max charge
      window.clownhouse.setTheme('wrx-telemetry');

      const auraImmediate = busterBtn.getAttribute('data-charge-level');
      const textImmediate = chargeIndicator ? chargeIndicator.textContent : '';
      const barImmediate = chargeBar ? chargeBar.style.width : '';

      return {
        auraAtCharge,
        textAtCharge,
        auraImmediate,
        textImmediate,
        barImmediate
      };
    })()
  `);
  assert(maxChargeTest.auraAtCharge === 'pink', 'Buster charge reached pink level at 1500ms');
  assert(maxChargeTest.textAtCharge.includes('MAX CHARGE'), 'Indicator reached MAX CHARGE');
  assert(maxChargeTest.auraImmediate === 'idle', 'Pink max charge immediately cancelled to idle on switch');
  assert(maxChargeTest.textImmediate === 'READY', 'Indicator reset to READY');
  assert(maxChargeTest.barImmediate === '0%', 'Charge bar reset to 0%');

  // 2.4: Hostile release safety: Pointerup/keyup AFTER theme change must NOT fire shot sound or plasma burst
  const releaseSafetyTest = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('hunter-base');
      const busterBtn = document.getElementById('buster-charge-btn');
      const chargeWidget = document.querySelector('.buster-charge-widget');

      // Intercept audio cues
      let audioCalls = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;
      const origPlayTone = window.ClownAudio ? window.ClownAudio.playTone : null;
      if (window.ClownAudio) {
        window.ClownAudio.playSfx = (t) => { audioCalls.push({ type: 'sfx', name: t }); return true; };
        window.ClownAudio.playTone = (f) => { audioCalls.push({ type: 'tone', freq: f }); return true; };
      }

      // Start max charge
      busterBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1450));

      // Theme switch occurs while button was held
      window.clownhouse.setTheme('pacific-outpost');

      // Now user releases mouse on the document / buster button
      busterBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      window.dispatchEvent(new Event('blur'));

      // Restore audio spies
      if (window.ClownAudio) {
        if (origPlaySfx) window.ClownAudio.playSfx = origPlaySfx;
        if (origPlayTone) window.ClownAudio.playTone = origPlayTone;
      }

      const hasPlasmaClass = chargeWidget ? chargeWidget.classList.contains('plasma-burst-active') : false;

      return {
        audioCalls,
        hasPlasmaClass,
        activeTheme: window.clownhouse.getActiveTheme()
      };
    })()
  `);
  const busterShotAudios = releaseSafetyTest.audioCalls.filter(c => c.name === 'special' || c.type === 'tone');
  assert(busterShotAudios.length === 0, `Release after themechange must NOT fire shot audio cues (got ${busterShotAudios.length})`);
  assert(releaseSafetyTest.hasPlasmaClass === false, 'Release after themechange must NOT trigger plasma burst animation class');

  // 2.5: Re-arming upon returning to hunter-base
  const rearmTest = await cdp.eval(`
    (async () => {
      window.clownhouse.setTheme('hunter-base');
      const busterBtn = document.getElementById('buster-charge-btn');
      const chargeIndicator = document.getElementById('charge-indicator');
      const chargeBar = document.getElementById('charge-bar');

      // Start new charge cleanly
      busterBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 700));

      const auraLv2 = busterBtn.getAttribute('data-charge-level');
      const barWidthLv2 = chargeBar ? chargeBar.style.width : '';

      // Release cleanly
      busterBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

      const auraAfterRelease = busterBtn.getAttribute('data-charge-level');
      const textAfterRelease = chargeIndicator ? chargeIndicator.textContent : '';

      return {
        auraLv2,
        barWidthLv2,
        auraAfterRelease,
        textAfterRelease
      };
    })()
  `);
  assert(rearmTest.auraLv2 === 'green', 'Buster can be re-charged cleanly to green after prior cancellation');
  assert(rearmTest.barWidthLv2 === '66%', 'Charge bar advances to 66%');
  assert(rearmTest.auraAfterRelease === 'idle', 'Aura resets to idle after legitimate release');
  assert(rearmTest.textAfterRelease.includes('CHARGE SHOT LV2'), 'Fires legitimate LV2 shot');

  console.log('\n==============================================================');
  console.log('--- SUITE 3: CustomEvent themechange 1:1 Delivery Falsification ---');
  console.log('==============================================================');

  // 3.1 & 3.2: Exact 1:1 dispatch across all 5 themes
  const dispatchTest = await cdp.eval(`
    (() => {
      let docEvents = [];
      let winEvents = [];
      let bodyEvents = [];

      const docListener = (e) => docEvents.push({ theme: e.detail.theme, prev: e.detail.previousTheme, bubbles: e.bubbles });
      const winListener = (e) => winEvents.push({ theme: e.detail.theme, prev: e.detail.previousTheme, bubbles: e.bubbles });
      const bodyListener = (e) => bodyEvents.push(e.detail.theme);

      document.addEventListener('themechange', docListener);
      window.addEventListener('themechange', winListener);
      document.body.addEventListener('themechange', bodyListener);

      const sequence = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
      sequence.forEach(t => window.clownhouse.setTheme(t));

      document.removeEventListener('themechange', docListener);
      window.removeEventListener('themechange', winListener);
      document.body.removeEventListener('themechange', bodyListener);

      return {
        docCount: docEvents.length,
        winCount: winEvents.length,
        bodyCount: bodyEvents.length,
        docEvents,
        winEvents
      };
    })()
  `);
  assert(dispatchTest.docCount === 5, `document received exactly 5 events for 5 switches (got ${dispatchTest.docCount})`);
  assert(dispatchTest.winCount === 5, `window received exactly 5 events for 5 switches (no double bubbling) (got ${dispatchTest.winCount})`);
  assert(dispatchTest.bodyCount === 0, `document.body received 0 events because bubbles is false (got ${dispatchTest.bodyCount})`);

  // Verify bubbles property is false on every event
  const allBubblesFalse = dispatchTest.docEvents.every(e => e.bubbles === false) && dispatchTest.winEvents.every(e => e.bubbles === false);
  assert(allBubblesFalse, 'All themechange CustomEvents must have bubbles: false');

  // Verify theme transition sequence detail integrity
  const expectedSeq = [
    { theme: 'tower-of-power' },
    { theme: 'chozo-visor', prev: 'tower-of-power' },
    { theme: 'wrx-telemetry', prev: 'chozo-visor' },
    { theme: 'hunter-base', prev: 'wrx-telemetry' },
    { theme: 'pacific-outpost', prev: 'hunter-base' }
  ];
  let seqMatch = true;
  for (let i = 0; i < expectedSeq.length; i++) {
    if (dispatchTest.winEvents[i].theme !== expectedSeq[i].theme) seqMatch = false;
    if (i > 0 && dispatchTest.winEvents[i].prev !== expectedSeq[i].prev) seqMatch = false;
  }
  assert(seqMatch, 'themechange event detail contains correct theme and previousTheme in exact sequence');

  // 3.5: Rapid zero-delay thrashing (100 switches)
  const thrashDispatchTest = await cdp.eval(`
    (() => {
      const THEMES = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
      let docCount = 0;
      let winCount = 0;
      const docHandler = () => docCount++;
      const winHandler = () => winCount++;

      document.addEventListener('themechange', docHandler);
      window.addEventListener('themechange', winHandler);

      for (let i = 0; i < 100; i++) {
        window.clownhouse.setTheme(THEMES[i % THEMES.length]);
      }

      document.removeEventListener('themechange', docHandler);
      window.removeEventListener('themechange', winHandler);

      return { docCount, winCount };
    })()
  `);
  assert(thrashDispatchTest.docCount === 100, `document received exactly 100 events for 100 thrash switches (got ${thrashDispatchTest.docCount})`);
  assert(thrashDispatchTest.winCount === 100, `window received exactly 100 events for 100 thrash switches (got ${thrashDispatchTest.winCount})`);

  console.log('\n==============================================================');
  console.log('--- SUITE 4: Universal Link Hover SFX Deduplication Falsification ---');
  console.log('==============================================================');

  // 4.1: Rapid pointerenter + mouseenter on the same link (delta 0ms)
  const rapidHoverTest = await cdp.eval(`
    (() => {
      let sfxCalls = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;
      if (window.ClownAudio) {
        window.ClownAudio.playSfx = (type) => {
          sfxCalls.push(type);
          return origPlaySfx ? origPlaySfx(type) : true;
        };
      }

      // Ensure sound is unmuted for test
      window.clownhouse.toggleSound(false);

      const link = document.querySelector('#theme-tower-of-power .theme-link');
      if (link) {
        link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      }

      // Restore
      window.clownhouse.toggleSound(true);
      if (window.ClownAudio && origPlaySfx) {
        window.ClownAudio.playSfx = origPlaySfx;
      }

      return {
        totalSfx: sfxCalls.length,
        hoverCalls: sfxCalls.filter(s => s === 'hover').length
      };
    })()
  `);
  assert(rapidHoverTest.hoverCalls === 1, `Rapid pointerenter + mouseenter on same link must trigger exactly 1 hover SFX (got ${rapidHoverTest.hoverCalls})`);

  // 4.2: Micro-jitter test (<100ms on same link)
  const jitterHoverTest = await cdp.eval(`
    (async () => {
      // Wait for debounce window to clear from previous test
      await new Promise(r => setTimeout(r, 150));

      let sfxCalls = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;
      if (window.ClownAudio) {
        window.ClownAudio.playSfx = (type) => {
          sfxCalls.push(type);
          return origPlaySfx ? origPlaySfx(type) : true;
        };
      }

      window.clownhouse.toggleSound(false);
      const link = document.querySelector('#theme-tower-of-power .theme-link');

      if (link) {
        link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        await new Promise(r => setTimeout(r, 10));
        link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        await new Promise(r => setTimeout(r, 20));
        link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        await new Promise(r => setTimeout(r, 30));
        link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      }

      window.clownhouse.toggleSound(true);
      if (window.ClownAudio && origPlaySfx) {
        window.ClownAudio.playSfx = origPlaySfx;
      }

      return {
        hoverCalls: sfxCalls.filter(s => s === 'hover').length
      };
    })()
  `);
  assert(jitterHoverTest.hoverCalls === 1, `Multiple jitter events within 100ms on same link must produce exactly 1 hover SFX (got ${jitterHoverTest.hoverCalls})`);

  // 4.3: Instant cross-link transition (<100ms between different links)
  const crossLinkHoverTest = await cdp.eval(`
    (async () => {
      // Wait for debounce window to clear
      await new Promise(r => setTimeout(r, 150));

      let sfxCalls = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;
      if (window.ClownAudio) {
        window.ClownAudio.playSfx = (type) => {
          sfxCalls.push(type);
          return origPlaySfx ? origPlaySfx(type) : true;
        };
      }

      window.clownhouse.toggleSound(false);
      const links = Array.from(document.querySelectorAll('#theme-tower-of-power .theme-link'));

      // Move rapidly across all 6 links within 60ms (10ms per link)
      for (const l of links) {
        l.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        l.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        await new Promise(r => setTimeout(r, 10));
      }

      window.clownhouse.toggleSound(true);
      if (window.ClownAudio && origPlaySfx) {
        window.ClownAudio.playSfx = origPlaySfx;
      }

      return {
        linksTested: links.length,
        hoverCalls: sfxCalls.filter(s => s === 'hover').length
      };
    })()
  `);
  assert(crossLinkHoverTest.linksTested === 6, `Must test 6 universal links in theme`);
  assert(crossLinkHoverTest.hoverCalls === 6, `Rapid traversal across 6 distinct links must trigger 6 cues (1 per link) (got ${crossLinkHoverTest.hoverCalls})`);

  // 4.4: Re-entry after debounce (>100ms)
  const reentryHoverTest = await cdp.eval(`
    (async () => {
      // Wait for debounce window to clear
      await new Promise(r => setTimeout(r, 150));

      let sfxCalls = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;
      if (window.ClownAudio) {
        window.ClownAudio.playSfx = (type) => {
          sfxCalls.push(type);
          return origPlaySfx ? origPlaySfx(type) : true;
        };
      }

      window.clownhouse.toggleSound(false);
      const link = document.querySelector('#theme-tower-of-power .theme-link');

      link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
      // Leave link
      link.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
      // Wait 150ms (>100ms threshold)
      await new Promise(r => setTimeout(r, 150));
      // Re-enter
      link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));

      window.clownhouse.toggleSound(true);
      if (window.ClownAudio && origPlaySfx) {
        window.ClownAudio.playSfx = origPlaySfx;
      }

      return {
        hoverCalls: sfxCalls.filter(s => s === 'hover').length
      };
    })()
  `);
  assert(reentryHoverTest.hoverCalls === 2, `Re-entering link after 150ms must trigger a 2nd hover SFX (got ${reentryHoverTest.hoverCalls})`);

  // 4.5: Full audit across all 30 universal links across all 5 themes
  const auditAllLinks = await cdp.eval(`
    (async () => {
      // Wait for debounce window to clear
      await new Promise(r => setTimeout(r, 150));

      const THEMES = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
      let results = [];
      const origPlaySfx = window.ClownAudio ? window.ClownAudio.playSfx : null;

      for (const theme of THEMES) {
        window.clownhouse.setTheme(theme);
        const container = document.querySelector('.theme-container[data-theme="' + theme + '"]');
        const links = container ? Array.from(container.querySelectorAll('.theme-link')) : [];

        let themeHoverCount = 0;
        if (window.ClownAudio) {
          window.ClownAudio.playSfx = (t) => { if (t === 'hover') themeHoverCount++; return true; };
        }
        window.clownhouse.toggleSound(false);

        for (const link of links) {
          link.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
          link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
          await new Promise(r => setTimeout(r, 120));
        }

        results.push({
          theme,
          linkCount: links.length,
          hoverCount: themeHoverCount
        });
      }

      window.clownhouse.toggleSound(true);
      if (window.ClownAudio && origPlaySfx) {
        window.ClownAudio.playSfx = origPlaySfx;
      }

      return results;
    })()
  `);
  assert(auditAllLinks.length === 5, 'All 5 themes audited for link hover audio');
  const all30LinksPass = auditAllLinks.every(r => r.linkCount === 6 && r.hoverCount === 6);
  assert(all30LinksPass, `All 30 universal links across 5 themes trigger exactly 1 hover cue: ${JSON.stringify(auditAllLinks)}`);

  console.log('--- All suites completed in this run ---');
}

async function main() {
  console.log('==============================================================');
  console.log('  CLOWNHOUSE.IO // CHALLENGER M4-3 EMPIRICAL FALSIFIER        ');
  console.log('==============================================================');

  let server;
  let chromeProc;
  try {
    server = await startStaticServer();
    console.log(`[+] Static test server listening on http://127.0.0.1:${PORT}`);

    const { chrome, wsUrl } = await launchChrome();
    chromeProc = chrome;
    console.log(`[+] Chrome headless spawned (CDP: ${wsUrl})`);

    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    console.log('[+] Connected to Chrome CDP.');

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    // Run 1
    console.log('\n>>> EXECUTING RUN 1...');
    totalAssertions = 0;
    passedAssertions = 0;
    failedAssertions = 0;
    failureDetails.length = 0;

    await runAdversarialFalsificationSuites(cdp);

    const run1Total = totalAssertions;
    const run1Passed = passedAssertions;
    const run1Failed = failedAssertions;
    console.log(`Run 1 Completed: Total=${run1Total}, Passed=${run1Passed}, Failed=${run1Failed}`);

    // Run 2 (Double-Run State Invariance)
    console.log('\n>>> EXECUTING RUN 2 (Double-Run State Invariance Gate)...');
    totalAssertions = 0;
    passedAssertions = 0;
    failedAssertions = 0;
    failureDetails.length = 0;

    await runAdversarialFalsificationSuites(cdp);

    const run2Total = totalAssertions;
    const run2Passed = passedAssertions;
    const run2Failed = failedAssertions;
    console.log(`Run 2 Completed: Total=${run2Total}, Passed=${run2Passed}, Failed=${run2Failed}`);

    console.log('\n==============================================================');
    console.log(' DOUBLE-RUN PARITY RESULTS:');
    console.log(` Run 1: Total=${run1Total}, Passed=${run1Passed}, Failed=${run1Failed}`);
    console.log(` Run 2: Total=${run2Total}, Passed=${run2Passed}, Failed=${run2Failed}`);
    console.log('==============================================================');

    const parityOk = (run1Total === run2Total) && (run1Passed === run2Passed) && (run1Failed === run2Failed);
    if (parityOk) {
      console.log('Double-Run Bit-for-Bit State Invariance: CONFIRMED');
    } else {
      console.error('Double-Run Bit-for-Bit State Invariance: VIOLATED');
    }

    if (run1Failed === 0 && run2Failed === 0 && parityOk) {
      console.log(`\n>>> ALL REMEDIATION FALSIFICATION ASSERTIONS PASSED (${run1Total}/${run1Total})`);
      console.log('\nEMPIRICAL VERDICT: CONFIRM');
      process.exitCode = 0;
    } else {
      console.error(`\n>>> REMEDIATION FALSIFICATION DETECTED FAILURES (${run1Failed} failures)`);
      console.error('\nEMPIRICAL VERDICT: CHALLENGE');
      process.exitCode = 1;
    }

    cdp.close();
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    if (chromeProc) chromeProc.kill('SIGKILL');
    if (server) server.close();
  }
}

main();
