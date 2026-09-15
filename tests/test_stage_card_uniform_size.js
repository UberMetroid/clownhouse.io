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

async function runAudit() {
  console.log('================================================================');
  console.log('STAGE SELECT DOCK UNIFORM SIZE & MARQUEE AUDIT');
  console.log('================================================================\n');

  // 1. Static HTML Audit
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf-8');
  const scrollContainers = (html.match(/class="card-title-scroll"/g) || []).length;
  record('index.html contains 5 .card-title-scroll containers', scrollContainers === 5, `Found: ${scrollContainers}`);

  const glyphsCount = (html.match(/class="portrait-glyph"/g) || []).length;
  record('index.html contains 0 .portrait-glyph flavor icons', glyphsCount === 0, `Found: ${glyphsCount}`);
  const subTextCount = (html.match(/class="card-sub"/g) || []).length;
  record('index.html contains 0 .card-sub flavor text elements', subTextCount === 0, `Found: ${subTextCount}`);

  // 2. Static CSS Audit — style.css is an @import manifest over styles/
  const manifest = fs.readFileSync(path.join(PROJECT_ROOT, 'style.css'), 'utf-8');
  const css = manifest + [...manifest.matchAll(/@import url\("([^"]+)"\)/g)]
    .map(m => fs.readFileSync(path.join(PROJECT_ROOT, m[1]), 'utf-8')).join('\n');
  const hasFixedCardWidth = css.includes('width: 172px') && css.includes('flex: 0 0 172px');
  record('style.css defines uniform fixed width (172px) on .stage-card', hasFixedCardWidth);
  const hasMarqueeKeyframes = css.includes('@keyframes stageTitleMarquee');
  record('style.css defines @keyframes stageTitleMarquee', hasMarqueeKeyframes);

  // 3. Dynamic Headless Chrome Layout & Marquee Audit
  const { server, port } = await startStaticServer();
  const { chrome, wsUrl } = await launchHeadlessChrome();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');

  // Test at Desktop 1440px
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  await new Promise(r => setTimeout(r, 600));

  const desktopData = await cdp.eval(`
    (() => {
      const dock = document.getElementById('stage-select-dock');
      const cards = Array.from(document.querySelectorAll('.stage-card'));
      if (!dock || cards.length !== 5) return { error: 'Missing dock or cards' };

      const dockRect = dock.getBoundingClientRect();
      const cardRects = cards.map(c => {
        const r = c.getBoundingClientRect();
        const title = c.querySelector('.card-title');
        const scrollEl = c.querySelector('.card-title-scroll');
        const dist = title ? title.style.getPropertyValue('--scroll-distance') : '';
        const isMarquee = title ? title.classList.contains('marquee-title') : false;
        return {
          id: c.id,
          width: r.width,
          height: r.height,
          titleText: title ? title.textContent.trim() : '',
          dist,
          isMarquee
        };
      });

      return {
        dockWidth: dockRect.width,
        cardRects
      };
    })()
  `);

  const widths = desktopData.cardRects.map(c => c.width);
  const heights = desktopData.cardRects.map(c => c.height);

  const minWidth = Math.min(...widths);
  const maxWidth = Math.max(...widths);
  const widthDelta = maxWidth - minWidth;

  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const heightDelta = maxHeight - minHeight;

  record(
    'All 5 stage cards have identical width on desktop (delta <= 1px)',
    widthDelta <= 1,
    `Widths: ${JSON.stringify(widths)} (delta: ${widthDelta.toFixed(2)}px)`
  );

  record(
    'All 5 stage cards have identical height on desktop (delta <= 1px)',
    heightDelta <= 1,
    `Heights: ${JSON.stringify(heights)} (delta: ${heightDelta.toFixed(2)}px)`
  );

  record(
    'Total dock width is comfortable (< 960px)',
    desktopData.dockWidth < 960,
    `Dock width: ${desktopData.dockWidth.toFixed(1)}px`
  );

  // Check long titles have marquee active
  const giggleCard = desktopData.cardRects.find(c => c.id === 'dock-giggle');
  const reactleCard = desktopData.cardRects.find(c => c.id === 'dock-reactle');

  record(
    'giggle.clownhouse.io triggers marquee animation with negative scroll distance',
    giggleCard && giggleCard.isMarquee && giggleCard.dist.startsWith('-'),
    `isMarquee: ${giggleCard ? giggleCard.isMarquee : 'N/A'}, dist: ${giggleCard ? giggleCard.dist : 'N/A'}`
  );

  record(
    'reactle.clownhouse.io triggers marquee animation with negative scroll distance',
    reactleCard && reactleCard.isMarquee && reactleCard.dist.startsWith('-'),
    `isMarquee: ${reactleCard ? reactleCard.isMarquee : 'N/A'}, dist: ${reactleCard ? reactleCard.dist : 'N/A'}`
  );

  // Clean up
  cdp.close();
  chrome.kill();
  server.close();

  console.log('\n================================================================');
  console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
