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

