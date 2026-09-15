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
