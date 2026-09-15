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
