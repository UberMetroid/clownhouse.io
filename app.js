/**
 * CLOWNHOUSE.IO // 1982 MICROSYSTEMS CONTROLLER
 * Handles CRT state, retro sound synthesis (Web Audio SID 6581),
 * theme switches, and the interactive BASIC command interpreter.
 */

(function () {
  'use strict';

  // DOM Elements
  const body = document.body;
  const themeSelect = document.getElementById('theme-select');
  const scanlineToggle = document.getElementById('scanline-toggle');
  const crtOverlay = document.getElementById('crt-overlay');
  const soundToggle = document.getElementById('sound-toggle');
  const terminalForm = document.getElementById('terminal-form');
  const terminalInput = document.getElementById('terminal-input');
  const terminalHistory = document.getElementById('terminal-history');

  // State
  let soundEnabled = false;
  let audioCtx = null;
  const cmdHistory = [];
  let historyIdx = -1;

  // Primary destinations map
  const DESTINATIONS = {
    '10': { name: 'OPEN-OODA.ORG', url: 'https://openooda.org', blocks: 1024 },
    '20': { name: 'NECROMETER.DEV', url: 'https://necrometer.dev', blocks: 512 },
    '30': { name: 'BUMTRIPS.COM', url: 'https://bumtrips.com', blocks: 808 },
    '40': { name: 'REACTLE.CLOWNHOUSE.IO', url: 'https://reactle.clownhouse.io', blocks: 200 },
    '50': { name: 'GIGGLE.CLOWNHOUSE.IO', url: 'https://giggle.clownhouse.io', blocks: 808 },
    '60': { name: 'JERYD@CLOWNHOUSE.IO', url: 'mailto:jeryd@clownhouse.io', blocks: 1 }
  };

  // --- 1. Sound Synthesis (Web Audio 8-Bit Synthesizer) ---
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'square', duration = 0.06, volume = 0.1) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context error guard
    }
  }

  function playChirp() {
    playTone(987.77, 'square', 0.05, 0.08); // B5
    setTimeout(() => playTone(1318.51, 'square', 0.07, 0.08), 50); // E6
  }

  function playLaunchChime() {
    if (!soundEnabled || !audioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C arpeggio
    notes.forEach((f, idx) => {
      setTimeout(() => playTone(f, 'square', 0.09, 0.12), idx * 70);
    });
  }

  function playBootChime() {
    if (!soundEnabled || !audioCtx) return;
    const bootNotes = [261.63, 329.63, 392.00, 523.25];
    bootNotes.forEach((f, idx) => {
      setTimeout(() => playTone(f, 'triangle', 0.12, 0.1), idx * 80);
    });
  }

  // --- 2. Theme & Display Controls ---
  function setTheme(theme) {
    body.setAttribute('data-theme', theme);
    themeSelect.value = theme;
    localStorage.setItem('clownhouse_theme', theme);
  }

  function setScanlines(enabled) {
    if (enabled) {
      crtOverlay.classList.remove('disabled');
      scanlineToggle.setAttribute('aria-pressed', 'true');
      scanlineToggle.querySelector('.btn-state').textContent = 'ON';
      localStorage.setItem('clownhouse_scanlines', 'on');
    } else {
      crtOverlay.classList.add('disabled');
      scanlineToggle.setAttribute('aria-pressed', 'false');
      scanlineToggle.querySelector('.btn-state').textContent = 'OFF';
      localStorage.setItem('clownhouse_scanlines', 'off');
    }
  }

  function toggleSound() {
    initAudio();
    soundEnabled = !soundEnabled;
    soundToggle.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    soundToggle.querySelector('.btn-state').textContent = soundEnabled ? 'ACTIVE' : 'MUTED';
    localStorage.setItem('clownhouse_sound', soundEnabled ? 'on' : 'off');
    if (soundEnabled) {
      playChirp();
    }
  }

  // Initialize stored preferences
  const savedTheme = localStorage.getItem('clownhouse_theme') || 'c64';
  setTheme(savedTheme);

  const savedScanlines = localStorage.getItem('clownhouse_scanlines');
  if (savedScanlines === 'off') {
    setScanlines(false);
  } else {
    setScanlines(true);
  }

  const savedSound = localStorage.getItem('clownhouse_sound');
  if (savedSound === 'on') {
    // Sound requires user gesture to resume audio context
    soundToggle.querySelector('.btn-state').textContent = 'CLICK TO UNMUTE';
  }

  // Event Listeners for Bezel Controls
  themeSelect.addEventListener('change', (e) => {
    initAudio();
    setTheme(e.target.value);
    playChirp();
  });

  scanlineToggle.addEventListener('click', () => {
    initAudio();
    const isCurrentlyOn = !crtOverlay.classList.contains('disabled');
    setScanlines(!isCurrentlyOn);
    playTone(700, 'square', 0.04, 0.08);
  });

  soundToggle.addEventListener('click', () => {
    toggleSound();
  });

  // --- 3. Interactive BASIC Terminal Interpreter ---
  function printLine(text, className = '') {
    const line = document.createElement('div');
    line.className = 'history-line ' + className;
    line.innerHTML = text;
    terminalHistory.appendChild(line);
    terminalHistory.scrollTop = terminalHistory.scrollHeight;
  }

  function launchDestination(destKey) {
    const dest = DESTINATIONS[destKey];
    if (dest) {
      playLaunchChime();
      printLine(`&gt; LOADING "${dest.name}",8,1...`, 'comment-line');
      printLine(`&gt; LAUNCHING EXTERNAL MAINFRAME: ${dest.url}`, 'highlight-line');
      setTimeout(() => {
        window.open(dest.url, '_blank', 'noopener,noreferrer');
      }, 350);
      return true;
    }
    return false;
  }

  function executeCommand(rawInput) {
    const input = rawInput.trim().toUpperCase();
    if (!input) return;

    printLine(`READY.&gt; ${escapeHtml(rawInput)}`, 'prompt-echo');
    playTone(880, 'square', 0.04, 0.06);

    // Numeric line execution (e.g. "10", "20", "30")
    if (DESTINATIONS[input]) {
      launchDestination(input);
      return;
    }

    const parts = input.split(/\s+/);
    const cmd = parts[0];
    const arg = parts[1] || '';

    switch (cmd) {
      case 'HELP':
      case '?':
        printLine('AVAILABLE COMMANDS:');
        printLine('  10, 20, 30        - RUN SPECIFIED DIRECTORY PROGRAM');
        printLine('  OPEN &lt;10|20|30&gt;   - LAUNCH SPECIFIED LINK');
        printLine('  DIR / CATALOG     - LIST ALL DISK ENTRIES');
        printLine('  THEME &lt;NAME&gt;      - C64, GREEN, AMBER, TRON');
        printLine('  SCANLINES &lt;ON|OFF&gt; - TOGGLE CRT SCANLINES');
        printLine('  SOUND &lt;ON|OFF&gt;    - TOGGLE 8-BIT SID SYNTH');
        printLine('  ABOUT             - HARDWARE ARCHITECTURE &amp; LORE');
        printLine('  CLS / CLEAR       - CLEAR TERMINAL BUFFER');
        printLine('  SYS 64738         - WARM SYSTEM RESET (REBOOT)');
        break;

      case 'OPEN':
      case 'RUN':
      case 'LOAD':
      case 'GOTO':
        if (arg && DESTINATIONS[arg]) {
          launchDestination(arg);
        } else if (arg === 'OPENOODA' || arg === 'OODA') {
          launchDestination('10');
        } else if (arg === 'NECROMETER' || arg === 'NECRO') {
          launchDestination('20');
        } else if (arg === 'BUMTRIPS') {
          launchDestination('30');
        } else {
          printLine('?FILE NOT FOUND ERROR. TYPE "DIR" FOR CATALOG.');
        }
        break;

      case 'OPENOODA':
      case 'OODA':
        launchDestination('10');
        break;

      case 'NECROMETER':
      case 'NECRO':
        launchDestination('20');
        break;

      case 'BUMTRIPS':
        launchDestination('30');
        break;

      case 'REACTLE':
        launchDestination('40');
        break;

      case 'GIGGLE':
        launchDestination('50');
        break;

      case 'MAIL':
      case 'EMAIL':
        launchDestination('60');
        break;

      case 'DIR':
      case 'CATALOG':
      case 'LIST':
        printLine('0 "CLOWNHOUSE 1982" 82 2A');
        Object.keys(DESTINATIONS).forEach((key) => {
          const item = DESTINATIONS[key];
          printLine(`  ${key.padEnd(4, ' ')} "${item.name}" PRG (${item.blocks} BLOCKS)`);
        });
        printLine('38911 BLOCKS FREE.');
        break;

      case 'THEME':
        if (['C64', 'GREEN', 'AMBER', 'TRON'].includes(arg)) {
          setTheme(arg.toLowerCase());
          printLine(`PALETTE SWITCHED TO: ${arg}`);
          playChirp();
        } else {
          printLine('?SYNTAX ERROR. OPTIONS: C64, GREEN, AMBER, TRON');
        }
        break;

      case 'SCANLINES':
        if (arg === 'ON') {
          setScanlines(true);
          printLine('CRT SCANLINES: ENABLED');
        } else if (arg === 'OFF') {
          setScanlines(false);
          printLine('CRT SCANLINES: DISABLED');
        } else {
          printLine('?SYNTAX ERROR. USAGE: SCANLINES ON|OFF');
        }
        break;

      case 'SOUND':
        if (arg === 'ON') {
          if (!soundEnabled) toggleSound();
          printLine('SID 6581 SYNTHESIZER: ACTIVE');
        } else if (arg === 'OFF') {
          if (soundEnabled) toggleSound();
          printLine('SID 6581 SYNTHESIZER: MUTED');
        } else {
          printLine('?SYNTAX ERROR. USAGE: SOUND ON|OFF');
        }
        break;

      case 'CLS':
      case 'CLEAR':
        terminalHistory.innerHTML = '';
        printLine('* TERMINAL CLEARED. READY.', 'comment-line');
        break;

      case 'ABOUT':
        printLine('=== CLOWNHOUSE.IO // 1982 ARCHIVE ===');
        printLine('HARDWARE: MOS 6510 8-BIT CPU @ 1.023 MHZ');
        printLine('GRAPHICS: VIC-II VIDEO INTERFACE CHIP');
        printLine('AUDIO:    MOS 6581 SID SYNTH (3 INDEPENDENT VOICES)');
        printLine('NETWORK:  AUTONOMOUS EDGE MESH + CLOUDFLARE ARGO TUNNELS');
        printLine('FOUNDED:  1982 RETRO-FUTURE PARALLEL UNIVERSE');
        break;

      case 'SYS':
        if (arg === '64738' || arg === '64738;' || arg === '0') {
          printLine('WARM REBOOT INITIATED...');
          playBootChime();
          setTimeout(() => {
            terminalHistory.innerHTML = '';
            printLine('**** CLOWNHOUSE 64 BASIC V2.1 (1982) ****', 'highlight-line');
            printLine('64K RAM SYSTEM  38911 BASIC BYTES FREE');
            printLine('READY.');
          }, 600);
        } else {
          printLine('?ILLEGAL QUANTITY ERROR');
        }
        break;

      case '10':
      case '20':
        // Infinite loop Easter Egg
        if (input.includes('PRINT') || input.includes('GOTO')) {
          printLine('10 PRINT "CLOWNHOUSE 1982 ";');
          printLine('20 GOTO 10');
          let count = 0;
          const loopInterval = setInterval(() => {
            if (count > 8) {
              clearInterval(loopInterval);
              printLine('BREAK IN 10', 'comment-line');
              printLine('READY.');
            } else {
              printLine('CLOWNHOUSE 1982 CLOWNHOUSE 1982 CLOWNHOUSE 1982');
              playTone(440 + count * 50, 'square', 0.03, 0.05);
              count++;
            }
          }, 80);
        } else {
          printLine('?SYNTAX ERROR');
        }
        break;

      default:
        printLine('?SYNTAX ERROR IN 1982. TYPE "HELP" FOR COMMANDS.');
        playTone(220, 'sawtooth', 0.1, 0.08);
        break;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Form submission
  terminalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();
    const val = terminalInput.value;
    if (val.trim()) {
      cmdHistory.push(val);
      historyIdx = cmdHistory.length;
      executeCommand(val);
      terminalInput.value = '';
    }
  });

  // Keyboard navigation for command history
  terminalInput.addEventListener('keydown', (e) => {
    initAudio();
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        terminalInput.value = cmdHistory[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        terminalInput.value = cmdHistory[historyIdx];
      } else {
        historyIdx = cmdHistory.length;
        terminalInput.value = '';
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Keystroke sound
      playTone(1200 + Math.random() * 200, 'square', 0.015, 0.02);
    }
  });

  // Clicking directory links plays retro chime
  document.querySelectorAll('.dir-entry a').forEach((link) => {
    link.addEventListener('click', () => {
      initAudio();
      playLaunchChime();
    });
  });

})();
