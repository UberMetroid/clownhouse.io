/**
 * CLOWNHOUSE.IO // Stage Select Uniform Size & Marquee Verification
 *
 * Verifies:
 * 1. Static Contract: All 5 stage cards contain .card-title-scroll and .card-title.
 * 2. Static CSS: .stage-card defines fixed uniform width and height.
 * 3. Empirical Layout (Headless Chrome CDP):
 *    - All 5 stage cards have exact identical bounding box widths across desktop and tablet.
 *    - All 5 stage cards have exact identical bounding box heights.
 *    - Total dock width remains compact (< 600px on desktop) — not super big.
 *    - Long web addresses (giggle.clownhouse.io, reactle.clownhouse.io) trigger marquee animation
 *      and have non-zero --scroll-distance computed.
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
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(PROJECT_ROOT, reqPath);

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function launchHeadlessChrome() {
  return new Promise((resolve, reject) => {
    const chrome = spawn('google-chrome', [
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--mute-audio',
      '--window-size=1440,900',
      'about:blank'
    ]);

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        chrome.kill();
        reject(new Error('Chrome launch timeout'));
      }
    }, 10000);

    chrome.stderr.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/[a-f0-9-]+)/);
      if (match && !settled) {
        const cdpPort = parseInt(match[2], 10);
        let retries = 20;
        const findPage = () => {
          http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
              try {
                const targets = JSON.parse(body);
                const pageTarget = targets.find(t => t.type === 'page');
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                  settled = true;
                  clearTimeout(timeout);
                  resolve({ chrome, wsUrl: pageTarget.webSocketDebuggerUrl, port: cdpPort });
                } else if (retries-- > 0) {
                  setTimeout(findPage, 100);
                } else {
                  settled = true;
                  clearTimeout(timeout);
                  reject(new Error('No page target found'));
                }
              } catch (e) {
                if (retries-- > 0) setTimeout(findPage, 100);
                else {
                  settled = true;
                  clearTimeout(timeout);
                  reject(e);
                }
              }
            });
          }).on('error', () => {
            if (retries-- > 0) setTimeout(findPage, 100);
            else {
              settled = true;
              clearTimeout(timeout);
              reject(new Error('Failed to reach Chrome JSON API'));
            }
          });
        };
        setTimeout(findPage, 150);
      }
    });
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
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
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

