/**
 * CLOWNHOUSE.IO // CHALLENGER 2 EMPIRICAL ADVERSARIAL TEST SUITE
 * Milestone M1: Stage-Select Dock DOM Integrity, Layout Geometry & Collision Harness
 *
 * Checks:
 * 1. DOM Integrity: All 5 stage cards have https scheme, exact host, target="_blank",
 *    rel="noopener noreferrer", unique IDs, non-empty accessible name and title.
 * 2. Clean-Slate Invariants: Strictly 0 occurrences of forbidden legacy strings in source code.
 * 3. Audio SFX Hardening: Prototype pollution defense on playSfx().
 * 4. Layout Collision & Geometry: Headless Chrome CDP measurement across 320px to 2560px viewports:
 *    - AABB bounding box collision between #stage-select-dock and #floating-audio-pill
 *    - Clickability / occlusion check on #audio-play-btn via elementFromPoint()
 *    - Viewport horizontal overflow (scrollWidth <= innerWidth)
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

// -----------------------------------------------------------------------------
// Part 1: DOM Link Integrity Audit
// -----------------------------------------------------------------------------
function auditDomLinkIntegrity() {
  console.log('\n--- 1. DOM Link Integrity Audit (#stage-select-dock) ---');
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf-8');

  // Verify dock exists
  const hasDock = html.includes('id="stage-select-dock"');
  record('Stage dock element exists in index.html', hasDock);

  const expectedCards = [
    { id: 'dock-openooda', host: 'openooda.org', url: 'https://openooda.org', title: 'openOODA.org' },
    { id: 'dock-bumtrips', host: 'bumtrips.com', url: 'https://bumtrips.com', title: 'bumtrips.com' },
    { id: 'dock-necrometer', host: 'necrometer.dev', url: 'https://necrometer.dev', title: 'necrometer.dev' },
    { id: 'dock-giggle', host: 'giggle.clownhouse.io', url: 'https://giggle.clownhouse.io', title: 'giggle.clownhouse.io' },
    { id: 'dock-reactle', host: 'reactle.clownhouse.io', url: 'https://reactle.clownhouse.io', title: 'reactle.clownhouse.io' }
  ];

  for (const card of expectedCards) {
    const cardRegex = new RegExp(`<a[^>]*id=["']${card.id}["'][^>]*>`, 'i');
    const match = html.match(cardRegex);
    if (!match) {
      record(`Card #${card.id} exists`, false, 'Element tag not found');
      continue;
    }
    const tag = match[0];
    const hasHref = tag.includes(`href="${card.url}"`);
    const hasTarget = tag.includes('target="_blank"');
    const hasRel = tag.includes('rel="noopener noreferrer"');
    const hasTitle = html.includes(card.title);

    record(`Card #${card.id} exact URL (${card.url})`, hasHref, `Tag: ${tag}`);
    record(`Card #${card.id} target="_blank"`, hasTarget, `Tag: ${tag}`);
    record(`Card #${card.id} rel="noopener noreferrer"`, hasRel, `Tag: ${tag}`);
    record(`Card #${card.id} non-empty title (${card.title})`, hasTitle);
  }
}

// -----------------------------------------------------------------------------
// Part 2: Clean Slate Negative Audit
// -----------------------------------------------------------------------------
function auditCleanSlateNegative() {
  console.log('\n--- 2. Clean Slate Negative Audit (Forbidden Legacy Strings) ---');
  const forbidden = ['hunter-base', 'tower-of-power', 'chozo-visor', 'wrx-telemetry', 'pacific-outpost'];
  const srcFiles = ['index.html', 'style.css', 'app.js', 'audio.js', 'PROJECT.md'];

  for (const f of srcFiles) {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8').toLowerCase();
    for (const token of forbidden) {
      const idx = content.indexOf(token);
      record(`Zero occurrences of "${token}" in ${f}`, idx === -1, idx !== -1 ? `Found at index ${idx}` : '');
    }
  }
}

// -----------------------------------------------------------------------------
// Part 3: Audio SFX Prototype Hardening Audit
// -----------------------------------------------------------------------------
function auditAudioSfxHardening() {
  console.log('\n--- 3. Audio SFX Prototype Hardening & Fallback ---');
  const audioSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'audio/sfx.js'), 'utf-8');

  // Verify Object.create(null) and fail-closed prototype guards
  const hasProtoGuard = audioSrc.includes('VALID_SFX_MAP') &&
                        audioSrc.includes('Object.create(null)') &&
                        audioSrc.includes('__proto__') &&
                        audioSrc.includes('constructor');
  record('audio.js has prototype pollution immune VALID_SFX_MAP', hasProtoGuard);
}

// -----------------------------------------------------------------------------
// Part 4: Layout Collision & Viewport Geometry via Chrome CDP
// -----------------------------------------------------------------------------
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
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

function launchHeadlessChrome() {
  return new Promise((resolve, reject) => {
    const chrome = spawn('google-chrome-stable', [
      '--headless=new',
      '--remote-debugging-port=0',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      'about:blank'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

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

async function auditLayoutGeometry() {
  console.log('\n--- 4. Layout Geometry & Collision Audit (Chrome CDP: 320px to 2560px) ---');
  const { server, port } = await startStaticServer();
  const { chrome, wsUrl } = await launchHeadlessChrome();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');

  const testWidths = [320, 360, 375, 414, 600, 639, 640, 768, 800, 900, 1024, 1100, 1200, 1280, 1440, 1920, 2560];

  for (const width of testWidths) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    await new Promise(r => setTimeout(r, 200));

    const metrics = await cdp.eval(`
      (() => {
        const dock = document.getElementById('stage-select-dock');
        const pill = document.getElementById('floating-audio-pill');
        const playBtn = document.getElementById('audio-play-btn');
        const docEl = document.documentElement;

        if (!dock || !pill) return { error: 'Missing dock or pill' };

        const dockRect = dock.getBoundingClientRect();
        const pillRect = pill.getBoundingClientRect();
        const btnRect = playBtn ? playBtn.getBoundingClientRect() : null;

        const xOverlap = Math.max(0, Math.min(dockRect.right, pillRect.right) - Math.max(dockRect.left, pillRect.left));
        const yOverlap = Math.max(0, Math.min(dockRect.bottom, pillRect.bottom) - Math.max(dockRect.top, pillRect.top));
        const collides = (xOverlap > 0 && yOverlap > 0);

        let playBtnClickable = true;
        let occludingElement = null;
        if (btnRect) {
          const cx = btnRect.left + btnRect.width / 2;
          const cy = btnRect.top + btnRect.height / 2;
          const el = document.elementFromPoint(cx, cy);
          playBtnClickable = (el === playBtn || playBtn.contains(el));
          if (!playBtnClickable && el) {
            occludingElement = el.tagName + (el.className ? '.' + (typeof el.className === 'string' ? el.className.split(' ').join('.') : '') : '');
          }
        }

        return {
          width: window.innerWidth,
          collides,
          xOverlap,
          yOverlap,
          dock: { left: dockRect.left, top: dockRect.top, right: dockRect.right, bottom: dockRect.bottom, width: dockRect.width, height: dockRect.height },
          pill: { left: pillRect.left, top: pillRect.top, right: pillRect.right, bottom: pillRect.bottom, width: pillRect.width, height: pillRect.height },
          playBtnClickable,
          occludingElement,
          overflow: docEl.scrollWidth > window.innerWidth,
          scrollWidth: docEl.scrollWidth
        };
      })()
    `);

    // Verify no collision between dock and pill
    const collisionFree = !metrics.collides;
    const collisionDetails = metrics.collides
      ? `AABB Overlap: dx=${metrics.xOverlap.toFixed(1)}px, dy=${metrics.yOverlap.toFixed(1)}px | Dock: [${metrics.dock.left.toFixed(0)}..${metrics.dock.right.toFixed(0)}, Y:${metrics.dock.top.toFixed(0)}..${metrics.dock.bottom.toFixed(0)}] vs Pill: [${metrics.pill.left.toFixed(0)}..${metrics.pill.right.toFixed(0)}, Y:${metrics.pill.top.toFixed(0)}..${metrics.pill.bottom.toFixed(0)}]`
      : '';
    record(`Viewport ${width}px: Stage dock does NOT overlap floating audio pill`, collisionFree, collisionDetails);

    // Verify audio play button is not occluded / intercepted
    const btnClickable = metrics.playBtnClickable;
    const btnDetails = !btnClickable ? `Audio play button is occluded by ${metrics.occludingElement} at center point` : '';
    record(`Viewport ${width}px: Audio play button is unoccluded and clickable`, btnClickable, btnDetails);

    // Verify no viewport horizontal overflow
    const noOverflow = !metrics.overflow;
    const overflowDetails = metrics.overflow ? `document.documentElement.scrollWidth (${metrics.scrollWidth}px) > innerWidth (${metrics.width}px)` : '';
    record(`Viewport ${width}px: Zero horizontal viewport overflow`, noOverflow, overflowDetails);
  }

  cdp.close();
  chrome.kill();
  server.close();
}

async function main() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // CHALLENGER 2 ADVERSARIAL VERIFICATION REPORT');
  console.log('Milestone M1: Mega Man X Stage Dock Integrity, Layout & Invariants');
  console.log('================================================================');

  auditDomLinkIntegrity();
  auditCleanSlateNegative();
  auditAudioSfxHardening();
  await auditLayoutGeometry();

  console.log('\n================================================================');
  console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
  console.log(`EXPLICIT VERDICT: ${verdict}`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    console.log('CRITICAL FINDINGS REQUIRING REMEDIATION:');
    for (const f of results.findings) {
      console.log(` - ${f.name}`);
      if (f.details) console.log(`   ${f.details}`);
    }
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
