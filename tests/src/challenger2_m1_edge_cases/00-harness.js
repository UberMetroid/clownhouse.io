/**
 * CLOWNHOUSE.IO // CHALLENGER 2 EMPIRICAL ADVERSARIAL TEST SUITE
 * Milestone M1: Core Omarchy Foundation & Theme Engine Hardening Invariants
 *
 * Focus Invariants:
 * 1. Symbol Coercion & Type Hardening in setTheme():
 *    - setTheme(Symbol('foo')), setTheme(Symbol()), setTheme(Symbol.for('catppuccin'))
 *    - setTheme({ toString() { throw new Error('trap'); } })
 *    - Defensive validation against null, undefined, numbers, objects, booleans, arrays
 *    - Fail-closed fallback to 'tokyo-night' without unhandled TypeErrors or application crash
 *
 * 2. Null & Boundary Search Invariants in ClownPalette.search():
 *    - ClownPalette.search(null), search(undefined), search(123), search(Symbol('query'))
 *    - Fail-closed return of empty array [] without throwing TypeError (e.g. null.trim())
 *    - Valid search queries: empty string (all catalog items), multi-token queries, zero-match queries
 *
 * 3. Rapid Keydown Holding & Auto-Repeat Suppression (e.repeat):
 *    - Initial keydown (e.repeat = false) cycles theme by exactly 1 position
 *    - 100 sustained auto-repeat keydown events (e.repeat = true) strictly suppressed (0 cycles)
 *    - Subsequent keydown (e.repeat = false) resumes cycling
 *    - Typing context & modal open suppression
 *
 * 4. Browser CDP Real-World Invariants & Zero Console Errors:
 *    - Captures all Runtime.exceptionThrown and Runtime.consoleAPICalled (type === 'error')
 *    - Zero console errors or unhandled promise rejections
 *
 * 5. Mandatory Anti-Vacuity & Negative Falsification Gates (User Global Rule 12):
 *    - Proves probes detect mutations in repeat-guard, symbol-handling, and null-search
 *
 * 6. Double-Run Parity Law:
 *    - Verifies Run_1 == Run_2 invariance
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

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
      const port = server.address().port;
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

