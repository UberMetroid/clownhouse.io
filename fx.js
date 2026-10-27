/**
 * fx.js (v4.0.0) — Interactive Bayer-Dithered Pixel CLOWNHOUSE Canvas Stage,
 * Indexed Pixel Haunted Manor & Grounds, Watching Heterochromia Clown,
 * Window-Clipped Interior Wisps, Ground-Floor Web Audio Music-Box & Spectrum EQ,
 * and 8-Bit Retro Theme Palette Switcher.
 */
(function () {
  'use strict';

  var ACCENTS = [
    { name: 'Coral', hex: '#ff5555', rgb: [255, 85, 85], hot: '#ff9999', hotRgb: [255, 153, 153] },
    { name: 'Orange', hex: '#ff7700', rgb: [255, 119, 0], hot: '#ffa040', hotRgb: [255, 160, 64] },
    { name: 'Amber', hex: '#ffb000', rgb: [255, 176, 0], hot: '#ffd447', hotRgb: [255, 212, 71] },
    { name: 'Yellow', hex: '#f1fa8c', rgb: [241, 250, 140], hot: '#ffffb0', hotRgb: [255, 255, 176] },
    { name: 'Emerald', hex: '#50fa7b', rgb: [80, 250, 123], hot: '#a2ffbc', hotRgb: [162, 255, 188] },
    { name: 'Cyan', hex: '#00e5ff', rgb: [0, 229, 255], hot: '#80f4ff', hotRgb: [128, 244, 255] },
    { name: 'Blue', hex: '#3b82f6', rgb: [59, 130, 246], hot: '#7cb3ff', hotRgb: [124, 179, 255] },
    { name: 'Violet', hex: '#bd93f9', rgb: [189, 147, 249], hot: '#d9b8ff', hotRgb: [217, 184, 255] }
  ];

  // 114x17 binary pixel grid for "CLOWNHOUSE"
  var CLOWNHOUSE_WORDMARK = [
    '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    '000111111000111000000000011111000011100000111001110000111001110000111000011111000011100011100001111110001111111110',
    '001111111100111000000000111111100011100000111001111000111001110000111000111111100011100011100011111111001111111110',
    '011100011100111000000001110001110011100000111001111100111001110000111001110001110011100011100111000111001110000000',
    '011100000000111000000001110001110011100000111001111110111001110000111001110001110011100011100111000000001110000000',
    '011100000000111000000001110001110011100000111001111111111001110000111001110001110011100011100111100000001110000000',
    '011100000000111000000001110001110011100100111001111111111001111111111001110001110011100011100011111100001111111000',
    '011100000000111000000001110001110011101110111001110111111001111111111001110001110011100011100001111110001111111000',
    '011100000000111000000001110001110011101110111001110011111001111111111001110001110011100011100000001111001111111000',
    '011100000000111000000001110001110011101110111001110001111001110000111001110001110011100011100000000111001110000000',
    '011100000000111000000001110001110011111111111001110000111001110000111001110001110011100011100000000111001110000000',
    '011100000000111000000001110001110011111111111001110000111001110000111001110001110011100011100111000111001110000000',
    '011100011100111000000001110001110001111011110001110000111001110000111001110001110011100011100111000111001110000000',
    '001111111100111111111000111111100001110001110001110000111001110000111000111111100001111111000011111110001111111110',
    '000111111000111111111000011111000001100000110001110000111001110000111000011111000000111110000001111100001111111110',
    '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
  ];

  // 34x17 binary pixel grid for "404"
  var WORDMARK_404 = [
    '0000000000000000000000000000000000',
    '0000001111000011111000000000111100',
    '0000011111000111111100000001111100',
    '0000111111001110001110000011111100',
    '0001110111001110001110000111011100',
    '0011100111001110001110001110011100',
    '0111000111001110001110011100011100',
    '0111000111001110001110011100011100',
    '0111111111101110001110011111111110',
    '0111111111101110001110011111111110',
    '0000000111001110001110000000011100',
    '0000000111001110001110000000011100',
    '0000000111001110001110000000011100',
    '0000000111000111111100000000011100',
    '0000000111000011111000000000011100',
    '0000000000000000000000000000000000',
    '0000000000000000000000000000000000'
  ];

  var is404Page = document.body && document.body.getAttribute('data-page') === '404';
  var ACTIVE_WORDMARK = is404Page ? WORDMARK_404 : CLOWNHOUSE_WORDMARK;

  window.ClownhouseWordmark = {
    width: ACTIVE_WORDMARK[0].length,
    height: ACTIVE_WORDMARK.length,
    rows: ACTIVE_WORDMARK
  };

  // --- Zero-Dependency Web Audio 16-Bit Synth Engine ---
  var audioCtx = null;
  var musicPlaying = false;
  var musicTimer = null;
  var musicStep = 0;

  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try { audioCtx = new AC(); } catch (e) {}
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  function playKnockSound() {
    var ac = ensureAudio();
    if (!ac) return;
    var now = ac.currentTime;
    // Three ominous heavy wooden knocks (low triangle + sub thud)
    var offsets = [0, 0.21, 0.44];
    for (var i = 0; i < offsets.length; i++) {
      var t0 = now + offsets[i];
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(118 - i * 8, t0);
      osc.frequency.exponentialRampToValueAtTime(34, t0 + 0.14);
      gain.gain.setValueAtTime(0.32, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    }
  }

  function playChimeSound() {
    var ac = ensureAudio();
    if (!ac) return;
    var now = ac.currentTime;
    // 16-bit eerie clown darting micro-chime
    var freqs = [587.33, 698.46, 880.0, 1108.73];
    for (var i = 0; i < freqs.length; i++) {
      var t0 = now + i * 0.045;
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freqs[i], t0);
      gain.gain.setValueAtTime(0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    }
  }

  function playThunderSound() {
    var ac = ensureAudio();
    if (!ac) return;
    var now = ac.currentTime;
    // Stepped 16-bit crack + low rumble
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Dark Gothic Music Box waltz notes (D harmonic minor / diminished celesta loop)
  var MELODY_NOTES = [
    587.33, 698.46, 880.00, 932.33, 880.00, 698.46,
    554.37, 659.25, 880.00, 1046.50, 880.00, 659.25,
    587.33, 698.46, 1174.66, 1108.73, 932.33, 880.00,
    698.46, 659.25, 554.37, 587.33, 440.00, 293.66
  ];
  var BASS_NOTES = [
    146.83, 0, 220.00, 146.83, 0, 220.00,
    138.59, 0, 220.00, 138.59, 0, 220.00,
    146.83, 0, 233.08, 174.61, 0, 220.00,
    164.81, 0, 138.59, 146.83, 0, 146.83
  ];

  function updateEqBar() {
    if (window.clownhouseRenderSpotlight) {
      window.clownhouseRenderSpotlight();
    }
  }

  function tickMusicBox() {
    if (!musicPlaying) return;
    var ac = ensureAudio();
    if (ac) {
      var now = ac.currentTime;
      var note = MELODY_NOTES[musicStep % MELODY_NOTES.length];
      var bass = BASS_NOTES[musicStep % BASS_NOTES.length];
      if (note > 0) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.34);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.36);

        // Faint 16-bit celesta overtone
        var osc2 = ac.createOscillator();
        var gain2 = ac.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(note * 2, now);
        gain2.gain.setValueAtTime(0.028, now);
        gain2.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);
        osc2.connect(gain2);
        gain2.connect(ac.destination);
        osc2.start(now);
        osc2.stop(now + 0.24);
      }
      if (bass > 0) {
        var bOsc = ac.createOscillator();
        var bGain = ac.createGain();
        bOsc.type = 'square';
        bOsc.frequency.setValueAtTime(bass, now);
        bGain.gain.setValueAtTime(0.025, now);
        bGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
        bOsc.connect(bGain);
        bGain.connect(ac.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.3);
      }
    }
    updateEqBar();
    musicStep++;
  }

  function toggleMusicBox() {
    musicPlaying = !musicPlaying;
    var btn = document.getElementById('act-music');
    if (btn) {
      btn.classList.toggle('active', musicPlaying);
      btn.setAttribute('aria-pressed', musicPlaying ? 'true' : 'false');
    }
    if (musicPlaying) {
      if (window.clownhouseEvictClownFromMusicRoom) {
        window.clownhouseEvictClownFromMusicRoom();
      }
      ensureAudio();
      tickMusicBox();
      musicTimer = setInterval(tickMusicBox, 260);
    } else {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
      updateEqBar();
    }
  }

  // --- Palette & Wordmark Header Rendering ---
  function applyAccent(a) {
    if (!a) return;
    var r = a.rgb[0], g = a.rgb[1], b = a.rgb[2];
    var hr = a.hotRgb[0], hg = a.hotRgb[1], hb = a.hotRgb[2];
    window.clownhouseCurrentAccent = a.rgb;
    window.clownhouseCurrentAccentName = a.name;

    try {
      localStorage.setItem('clownhouse_accent', a.name.toLowerCase());
    } catch (e) {}

    var root = document.documentElement;
    root.style.setProperty('--phosphor', a.hex);
    root.style.setProperty('--accent', a.hex);
    root.style.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);
    root.style.setProperty('--phosphor-dim', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.14)');
    root.style.setProperty('--phosphor-glow', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.32)');
    root.style.setProperty('--border-accent', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.42)');
    root.style.setProperty('--hot', a.hot);
    root.style.setProperty('--hot-rgb', hr + ', ' + hg + ', ' + hb);
    root.style.setProperty('--spotlight-border', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.56)');
    root.style.setProperty('--spotlight-glow', 'rgba(' + hr + ', ' + hg + ', ' + hb + ', 0.94)');
    root.style.setProperty('--spotlight-inner', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.055)');

    var btns = document.querySelectorAll('[data-accent-name]');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      var active = (btn.getAttribute('data-accent-name') || '').toLowerCase() === a.name.toLowerCase();
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
    }

    var swatchLabel = document.getElementById('dock-swatch-name');
    if (swatchLabel) {
      swatchLabel.textContent = a.name.toUpperCase();
    }

    if (window.clownhouseRenderWordmark) {
      window.clownhouseRenderWordmark();
    }
    if (window.clownhouseRenderSpotlight) {
      window.clownhouseRenderSpotlight();
    }
  }

  function renderHeaderWordmark() {
    var hCanvas = document.getElementById('header-wordmark');
    if (!hCanvas || !hCanvas.getContext) return;
    var hCtx = hCanvas.getContext('2d');
    if (!hCtx) return;
    var cols = ACTIVE_WORDMARK[0].length, rows = ACTIVE_WORDMARK.length;
    var scale = 3;
    hCanvas.width = cols * scale;
    hCanvas.height = rows * scale;
    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
    var acc = window.clownhouseCurrentAccent || [189, 147, 249];
    var ar = acc[0], ag = acc[1], ab = acc[2];
    var hr = Math.min(255, Math.round(ar + (255 - ar) * 0.48));
    var hg = Math.min(255, Math.round(ag + (255 - ag) * 0.48));
    var hb = Math.min(255, Math.round(ab + (255 - ab) * 0.48));
    for (var r = 0; r < rows; r++) {
      var rowStr = ACTIVE_WORDMARK[r];
      for (var c = 0; c < cols; c++) {
        if (rowStr.charAt(c) === '1') {
          hCtx.fillStyle = r < 5
            ? '#ffffff'
            : (r < 11
              ? ('rgb(' + hr + ',' + hg + ',' + hb + ')')
              : ('rgb(' + ar + ',' + ag + ',' + ab + ')'));
          hCtx.fillRect(c * scale, r * scale, scale - 0.5, scale - 0.5);
        }
      }
    }
  }
  window.clownhouseRenderWordmark = renderHeaderWordmark;

  function initPalette() {
    var saved = 'violet';
    try {
      saved = localStorage.getItem('clownhouse_accent') || 'violet';
    } catch (e) {}
    var initial = null;
    for (var i = 0; i < ACCENTS.length; i++) {
      if (ACCENTS[i].name.toLowerCase() === saved.toLowerCase()) {
        initial = ACCENTS[i];
        break;
      }
    }
    applyAccent(initial || ACCENTS[7]);

    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var btn = target.closest('[data-accent-name]');
      if (!btn) return;
      var name = btn.getAttribute('data-accent-name') || '';
      for (var j = 0; j < ACCENTS.length; j++) {
        if (ACCENTS[j].name.toLowerCase() === name.toLowerCase()) {
          applyAccent(ACCENTS[j]);
          break;
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) === -1) return;
      var btn = document.activeElement;
      if (!btn || !btn.matches || !btn.matches('[data-accent-name]')) return;
      var group = btn.closest('[role="radiogroup"]');
      if (!group) return;
      var items = Array.prototype.slice.call(group.querySelectorAll('[data-accent-name]'));
      var idx = items.indexOf(btn);
      if (idx === -1) return;
      e.preventDefault();
      var next = (e.key === 'ArrowRight' || e.key === 'ArrowDown')
        ? (idx + 1) % items.length
        : (idx - 1 + items.length) % items.length;
      items[next].focus();
      items[next].click();
    }, true);
  }

  // --- Indexed 96x54 Pixel Haunted Manor & Grounds ---
  // Tile codes:
  // 0: SKY (Bayer plasma)
  // 1: INK (Manor brick wall)
  // 2: EDGE (Lit stone corner / cornice trim)
  // 3: ROOF (Gabled slate roof & spire)
  // 4: ROOF_E (Roof rim-light & gargoyles)
  // 5: FRAME (Window mullion frame)
  // 6: DOOR (Front manor oak door)
  // 7: GROUND (Manor lawn & front steps)
  // 8: FENCE (Crooked wrought-iron pickets)
  // 9: TREE (Dead gnarled trees)
  // 10..19: PANE (10 individual manor windows: 0..7 main block, 8 tower, 9 annex)
  var MANOR_W = 96, MANOR_H = 54;
  var manorGrid = new Uint8Array(MANOR_W * MANOR_H);
  var WINDOWS = [
    { id: 0, name: 'WEST PARLOR (2F)', cx: 29, y0: 29, y1: 35, w: 4 },
    { id: 1, name: 'GALLERY WEST (2F)', cx: 39, y0: 29, y1: 35, w: 4 },
    { id: 2, name: 'MIRROR ROOM (2F)', cx: 59, y0: 29, y1: 35, w: 4 },
    { id: 3, name: 'EAST NURSERY (2F)', cx: 69, y0: 29, y1: 35, w: 4 },
    { id: 4, name: 'FOYER WEST (1F)', cx: 29, y0: 39, y1: 46, w: 4 },
    { id: 5, name: 'DRAWING ROOM (1F)', cx: 39, y0: 39, y1: 46, w: 4 },
    { id: 6, name: 'MUSIC ROOM (1F)', cx: 59, y0: 39, y1: 46, w: 4 },
    { id: 7, name: 'VESTIBULE (1F)', cx: 69, y0: 39, y1: 46, w: 4 },
    { id: 8, name: 'BELFRY SPIRE', cx: 15, y0: 20, y1: 29, w: 6 },
    { id: 9, name: 'EAST ANNEX', cx: 84, y0: 36, y1: 46, w: 4 }
  ];

  (function buildManor() {
    function put(x, y, c) {
      if (x >= 0 && x < MANOR_W && y >= 0 && y < MANOR_H) {
        manorGrid[y * MANOR_W + x] = c;
      }
    }
    function rect(x0, y0, x1, y1, c) {
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) put(x, y, c);
      }
    }
    function peak(cx, ytop, ybase, half, c, edge) {
      for (var y = ytop; y <= ybase; y++) {
        var hw = Math.round((y - ytop) * half / (ybase - ytop));
        for (var x = cx - hw; x <= cx + hw; x++) put(x, y, c);
        if (edge) {
          put(cx - hw, y, edge);
          put(cx + hw, y, edge);
        }
      }
    }

    // Chimney
    rect(66, 12, 70, 24, 1);
    rect(65, 10, 71, 12, 2);
    // Main gable roof & main manor body
    peak(49, 7, 25, 34, 3, 4);
    rect(22, 25, 78, 49, 1);
    rect(22, 25, 22, 49, 2);
    rect(78, 25, 78, 49, 2);
    // Right annex + gable (connected to main manor at x=79)
    rect(79, 31, 89, 49, 1);
    rect(89, 31, 89, 49, 2);
    peak(84, 26, 31, 7, 3, 4);
    // Left Gothic spire + tower body
    peak(15, 3, 15, 9, 3, 4);
    rect(9, 15, 22, 49, 1);
    rect(9, 15, 9, 49, 2);
    rect(22, 15, 22, 49, 2);
    // Spire finial cross & gargoyles
    put(15, 1, 4); put(15, 2, 2); put(14, 2, 4); put(16, 2, 4);
    rect(6, 14, 8, 15, 2); put(5, 13, 4); put(7, 13, 4);
    rect(79, 24, 81, 25, 2); put(82, 23, 4); put(80, 23, 4);

    // Ground
    rect(0, 50, 95, 53, 7);

    // Crooked Iron Fence (drawn before windows & door so foreground panes stay intact)
    for (var fx = 2; fx < 95; fx += 3) {
      if (fx >= 44 && fx <= 54) continue;
      var fh = (fx % 6 === 0) ? 45 : 46;
      for (var fy = fh; fy <= 49; fy++) put(fx, fy, 8);
      put(fx, fh - 1, 4);
    }
    rect(1, 48, 43, 48, 8);
    rect(55, 48, 94, 48, 8);

    // Dead Gnarled Trees (left & right)
    rect(3, 35, 4, 49, 9);
    put(2, 34, 9); put(1, 32, 9); put(0, 31, 9);
    put(5, 34, 9); put(6, 32, 9); put(7, 30, 9);
    put(2, 38, 9); put(1, 37, 9); put(5, 39, 9);

    rect(92, 33, 93, 49, 9);
    put(91, 31, 9); put(90, 29, 9);
    put(94, 32, 9); put(95, 30, 9);
    put(91, 37, 9); put(94, 36, 9); put(95, 35, 9);

    // 10 Windows (drawn after fence so 1st-floor window panes and frames are clean)
    for (var i = 0; i < WINDOWS.length; i++) {
      var w = WINDOWS[i];
      var hw = Math.floor(w.w / 2);
      rect(w.cx - hw - 1, w.y0 - 1, w.cx + hw + 1, w.y1 + 1, 5);
      rect(w.cx - hw, w.y0, w.cx + hw, w.y1, 10 + w.id);
    }

    // Front Door + Steps + Lintel
    rect(46, 41, 52, 49, 6);
    rect(45, 40, 53, 40, 2);
    rect(44, 50, 54, 51, 7);
  })();

  // --- Bayer 8x8 Dither + Perlin-Style Plasma + Haunted Manor Stage ---
  function initCanvas() {
    var canvas = document.getElementById('spotlight-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    var BAYER = [
      0, 32, 8, 40, 2, 34, 10, 42,
      48, 16, 56, 24, 50, 18, 58, 26,
      12, 44, 4, 36, 14, 46, 6, 38,
      60, 28, 52, 20, 62, 30, 54, 22,
      3, 35, 11, 43, 1, 33, 9, 41,
      51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37,
      63, 31, 55, 23, 61, 29, 53, 21
    ];
    var N = 128, smoothAcc = null;
    var noiseTable = (function () {
      var seed = 10407530, buf = new Float32Array(N * N);
      for (var i = 0; i < buf.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        buf[i] = seed / 4294967296;
      }
      for (var p = 0; p < 2; p++) {
        var next = new Float32Array(N * N);
        for (var y = 0; y < N; y++) {
          for (var x = 0; x < N; x++) {
            var sum = 0;
            for (var dy = -1; dy <= 1; dy++) {
              for (var dx = -1; dx <= 1; dx++) {
                sum += buf[((y + dy + N) % N) * N + ((x + dx + N) % N)];
              }
            }
            next[y * N + x] = sum / 9;
          }
        }
        buf = next;
      }
      var min = Infinity, max = -Infinity;
      for (var j = 0; j < buf.length; j++) {
        if (buf[j] < min) min = buf[j];
        if (buf[j] > max) max = buf[j];
      }
      var span = max - min || 1;
      for (var k = 0; k < buf.length; k++) buf[k] = (buf[k] - min) / span;
      return buf;
    })();

    function sampleNoise(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var x0 = (ix % N + N) % N, y0 = (iy % N + N) % N, x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
      var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return (noiseTable[y0 * N + x0] * (1 - sx) + noiseTable[y0 * N + x1] * sx) * (1 - sy) +
             (noiseTable[y1 * N + x0] * (1 - sx) + noiseTable[y1 * N + x1] * sx) * sy;
    }

    var TEXT_SEL = 'h1,h2,h3,p,pre,code,label,input,button,a,.site-header,.footer-dock';

    function isOverTextElement(target) {
      if (!target || target === document.body || target === document.documentElement || target === canvas) return false;
      var node = target.nodeType === 3 ? target.parentElement : target;
      if (!node || typeof node.closest !== 'function') return false;
      if (node.id === 'spotlight-canvas') return false;
      return Boolean(node.closest(TEXT_SEL));
    }

    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = 1, width = 0, height = 0, cellPx = 8, gridCols = 0, gridRows = 0;

    var mouse = { x: -2000, y: -2000, active: false, lastMove: 0 };
    var smoothMouse = { x: -2000, y: -2000, strength: 0 };
    var isOverText = false, smoothText = 0;
    var meshCount = 3;
    var meshOrbs = [
      { x: 0, y: 0, label: 'WISP-I' },
      { x: 0, y: 0, label: 'WISP-II' },
      { x: 0, y: 0, label: 'WISP-III' }
    ];
    var ripples = [];
    var bolts = [];
    var knockUntil = 0;
    var stormFlashUntil = 0;
    var clownWinIdx = 8; // Starts watching from the Belfry Spire
    var lastClownJump = 0;
    var rafId = 0, isVisible = true;

    function isGroundFloorWindow(winId) {
      return winId === 4 || winId === 5 || winId === 6 || winId === 7 || winId === 9;
    }

    function moveClownToNewRoom() {
      var now = performance.now();
      if (now - lastClownJump < 420) return;
      lastClownJump = now;
      var next = clownWinIdx;
      while (next === clownWinIdx || (musicPlaying && isGroundFloorWindow(next))) {
        next = Math.floor(Math.random() * WINDOWS.length);
      }
      clownWinIdx = next;
      playChimeSound();
      wakeRender();
    }

    window.clownhouseEvictClownFromMusicRoom = function () {
      if (isGroundFloorWindow(clownWinIdx)) {
        lastClownJump = 0;
        moveClownToNewRoom();
      }
    };

    function spawnLightningBolt(targetX, targetY) {
      var now = performance.now();
      var startX = targetX !== undefined ? targetX : (width * (0.2 + Math.random() * 0.6));
      var endY = targetY !== undefined ? targetY : (height * 0.72);
      var pts = [];
      var curX = startX, curY = 0;
      var steps = 16;
      var dy = Math.max(cellPx * 3, endY / steps);
      for (var i = 0; i <= steps; i++) {
        pts.push({ x: curX, y: curY });
        curX += (Math.random() - 0.5) * cellPx * 6;
        curY += dy;
      }
      // Secondary branch
      var branch = [];
      if (pts.length > 6) {
        var bStart = pts[5];
        var bx = bStart.x, by = bStart.y;
        var bDir = Math.random() < 0.5 ? -1 : 1;
        for (var j = 0; j < 6; j++) {
          branch.push({ x: bx, y: by });
          bx += bDir * (1 + Math.random() * 2.5) * cellPx;
          by += dy * 0.85;
        }
      }
      bolts.push({ pts: pts, branch: branch, born: now, dur: 620 });
      if (bolts.length > 4) bolts.shift();
      ripples.push({ x: startX, y: Math.min(height * 0.65, endY), born: now, maxR: 440 * dpr, dur: 1050 });
      if (ripples.length > 6) ripples.shift();
      stormFlashUntil = now + 360;
      wakeRender();
    }

    window.clownhouseTriggerStorm = function () {
      playThunderSound();
      spawnLightningBolt(width * (0.28 + Math.random() * 0.44), height * 0.58);
    };

    window.clownhouseTriggerKnock = function () {
      var now = performance.now();
      knockUntil = now + 720;
      playKnockSound();
      // Spawn ripple at front door (manor x=49, y=45)
      var doorX = (49.5 / MANOR_W) * width;
      var doorY = (45.0 / MANOR_H) * height;
      ripples.push({ x: doorX, y: doorY, born: now, maxR: 320 * dpr, dur: 900 });
      if (ripples.length > 6) ripples.shift();
      if (Math.random() < 0.65) {
        moveClownToNewRoom();
      }
      wakeRender();
    };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.round(window.innerWidth * dpr);
      height = Math.round(window.innerHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      var targetW = Math.min(width * 0.90, 880 * dpr);
      var baseCols = CLOWNHOUSE_WORDMARK[0].length;
      cellPx = Math.max(4, Math.floor(targetW / baseCols));
      gridCols = Math.ceil(width / cellPx) + 1;
      gridRows = Math.ceil(height / cellPx) + 1;

      if (reducedMotion) render(performance.now());
    }

    function wakeRender() {
      if (reducedMotion) {
        render(performance.now());
        return;
      }
      if (!rafId && isVisible) {
        rafId = requestAnimationFrame(render);
      }
    }

    function hitTestWindow(px, py) {
      var mx = Math.floor((px / width) * MANOR_W);
      var my = Math.floor((py / height) * MANOR_H);
      if (mx < 0 || mx >= MANOR_W || my < 0 || my >= MANOR_H) return -1;
      var tile = manorGrid[my * MANOR_W + mx];
      if (tile >= 10 && tile < 20) return tile - 10;
      return -1;
    }

    function onPointerMove(e) {
      if (!e || e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        deactivate();
        return;
      }
      var px = e.clientX * dpr, py = e.clientY * dpr;
      if (!mouse.active || smoothMouse.strength < 0.01 || smoothMouse.x < -1000) {
        smoothMouse.x = px;
        smoothMouse.y = py;
      }
      mouse.x = px;
      mouse.y = py;
      mouse.active = true;
      mouse.lastMove = performance.now();
      isOverText = isOverTextElement(e.target);

      // If pointer sweeps directly over the clown's current window on the background, dart away!
      if (!isOverText) {
        var hoveredWin = hitTestWindow(px, py);
        if (hoveredWin === clownWinIdx) {
          moveClownToNewRoom();
        }
      }

      if (reducedMotion) render(performance.now()); else wakeRender();
    }

    function onPointerDown(e) {
      if (!e) return;
      var px = e.clientX * dpr, py = e.clientY * dpr;
      mouse.x = px;
      mouse.y = py;
      mouse.active = true;
      mouse.lastMove = performance.now();
      isOverText = isOverTextElement(e.target);

      if (!isOverText) {
        var clickedWin = hitTestWindow(px, py);
        if (clickedWin >= 0) {
          if (clickedWin === clownWinIdx || (musicPlaying && isGroundFloorWindow(clickedWin))) {
            moveClownToNewRoom();
          } else {
            clownWinIdx = clickedWin;
            lastClownJump = performance.now();
            playChimeSound();
          }
          ripples.push({ x: px, y: py, born: performance.now(), maxR: 260 * dpr, dur: 820 });
        } else {
          playThunderSound();
          spawnLightningBolt(px, py);
        }
      } else {
        ripples.push({ x: px, y: py, born: performance.now(), maxR: 320 * dpr, dur: 850 });
        if (ripples.length > 6) ripples.shift();
      }
      if (reducedMotion) render(performance.now()); else wakeRender();
    }

    function deactivate() {
      mouse.active = false;
      isOverText = false;
      if (reducedMotion) render(performance.now());
    }

    function render(t) {
      rafId = 0;
      var sec = t * 0.001;

      var targetMouse = mouse.active ? 1 : 0;
      var targetText = (isOverText && mouse.active) ? 1 : 0;
      smoothMouse.x += (mouse.x - smoothMouse.x) * 0.22;
      smoothMouse.y += (mouse.y - smoothMouse.y) * 0.22;
      smoothMouse.strength += (targetMouse - smoothMouse.strength) * 0.12;
      if (smoothMouse.strength < 0.005) smoothMouse.strength = 0;
      smoothText += (targetText - smoothText) * 0.18;

      // Update 3 autonomous Will-o'-the-Wisp orbs patrolling INSIDE the Haunted Manor rooms & corridors
      // Wisp 0: Second floor & Belfry Spire corridor (WEST PARLOR <-> GALLERY <-> MIRROR ROOM <-> EAST NURSERY, dipping toward BELFRY)
      var w0t = sec * 0.42;
      var w0mx = 48 + 24 * Math.sin(w0t) - 8 * Math.pow(Math.max(0, -Math.sin(w0t)), 2);
      var w0my = 31.8 + 2.2 * Math.cos(w0t * 2.1) - 4.5 * Math.pow(Math.max(0, -Math.sin(w0t)), 3);
      meshOrbs[0].mx = w0mx;
      meshOrbs[0].my = w0my;

      // Wisp 1: First floor grand hall & East Annex (FOYER WEST x=29 <-> DRAWING ROOM x=39 <-> MUSIC ROOM x=59 <-> VESTIBULE x=69 <-> EAST ANNEX x=84)
      var w1t = sec * 0.36 + 2.1;
      var w1mx = 56.5 + 29.5 * Math.sin(w1t);
      var w1my = 42.2 + 1.8 * Math.sin(w1t * 2.7);
      meshOrbs[1].mx = w1mx;
      meshOrbs[1].my = w1my;

      // Wisp 2: Gothic Belfry Spire & Upper Gallery figure-8 patrol (BELFRY SPIRE <-> WEST PARLOR <-> FOYER WEST <-> MIRROR ROOM)
      var w2t = sec * 0.48 + 4.2;
      var w2Phase = 0.5 + 0.5 * Math.sin(w2t * 0.65);
      var w2mx = 15.5 * (1 - w2Phase) + (46 + 18 * Math.cos(w2t)) * w2Phase;
      var w2my = (24.5 + 4.0 * Math.sin(w2t * 1.3)) * (1 - w2Phase) + (36.5 + 5.8 * Math.sin(w2t * 1.3)) * w2Phase;
      meshOrbs[2].mx = w2mx;
      meshOrbs[2].my = w2my;

      for (var m = 0; m < meshCount; m++) {
        meshOrbs[m].x = (meshOrbs[m].mx / MANOR_W) * width;
        meshOrbs[m].y = (meshOrbs[m].my / MANOR_H) * height;
      }

      ripples = ripples.filter(function (rp) { return (t - rp.born) < rp.dur; });
      bolts = bolts.filter(function (b) { return (t - b.born) < b.dur; });

      var stormIntensity = t < stormFlashUntil ? ((stormFlashUntil - t) / 360) : 0;
      var knockIntensity = t < knockUntil ? ((knockUntil - t) / 720) : 0;
      var shakeCols = knockIntensity > 0 ? Math.round(Math.sin(t * 0.09) * 1.4) : 0;

      ctx.fillStyle = '#06050b';
      ctx.fillRect(0, 0, width, height);

      var acc = window.clownhouseCurrentAccent || [189, 147, 249];
      if (!smoothAcc || reducedMotion) smoothAcc = [acc[0], acc[1], acc[2]];
      smoothAcc[0] += (acc[0] - smoothAcc[0]) * 0.09;
      smoothAcc[1] += (acc[1] - smoothAcc[1]) * 0.09;
      smoothAcc[2] += (acc[2] - smoothAcc[2]) * 0.09;

      var ar = Math.round(smoothAcc[0]), ag = Math.round(smoothAcc[1]), ab = Math.round(smoothAcc[2]);
      var hr = Math.min(255, Math.round(ar + (255 - ar) * 0.45));
      var hg = Math.min(255, Math.round(ag + (255 - ag) * 0.45));
      var hb = Math.min(255, Math.round(ab + (255 - ab) * 0.45));

      var textDim = smoothText;
      var glareCut = 1 - 0.50 * textDim;
      var hotRgb = hr + ',' + hg + ',' + hb;
      var midRgb = ar + ',' + ag + ',' + ab;
      var colorSpotHigh = 'rgba(' + hotRgb + ',' + glareCut.toFixed(2) + ')';
      var colorSpotMid = 'rgba(' + midRgb + ',' + (0.88 * glareCut).toFixed(2) + ')';
      var colorFieldHigh = 'rgba(' + midRgb + ',' + (0.28 * (1 - 0.25 * textDim)).toFixed(3) + ')';
      var colorFieldLow = 'rgba(' + midRgb + ',' + (0.11 * (1 - 0.25 * textDim)).toFixed(3) + ')';

      // Quantized 4-tier Manor Palette (dark -> dim -> mid -> hot)
      var manorWallDark = '#0d0918';
      var manorWallMid = 'rgb(' + Math.round(24 + ar * 0.14) + ',' + Math.round(16 + ag * 0.12) + ',' + Math.round(38 + ab * 0.16) + ')';
      var manorWallLit = 'rgb(' + Math.round(38 + ar * 0.28) + ',' + Math.round(26 + ag * 0.24) + ',' + Math.round(58 + ab * 0.30) + ')';
      var manorEdgeCol = 'rgb(' + Math.round(52 + ar * 0.42) + ',' + Math.round(36 + ag * 0.38) + ',' + Math.round(76 + ab * 0.44) + ')';
      var manorRoofDark = '#080510';
      var manorRoofMid = 'rgb(' + Math.round(16 + ar * 0.10) + ',' + Math.round(10 + ag * 0.08) + ',' + Math.round(26 + ab * 0.12) + ')';
      var manorDoorCol = knockIntensity > 0 ? colorSpotHigh : 'rgb(' + Math.round(34 + ar * 0.22) + ',12,28)';

      var mouseReach = 225 * (1 - 0.52 * textDim) * dpr;
      var mouseReachSq = mouseReach * mouseReach;
      var orbReach = 115 * (1 - 0.45 * textDim) * dpr;
      var orbReachSq = orbReach * orbReach;
      var ringW = 28 * dpr;

      var activeRipples = ripples.map(function (rp) {
        var progress = (t - rp.born) / rp.dur;
        var curR = rp.maxR * (1 - Math.pow(1 - progress, 3));
        var minR = Math.max(0, curR - ringW), maxR = curR + ringW;
        return { x: rp.x, y: rp.y, r: curR, minRSq: minR * minR, maxRSq: maxR * maxR, amp: Math.pow(1 - progress, 1.8) };
      });

      var ditherThreshold = 0.72 + 0.08 * textDim;

      // Active Clown Window Center in Canvas Pixels (for heterochromia eye tracking)
      var activeWin = WINDOWS[clownWinIdx] || WINDOWS[8];
      var clownCenterX = (activeWin.cx / MANOR_W) * width;
      var clownCenterY = (((activeWin.y0 + activeWin.y1) * 0.5) / MANOR_H) * height;
      var lookTargetX = mouse.active ? smoothMouse.x : meshOrbs[0].x;
      var lookTargetY = mouse.active ? smoothMouse.y : meshOrbs[0].y;
      var gazeDx = lookTargetX - clownCenterX > 24 * dpr ? 1 : (lookTargetX - clownCenterX < -24 * dpr ? -1 : 0);
      var gazeDy = lookTargetY - clownCenterY > 24 * dpr ? 1 : (lookTargetY - clownCenterY < -24 * dpr ? -1 : 0);

      for (var r = 0; r < gridRows; r++) {
        var py = r * cellPx;
        var my = Math.floor(((r + 0.5) / gridRows) * MANOR_H);
        if (my >= MANOR_H) my = MANOR_H - 1;
        var prevMy = r > 0 ? Math.floor(((r - 0.5) / gridRows) * MANOR_H) : -1;

        for (var c = 0; c < gridCols; c++) {
          var px = c * cellPx;
          var cx = px + cellPx * 0.5, cy = py + cellPx * 0.5;

          // Compute Exterior Spotlight (Pointer Torch + Storm Flash) and Interior Wisp Glow
          var spot = stormIntensity * 0.65;
          if (smoothMouse.strength > 0.01) {
            var dxm = cx - smoothMouse.x, dym = cy - smoothMouse.y;
            var dsqM = dxm * dxm + dym * dym;
            if (dsqM < mouseReachSq) {
              spot = Math.max(spot, Math.pow(1 - Math.sqrt(dsqM) / mouseReach, 2) * smoothMouse.strength * (1 - 0.55 * textDim));
            }
          }
          var wispInside = 0;
          for (var m = 0; m < meshCount; m++) {
            var dxo = cx - meshOrbs[m].x, dyo = cy - meshOrbs[m].y;
            var dsqO = dxo * dxo + dyo * dyo;
            if (dsqO < orbReachSq) {
              var wFalloff = Math.pow(1 - Math.sqrt(dsqO) / orbReach, 2);
              if (wFalloff > wispInside) wispInside = wFalloff;
            }
          }
          if (spot > 1.35) spot = 1.35;

          var ripGlow = 0;
          for (var i = 0; i < activeRipples.length; i++) {
            var rp = activeRipples[i], rx = cx - rp.x, ry = cy - rp.y, dsqR = rx * rx + ry * ry;
            if (dsqR >= rp.minRSq && dsqR <= rp.maxRSq) {
              ripGlow = Math.max(ripGlow, (1 - Math.abs(Math.sqrt(dsqR) - rp.r) / ringW) * rp.amp);
            }
          }

          var dither = BAYER[(r & 7) * 8 + (c & 7)] / 64;
          var mx = Math.floor((((c + shakeCols) + 0.5) / gridCols) * MANOR_W);
          if (mx < 0) mx = 0; else if (mx >= MANOR_W) mx = MANOR_W - 1;
          var tile = manorGrid[my * MANOR_W + mx];

          // Ground Fog Dither (rows y >= 45)
          var fogEnergy = 0;
          if (my >= 44) {
            var fn = sampleNoise(c * 0.08 + sec * 0.35, r * 0.12 - sec * 0.06);
            fogEnergy = fn * ((my - 43) / 10) * 0.68;
          }

          if (tile === 0) {
            // Sky & Bayer Plasma (wisps are inside the house, so they do not illuminate the open sky)
            var nx = c * 0.07 + sec * 0.16, ny = r * 0.07 - sec * 0.11;
            var nVal = 0.6 * sampleNoise(nx, ny) + 0.4 * sampleNoise(nx * 0.5 - sec * 0.08, ny * 0.5 + sec * 0.07);
            var energy = nVal * 0.75 + (0.5 + 0.5 * Math.sin(sec * 1.8 + (r * 37 + c * 11) % 6.283)) * 0.25 + fogEnergy;
            var fieldVal = energy * 0.44 + spot * 0.85 + ripGlow * 0.95;
            if (fieldVal > dither * ditherThreshold) {
              ctx.fillStyle = (spot > 0.38 || ripGlow > 0.4)
                ? colorSpotHigh
                : (spot > 0.14 || ripGlow > 0.15)
                  ? colorSpotMid
                  : fieldVal > 0.56
                    ? colorFieldHigh
                    : colorFieldLow;
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            }
          } else if (tile >= 10 && tile < 20) {
            // Manor Window Pane — illuminates brightly from within as interior wisps fly past!
            var winId = tile - 10;
            var winPulse = 0.5 + 0.5 * Math.sin(sec * 2.1 + winId * 1.7);

            // When Music Box is playing, render animated pixel Equalizer Bar Chart across all ground-floor windows (winId === 4, 5, 6, 7, 9)
            // using a unified house-level floor baseline (eqBottomY = 46) and fixed house-height scale (eqMaxRows = 8)
            // so the music reaches the exact same physical house height regardless of any individual window's dimensions.
            if (musicPlaying && isGroundFloorWindow(winId) && winId !== clownWinIdx) {
              var eqBottomY = 46;
              var eqMaxRows = 8; // spans house rows my = 39..46 uniformly across the entire ground floor
              var houseRowFromFloor = eqBottomY - my;
              var prevHouseRowFromFloor = eqBottomY - prevMy;
              var wave = Math.abs(Math.sin(sec * 6.8 + musicStep * 0.85 + mx * 0.65)) * 0.68 +
                         Math.abs(Math.cos(sec * 11.2 - mx * 0.95 + musicStep * 0.5)) * 0.32;
              var barHeight = Math.max(1, Math.min(eqMaxRows, Math.round((0.18 + 0.82 * wave) * eqMaxRows)));
              if (houseRowFromFloor >= 0 && houseRowFromFloor < barHeight) {
                var isPeak = (houseRowFromFloor === barHeight - 1) || (prevHouseRowFromFloor >= barHeight);
                ctx.fillStyle = isPeak
                  ? '#ffffff'
                  : (houseRowFromFloor >= Math.floor(eqMaxRows * 0.6)
                    ? ('rgb(' + hotRgb + ')')
                    : '#50fa7b');
              } else {
                // Warm backlit ground-floor interior behind the equalizer bars
                ctx.fillStyle = 'rgba(' + midRgb + ',' + (0.20 + wispInside * 0.35).toFixed(2) + ')';
              }
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            } else if (winId === clownWinIdx) {
              // Dark velvet interior behind the watching clown, catching interior wisp glow
              ctx.fillStyle = (spot > 0.25 || wispInside > 0.35)
                ? 'rgba(' + midRgb + ',' + (0.22 + wispInside * 0.42).toFixed(2) + ')'
                : '#120b22';
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            } else {
              var wLit = spot * 0.85 + wispInside * 1.45 + ripGlow * 0.8 + (winPulse > 0.82 ? 0.22 : 0.06);
              ctx.fillStyle = wLit > 0.82
                ? colorSpotHigh
                : (wLit > 0.40
                  ? colorSpotMid
                  : (wLit > 0.16 ? colorFieldHigh : '#090612'));
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            }
          } else {
            // Solid Haunted Manor Architecture (Brickwork, Shingles, Window Borders, Fence, Trees, Door)
            // Exterior walls and outer window borders (tile === 5) completely occlude interior wisps!
            var mLit = 0.20 + spot * 0.95 + ripGlow * 0.90 + fogEnergy * 0.45;
            if (tile === 2 || tile === 4 || tile === 5) {
              // Rim-lit edges, gargoyles, and exterior window borders
              ctx.fillStyle = (mLit > 0.65)
                ? colorSpotHigh
                : (mLit > 0.32 ? colorSpotMid : manorEdgeCol);
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            } else if (tile === 6) {
              // Manor Front Door
              ctx.fillStyle = (mLit > 0.55 || knockIntensity > 0.2) ? manorDoorCol : '#1c0b1a';
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            } else if (tile === 8 || tile === 9) {
              // Crooked Iron Fence & Dead Trees
              ctx.fillStyle = mLit > 0.48 ? colorSpotMid : (mLit > 0.24 ? manorWallLit : '#120d20');
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            } else if (tile === 3) {
              // Gabled Slate Shingles
              var shinglePattern = ((r + c) & 1) === 0;
              if (mLit > 0.45 && shinglePattern) {
                ctx.fillStyle = colorFieldHigh;
              } else if (mLit > 0.24 + dither * 0.25) {
                ctx.fillStyle = manorRoofMid;
              } else {
                ctx.fillStyle = manorRoofDark;
              }
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            } else {
              // Manor Brick Wall (tile === 1) or Ground (tile === 7)
              var brickPattern = ((r & 1) === 0 && (c % 3) === 0);
              if (fogEnergy > dither * 0.65 && my >= 47) {
                ctx.fillStyle = colorFieldHigh;
              } else if (mLit > 0.55) {
                ctx.fillStyle = brickPattern ? colorSpotMid : manorWallLit;
              } else if (mLit > 0.26 + dither * 0.22) {
                ctx.fillStyle = brickPattern ? manorEdgeCol : manorWallMid;
              } else {
                ctx.fillStyle = manorWallDark;
              }
              ctx.fillRect(px, py, cellPx - 1, cellPx - 1);
            }
          }
        }
      }

      // --- Render Watching Pixel Clown with Heterochromia Eyes in Active Window ---
      var cw = WINDOWS[clownWinIdx] || WINDOWS[8];
      var wColCenter = Math.round(((cw.cx + 0.5) / MANOR_W) * gridCols) + shakeCols;
      var wRowCenter = Math.round((((cw.y0 + cw.y1) * 0.5) / MANOR_H) * gridRows);

      // Subtle pale jester face silhouette & ruffled collar inside the window
      ctx.fillStyle = 'rgba(235, 228, 250, 0.16)';
      for (var dyF = -1; dyF <= 2; dyF++) {
        for (var dxF = -1; dxF <= 1; dxF++) {
          ctx.fillRect((wColCenter + dxF) * cellPx, (wRowCenter + dyF) * cellPx, cellPx - 1, cellPx - 1);
        }
      }
      // Ruffled collar pixels below eyes
      ctx.fillStyle = 'rgba(' + hotRgb + ', 0.42)';
      ctx.fillRect((wColCenter - 2) * cellPx, (wRowCenter + 2) * cellPx, cellPx - 1, cellPx - 1);
      ctx.fillRect((wColCenter) * cellPx, (wRowCenter + 2) * cellPx, cellPx - 1, cellPx - 1);
      ctx.fillRect((wColCenter + 2) * cellPx, (wRowCenter + 2) * cellPx, cellPx - 1, cellPx - 1);

      // Left Eye: Crimson (#ff2d55) + pointer-tracked pupil offset
      var eyeLX = (wColCenter - 1) * cellPx;
      var eyeRX = (wColCenter + 1) * cellPx;
      var eyeY = wRowCenter * cellPx;

      ctx.fillStyle = '#ff2d55';
      ctx.fillRect(eyeLX, eyeY, cellPx - 1, cellPx - 1);
      // Right Eye: Violet (#bd93f9)
      ctx.fillStyle = '#bd93f9';
      ctx.fillRect(eyeRX, eyeY, cellPx - 1, cellPx - 1);

      // Glowing tracking pupil sub-pixels
      var pupSize = Math.max(2, Math.floor(cellPx * 0.45));
      var pupOffX = Math.floor((cellPx - 1 - pupSize) * 0.5) + gazeDx * Math.max(1, Math.floor(cellPx * 0.22));
      var pupOffY = Math.floor((cellPx - 1 - pupSize) * 0.5) + gazeDy * Math.max(1, Math.floor(cellPx * 0.22));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(eyeLX + pupOffX, eyeY + pupOffY, pupSize, pupSize);
      ctx.fillRect(eyeRX + pupOffX, eyeY + pupOffY, pupSize, pupSize);

      // --- Render Stepped Pixel Lightning Bolts ---
      for (var bIdx = 0; bIdx < bolts.length; bIdx++) {
        var b = bolts[bIdx];
        var bAge = (t - b.born) / b.dur;
        if (bAge >= 1) continue;
        var boltCoreColor = bAge < 0.35 ? '#ffffff' : colorSpotHigh;
        ctx.fillStyle = boltCoreColor;
        var drawSteppedSegment = function (p1, p2, thick) {
          var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          var st = Math.max(2, Math.ceil(dist / (cellPx * 0.75)));
          for (var s = 0; s <= st; s++) {
            var f = s / st;
            var bx = Math.round((p1.x + (p2.x - p1.x) * f) / cellPx) * cellPx;
            var by = Math.round((p1.y + (p2.y - p1.y) * f) / cellPx) * cellPx;
            ctx.fillRect(bx, by, cellPx - 1, cellPx - 1);
            if (thick && bAge < 0.25) {
              ctx.fillStyle = colorSpotMid;
              ctx.fillRect(bx + cellPx, by, cellPx - 1, cellPx - 1);
              ctx.fillStyle = boltCoreColor;
            }
          }
        };
        for (var p = 0; p < b.pts.length - 1; p++) {
          drawSteppedSegment(b.pts[p], b.pts[p + 1], true);
        }
        for (var bp = 0; bp < b.branch.length - 1; bp++) {
          drawSteppedSegment(b.branch[bp], b.branch[bp + 1], false);
        }
      }

      // --- Render Interior Will-o'-the-Wisp Orbs (Strictly Visible ONLY Inside Internal Window Panes: tile >= 10 && tile < 20) ---
      for (var w = 0; w < meshCount; w++) {
        var wCol = Math.round(meshOrbs[w].x / cellPx);
        var wRow = Math.round(meshOrbs[w].y / cellPx);
        var wx = wCol * cellPx;
        var wy = wRow * cellPx;

        // Draw individual wisp cross pixels ONLY when inside the internal window glass pane square (tile >= 10 && tile < 20)
        var wOffsets = [
          { dc: 0, dr: 0, core: true },
          { dc: -1, dr: 0, core: false },
          { dc: 1, dr: 0, core: false },
          { dc: 0, dr: -1, core: false },
          { dc: 0, dr: 1, core: false }
        ];
        for (var wo = 0; wo < wOffsets.length; wo++) {
          var pc = wCol + wOffsets[wo].dc;
          var pr = wRow + wOffsets[wo].dr;
          var pmx = Math.floor((((pc + shakeCols) + 0.5) / gridCols) * MANOR_W);
          var pmy = Math.floor(((pr + 0.5) / gridRows) * MANOR_H);
          if (pmx < 0 || pmx >= MANOR_W || pmy < 0 || pmy >= MANOR_H) continue;
          var ptile = manorGrid[pmy * MANOR_W + pmx];
          if (ptile < 10 || ptile >= 20) continue;

          ctx.fillStyle = wOffsets[wo].core
            ? 'rgba(255,255,255,0.96)'
            : ('rgba(' + hotRgb + ',0.85)');
          ctx.fillRect(pc * cellPx, pr * cellPx, cellPx - 1, cellPx - 1);
        }

        var cMx = Math.floor((((wCol + shakeCols) + 0.5) / gridCols) * MANOR_W);
        var cMy = Math.floor(((wRow + 0.5) / gridRows) * MANOR_H);
        var wCenterTile = (cMx >= 0 && cMx < MANOR_W && cMy >= 0 && cMy < MANOR_H)
          ? manorGrid[cMy * MANOR_W + cMx]
          : 0;
        var wCenterInPane = (wCenterTile >= 10 && wCenterTile < 20);

        // Crisp glowing reticle clipped strictly to the internal window pane square (never on tile === 5 border)
        if (wCenterInPane) {
          var minPc = wCol, maxPc = wCol, minPr = wRow, maxPr = wRow;
          while (minPc > 0) {
            var testMxL = Math.floor((((minPc - 1 + shakeCols) + 0.5) / gridCols) * MANOR_W);
            if (testMxL >= 0 && testMxL < MANOR_W && manorGrid[cMy * MANOR_W + testMxL] === wCenterTile) minPc--;
            else break;
          }
          while (maxPc < gridCols - 1) {
            var testMxR = Math.floor((((maxPc + 1 + shakeCols) + 0.5) / gridCols) * MANOR_W);
            if (testMxR >= 0 && testMxR < MANOR_W && manorGrid[cMy * MANOR_W + testMxR] === wCenterTile) maxPc++;
            else break;
          }
          while (minPr > 0) {
            var testMyT = Math.floor(((minPr - 1 + 0.5) / gridRows) * MANOR_H);
            if (testMyT >= 0 && testMyT < MANOR_H && manorGrid[testMyT * MANOR_W + cMx] === wCenterTile) minPr--;
            else break;
          }
          while (maxPr < gridRows - 1) {
            var testMyB = Math.floor(((maxPr + 1 + 0.5) / gridRows) * MANOR_H);
            if (testMyB >= 0 && testMyB < MANOR_H && manorGrid[testMyB * MANOR_W + cMx] === wCenterTile) maxPr++;
            else break;
          }
          var paneX0 = minPc * cellPx;
          var paneY0 = minPr * cellPx;
          var paneW = (maxPc - minPc + 1) * cellPx - 1;
          var paneH = (maxPr - minPr + 1) * cellPx - 1;
          ctx.save();
          ctx.beginPath();
          ctx.rect(paneX0, paneY0, paneW, paneH);
          ctx.clip();
          ctx.strokeStyle = 'rgba(' + hotRgb + ',' + (0.85 * glareCut).toFixed(2) + ')';
          ctx.lineWidth = Math.max(1.5, dpr * 1.4);
          var wPad = cellPx * 1.5;
          ctx.strokeRect(wx - wPad, wy - wPad, cellPx + wPad * 2 - 1, cellPx + wPad * 2 - 1);
          ctx.restore();
        }
      }

      var hasActiveEffects = ripples.length > 0 || bolts.length > 0 || t < stormFlashUntil || t < knockUntil || musicPlaying;
      if (isVisible && (!reducedMotion || hasActiveEffects)) {
        rafId = requestAnimationFrame(render);
      }
    }

    window.clownhouseRenderSpotlight = function () {
      wakeRender();
    };

    resize();
    render(performance.now());
    window.addEventListener('resize', function () { resize(); wakeRender(); }, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', function (e) { if (e && e.pointerType === 'touch') deactivate(); }, { passive: true });
    ['pointercancel', 'blur', 'pointerleave', 'mouseleave'].forEach(function (ev) {
      window.addEventListener(ev, deactivate, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
      isVisible = !document.hidden;
      if (isVisible) wakeRender();
      else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    });
  }

  // --- Interactive [1]-[3] Footer Triggers ---
  function initConsoleTriggers() {
    var btnKnock = document.getElementById('act-knock');
    var btnMusic = document.getElementById('act-music');
    var btnStorm = document.getElementById('act-storm');

    if (btnKnock) btnKnock.addEventListener('click', function () {
      if (window.clownhouseTriggerKnock) window.clownhouseTriggerKnock();
    });
    if (btnMusic) btnMusic.addEventListener('click', function () {
      toggleMusicBox();
    });
    if (btnStorm) btnStorm.addEventListener('click', function () {
      if (window.clownhouseTriggerStorm) window.clownhouseTriggerStorm();
    });

    // Keyboard shortcuts 1-3
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
      var act = document.activeElement;
      var tag = act && act.tagName ? act.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '1') {
        e.preventDefault();
        if (window.clownhouseTriggerKnock) window.clownhouseTriggerKnock();
      } else if (e.key === '2') {
        e.preventDefault();
        toggleMusicBox();
      } else if (e.key === '3') {
        e.preventDefault();
        if (window.clownhouseTriggerStorm) window.clownhouseTriggerStorm();
      }
    });
  }

  function start() {
    initPalette();
    renderHeaderWordmark();
    initCanvas();
    initConsoleTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
