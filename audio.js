/**
 * CLOWNHOUSE.IO // PROCEDURAL WEB AUDIO API SYNTHESIS ENGINE
 * Milestone M2: Web Audio Procedural Synthesis Engine
 * 
 * Features:
 * - 100% Procedural synthesis using Web Audio API (zero external audio files).
 * - Multi-operator FM synthesis for 16-bit console chimes and harmonics.
 * - Subtractive filtered noise synthesis (white & pink noise buffer cache).
 * - 5 Bespoke Theme Acoustic Profiles:
 *   1. Tower of Power: Sega Genesis YM2612 FM slap bass, 4-note power-on arpeggio, cartridge lock click.
 *   2. Chozo Scan Visor: Metroid holographic HUD dual-sine harmonic sweep, target lock ping, magma drone.
 *   3. WRX TR Rally Telemetry: Turbo boost spool whine, sequential shift beeps, blow-off valve (BOV) flutter dump.
 *   4. Hunter Base Dispatch: Mega Man X square wave cursor chirps, stage confirm fanfare, X-Buster charge sweep.
 *   5. Pacific Outpost Hybrid: Dual-resonant tactical sonar ping, comms handshake, geothermal caldera rumble.
 * - Master gain control clamped [0.0, 1.0] with anti-pop parameter ramping.
 * - DynamicsCompressorNode egress brickwall limiter to eliminate clipping (>0 dBFS).
 * - Deferred AudioContext autoplay unlock on user gesture / sound toggle.
 * - UMD export for CommonJS (Node.js) and browser global window.ClownAudio.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    // CommonJS / Node.js
    module.exports = factory();
  } else {
    // Browser Global
    root.ClownAudio = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  // --- Theme Whitelist & Constants ---
  var VALID_THEMES = Object.freeze([
    'tower-of-power',
    'chozo-visor',
    'wrx-telemetry',
    'hunter-base',
    'pacific-outpost'
  ]);

  var VALID_SFX = Object.freeze([
    'switch',
    'hover',
    'click',
    'special'
  ]);

  var DEFAULT_THEME = 'tower-of-power';
  var STORAGE_KEY_SOUND = 'clownhouse_sound';

  // --- Internal State ---
  var audioCtx = null;
  var masterGainNode = null;
  var compressorNode = null;
  var whiteNoiseBuffer = null;
  var pinkNoiseBuffer = null;

  // Audio is muted by default per autoplay policy
  var isMuted = true;
  var soundEnabled = false;
  var currentVolume = 0.75;
  var activeTheme = DEFAULT_THEME;
  var lastHoverTime = 0;

  // --- Safe Storage Helpers ---
  function safeGetStorage(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Storage access blocked or restricted
    }
    return null;
  }

  function safeSetStorage(key, val) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch (e) {
      // Storage quota or restriction
    }
  }

  // --- Safe AudioContext Class Resolution ---
  function getAudioContextClass() {
    if (typeof window !== 'undefined') {
      return window.AudioContext || window.webkitAudioContext || null;
    }
    if (typeof globalThis !== 'undefined') {
      return globalThis.AudioContext || globalThis.webkitAudioContext || null;
    }
    return null;
  }

  // --- Audio Graph Setup (Egress Limiter & Safety) ---
  function buildAudioGraph() {
    if (!audioCtx) return;

    try {
      var now = audioCtx.currentTime;

      // 1. Master Gain Node (clamped volume & mute ramp)
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.setValueAtTime(isMuted ? 0.0001 : currentVolume, now);

      // 2. Dynamics Compressor Node (Brickwall limiter egress to prevent clipping)
      compressorNode = audioCtx.createDynamicsCompressor();
      compressorNode.threshold.setValueAtTime(-12.0, now);
      compressorNode.knee.setValueAtTime(20.0, now);
      compressorNode.ratio.setValueAtTime(12.0, now);
      compressorNode.attack.setValueAtTime(0.003, now);
      compressorNode.release.setValueAtTime(0.150, now);

      // Graph Routing: Master Gain -> Dynamics Compressor -> Audio Destination
      masterGainNode.connect(compressorNode);
      compressorNode.connect(audioCtx.destination);
    } catch (e) {
      // Fail-open gracefully
    }
  }

  // --- Audio Context Lifecycle (Deferred Autoplay Unlock) ---
  function initContext() {
    if (audioCtx && audioCtx.state === 'running') {
      return audioCtx;
    }

    if (!audioCtx) {
      var AudioCtxClass = getAudioContextClass();
      if (!AudioCtxClass) {
        // Headless / non-browser environment lacking audio hardware
        return null;
      }
      try {
        audioCtx = new AudioCtxClass();
        buildAudioGraph();
      } catch (err) {
        audioCtx = null;
        return null;
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      try {
        audioCtx.resume().catch(function () {
          // Promise rejection caught gracefully if activation expired
        });
      } catch (e) {
        // Fallback for older browsers
      }
    }

    return audioCtx;
  }

  // --- Procedural Noise Buffers (Singleton Caching - F09) ---
  function getWhiteNoiseBuffer(ctx) {
    if (!ctx) return null;
    if (whiteNoiseBuffer && whiteNoiseBuffer.sampleRate === ctx.sampleRate) {
      return whiteNoiseBuffer;
    }
    try {
      var sampleRate = ctx.sampleRate;
      var bufferSize = sampleRate * 2; // 2 seconds of mono white noise
      whiteNoiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
      var data = whiteNoiseBuffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return whiteNoiseBuffer;
    } catch (e) {
      return null;
    }
  }

  function getPinkNoiseBuffer(ctx) {
    if (!ctx) return null;
    if (pinkNoiseBuffer && pinkNoiseBuffer.sampleRate === ctx.sampleRate) {
      return pinkNoiseBuffer;
    }
    try {
      var sampleRate = ctx.sampleRate;
      var bufferSize = sampleRate * 2; // 2 seconds of mono pink noise
      pinkNoiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
      var data = pinkNoiseBuffer.getChannelData(0);
      var b0 = 0, b1 = 0, b2 = 0;
      for (var i = 0; i < bufferSize; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.05;
      }
      return pinkNoiseBuffer;
    } catch (e) {
      return null;
    }
  }

  // --- Multi-Operator FM Voice Synthesis Engine (F08, F10, F11, F13, F14) ---
  function playFMVoice(params) {
    if (!soundEnabled || isMuted || !audioCtx || !masterGainNode) return null;

    try {
      var now = audioCtx.currentTime;
      var duration = params.duration || 0.22;

      // 1. Modulator Oscillator Node
      var modOsc = audioCtx.createOscillator();
      modOsc.type = params.modType || 'sine';
      var modFreq = params.modFreq || 220;
      modOsc.frequency.setValueAtTime(modFreq, now);

      // 2. Modulator Gain Node (Controls Peak Frequency Deviation Delta_f)
      var modGain = audioCtx.createGain();
      var peakMod = params.modIndex !== undefined
        ? params.modIndex * modFreq
        : (params.modGain !== undefined ? params.modGain : 220);

      modGain.gain.setValueAtTime(0.0001, now);
      modGain.gain.linearRampToValueAtTime(peakMod, now + (params.modAttack || 0.003));
      modGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, params.modSustainGain || 1.0),
        now + (params.modDecay || duration * 0.6)
      );
      modGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // 3. Carrier Oscillator Node
      var carrierOsc = audioCtx.createOscillator();
      carrierOsc.type = params.carrierType || 'sine';
      var carrierFreq = params.carrierFreq || 110;
      carrierOsc.frequency.setValueAtTime(carrierFreq, now);
      if (params.carrierTargetFreq && params.carrierTargetFreq !== carrierFreq) {
        carrierOsc.frequency.exponentialRampToValueAtTime(params.carrierTargetFreq, now + duration);
      }

      // Route Modulator -> Carrier Frequency (W3C FM graph)
      modOsc.connect(modGain);
      modGain.connect(carrierOsc.frequency);

      // 4. Carrier Amplitude Gain Envelope
      var carrierGain = audioCtx.createGain();
      carrierGain.gain.setValueAtTime(0.0001, now);
      carrierGain.gain.linearRampToValueAtTime(params.peakGain || 0.5, now + (params.attack || 0.004));
      carrierGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, params.sustainGain || 0.01),
        now + (params.decay || duration * 0.75)
      );
      carrierGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // 5. Optional Filter Node (lowpass, bandpass, highpass, peaking)
      var outputNode = carrierGain;
      var filterNode = null;
      if (params.filterType) {
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = params.filterType;
        filterNode.frequency.setValueAtTime(params.filterFreq || 2000, now);
        if (params.filterQ) filterNode.Q.setValueAtTime(params.filterQ, now);
        if (params.filterGain) filterNode.gain.setValueAtTime(params.filterGain, now);
        if (params.filterTargetFreq) {
          filterNode.frequency.exponentialRampToValueAtTime(params.filterTargetFreq, now + duration);
        }
        carrierGain.connect(filterNode);
        outputNode = filterNode;
      }

      carrierOsc.connect(carrierGain);
      outputNode.connect(masterGainNode);

      // Node Lifecycle Management
      modOsc.start(now);
      carrierOsc.start(now);
      modOsc.stop(now + duration + 0.04);
      carrierOsc.stop(now + duration + 0.04);

      carrierOsc.onended = function () {
        try {
          modOsc.disconnect();
          modGain.disconnect();
          carrierOsc.disconnect();
          carrierGain.disconnect();
          if (filterNode) filterNode.disconnect();
        } catch (e) {}
      };

      return carrierOsc;
    } catch (e) {
      return null;
    }
  }

  // --- Procedural Filtered Noise Generator (F09, F10, F12) ---
  function playNoiseBurst(params) {
    if (!soundEnabled || isMuted || !audioCtx || !masterGainNode) return null;

    try {
      var buffer = params.noiseType === 'pink'
        ? getPinkNoiseBuffer(audioCtx)
        : getWhiteNoiseBuffer(audioCtx);

      if (!buffer) return null;

      var now = audioCtx.currentTime;
      var duration = params.duration || 0.1;

      var source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = Boolean(params.loop);

      var filter = audioCtx.createBiquadFilter();
      filter.type = params.filterType || 'bandpass';
      var fStart = Math.max(10, params.filterFreq || 1500);
      filter.frequency.setValueAtTime(fStart, now);
      filter.Q.setValueAtTime(params.filterQ || 2.0, now);
      if (params.filterTargetFreq) {
        var fEnd = Math.max(10, params.filterTargetFreq);
        filter.frequency.exponentialRampToValueAtTime(fEnd, now + duration);
      }

      var noiseGain = audioCtx.createGain();
      var peakGain = params.gain !== undefined ? params.gain : 0.3;
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(peakGain, now + (params.attack || 0.004));
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGainNode);

      source.start(now);
      source.stop(now + duration + 0.02);

      source.onended = function () {
        try {
          source.disconnect();
          filter.disconnect();
          noiseGain.disconnect();
        } catch (e) {}
      };

      return source;
    } catch (e) {
      return null;
    }
  }

  // --- Direct Tone Generator (F10, F11, F13, F14) ---
  function playTone(freq, type, duration, gainVal) {
    if (!soundEnabled || isMuted || !audioCtx || !masterGainNode) return null;

    try {
      var now = audioCtx.currentTime;
      var dur = duration || 0.1;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq || 440, now);

      var peak = gainVal !== undefined ? gainVal : 0.3;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(masterGainNode);

      osc.start(now);
      osc.stop(now + dur + 0.02);

      osc.onended = function () {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (e) {}
      };

      return osc;
    } catch (e) {
      return null;
    }
  }

  // --- Bespoke Acoustic Profile Implementations ---
  var PROFILES = {
    // 1. Tower of Power (Sega Genesis YM2612 FM Synthesis)
    'tower-of-power': {
      hover: function () {
        // FM Metallic Slap Bass
        playFMVoice({
          carrierFreq: 110.0,
          carrierType: 'sine',
          modFreq: 220.0,
          modType: 'sine',
          modIndex: 2.18,
          modAttack: 0.002,
          modDecay: 0.09,
          peakGain: 0.55,
          attack: 0.003,
          decay: 0.16,
          sustainGain: 0.02,
          duration: 0.22,
          filterType: 'lowpass',
          filterFreq: 3600,
          filterQ: 1.8
        });
      },
      click: function () {
        // Cartridge Lock Latch Click: Sub thud + bandpass friction noise
        playTone(160, 'square', 0.035, 0.35);
        playNoiseBurst({
          duration: 0.025,
          filterType: 'bandpass',
          filterFreq: 2400,
          filterTargetFreq: 1800,
          filterQ: 4.5,
          gain: 0.30
        });
        setTimeout(function () {
          if (!soundEnabled || isMuted) return;
          playNoiseBurst({
            duration: 0.015,
            filterType: 'bandpass',
            filterFreq: 3800,
            filterQ: 6.0,
            gain: 0.16
          });
        }, 28);
      },
      switch: function () {
        // 16-Bit Power-On Arpeggio (C4, E4, G4, C5)
        var notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach(function (freq, idx) {
          setTimeout(function () {
            if (!soundEnabled || isMuted) return;
            playFMVoice({
              carrierFreq: freq,
              carrierType: 'sine',
              modFreq: freq * 2,
              modType: 'sine',
              modIndex: 1.8,
              modAttack: 0.003,
              modDecay: 0.10,
              peakGain: 0.45,
              attack: 0.004,
              decay: idx === 3 ? 0.28 : 0.16,
              duration: idx === 3 ? 0.32 : 0.18,
              filterType: 'lowpass',
              filterFreq: 4000,
              filterQ: 1.2
            });
          }, idx * 40);
        });
      },
      special: function () {
        // 32X Hardware Expansion Chime
        playFMVoice({
          carrierFreq: 523.25,
          carrierType: 'triangle',
          modFreq: 1046.5,
          modIndex: 2.5,
          peakGain: 0.55,
          duration: 0.35,
          filterType: 'lowpass',
          filterFreq: 4500
        });
      }
    },

    // 2. Chozo Scan Visor (Metroid Holographic Combat HUD)
    'chozo-visor': {
      hover: function () {
        // Holographic Visor Scan Sweep (A6 to A7)
        playFMVoice({
          carrierFreq: 1760.0,
          carrierTargetFreq: 3520.0,
          carrierType: 'sine',
          modFreq: 880.0,
          modType: 'sine',
          modIndex: 0.32,
          modAttack: 0.002,
          modDecay: 0.06,
          peakGain: 0.35,
          attack: 0.005,
          decay: 0.12,
          duration: 0.14,
          filterType: 'bandpass',
          filterFreq: 2600,
          filterQ: 8.0
        });
      },
      click: function () {
        // Target Logbook Lock-On Ping: Two-tone Major Third (C7 to E7)
        playTone(2093.0, 'sine', 0.05, 0.35);
        setTimeout(function () {
          if (!soundEnabled || isMuted) return;
          playFMVoice({
            carrierFreq: 2637.0,
            carrierType: 'sine',
            modFreq: 523.25,
            modIndex: 0.25,
            peakGain: 0.40,
            attack: 0.004,
            decay: 0.20,
            duration: 0.22,
            filterType: 'peaking',
            filterFreq: 3200,
            filterQ: 4.0,
            filterGain: 5.0
          });
        }, 45);
      },
      switch: function () {
        // Scan Visor Mode Initialize Frequency Sweep
        playFMVoice({
          carrierFreq: 440.0,
          carrierTargetFreq: 1760.0,
          carrierType: 'sine',
          modFreq: 880.0,
          modIndex: 0.5,
          peakGain: 0.40,
          duration: 0.35,
          filterType: 'highpass',
          filterFreq: 800,
          filterQ: 6.0
        });
      },
      special: function () {
        // Magma Drone / Subterranean Geothermal Hum
        playTone(55.0, 'sine', 0.50, 0.25);
        playNoiseBurst({
          noiseType: 'pink',
          duration: 0.45,
          filterType: 'lowpass',
          filterFreq: 120,
          filterQ: 3.0,
          gain: 0.18
        });
      }
    },

    // 3. WRX TR Rally Telemetry (Motorsport Mechanics)
    'wrx-telemetry': {
      hover: function () {
        // Turbo Boost Spool Whistle: Resonant Filter Sweep + Turbine Sine
        playNoiseBurst({
          noiseType: 'white',
          duration: 0.24,
          filterType: 'bandpass',
          filterFreq: 1200,
          filterTargetFreq: 4200,
          filterQ: 14.0,
          gain: 0.30
        });
        playFMVoice({
          carrierFreq: 800,
          carrierTargetFreq: 2800,
          carrierType: 'sine',
          modFreq: 120,
          modGain: 30,
          peakGain: 0.12,
          duration: 0.24
        });
      },
      click: function () {
        // Blow-Off Valve (BOV) Pressure Dump & Sequential Flutter Pulses
        playNoiseBurst({
          noiseType: 'white',
          filterType: 'highpass',
          filterFreq: 2600,
          filterQ: 2.5,
          gain: 0.32,
          duration: 0.055
        });
        // Sub-bass exhaust pop
        playTone(95, 'square', 0.04, 0.20);
        // Sequential compressor flutter pulses (tsu-tsu-tsu)
        [60, 105, 145].forEach(function (delay, idx) {
          setTimeout(function () {
            if (!soundEnabled || isMuted) return;
            playNoiseBurst({
              noiseType: 'white',
              duration: idx === 0 ? 0.035 : 0.025,
              filterType: 'bandpass',
              filterFreq: 2800 - (idx * 300),
              filterQ: 4.0,
              gain: 0.20 / (idx + 1)
            });
          }, delay);
        });
      },
      switch: function () {
        // Sequential Shift Light Beeps
        [0, 60, 120].forEach(function (delay) {
          setTimeout(function () {
            if (!soundEnabled || isMuted) return;
            playTone(1760, 'square', 0.035, 0.25);
          }, delay);
        });
      },
      special: function () {
        // Redline Rev Limiter
        playTone(220, 'sawtooth', 0.15, 0.35);
        setTimeout(function () {
          if (!soundEnabled || isMuted) return;
          playTone(2349.3, 'square', 0.035, 0.25);
          setTimeout(function () {
            if (!soundEnabled || isMuted) return;
            playTone(2793.8, 'square', 0.035, 0.25);
          }, 35);
        }, 40);
      }
    },

    // 4. Hunter Base Dispatch (Mega Man X Futuristic Anime Tech)
    'hunter-base': {
      hover: function () {
        // Stage Select Cursor Pip: High-speed Square Wave Hop
        playTone(987.77, 'square', 0.022, 0.32);
        setTimeout(function () {
          if (!soundEnabled || isMuted) return;
          playTone(1318.51, 'square', 0.040, 0.32);
        }, 22);
      },
      click: function () {
        // Stage Confirm 3-Step Fanfare (D5 -> A5 -> D6)
        var cascade = [587.33, 880.00, 1174.66];
        cascade.forEach(function (freq, i) {
          setTimeout(function () {
            if (!soundEnabled || isMuted) return;
            playTone(freq, 'square', i === 2 ? 0.12 : 0.035, 0.35);
          }, i * 35);
        });
      },
      switch: function () {
        // Maverick Alert Dispatch Fanfare (F5, G#5, A#5, C6)
        var alertNotes = [698.46, 830.61, 932.33, 1046.50];
        alertNotes.forEach(function (freq, i) {
          setTimeout(function () {
            if (!soundEnabled || isMuted) return;
            playTone(freq, 'square', 0.09, 0.30);
          }, i * 50);
        });
      },
      special: function () {
        // X-Buster Plasma Charging Pitch Sweep & Release Burst
        playFMVoice({
          carrierFreq: 220.0,
          carrierTargetFreq: 1320.0,
          carrierType: 'square',
          modFreq: 7.5, // Vibrato LFO
          modGain: 35.0,
          peakGain: 0.38,
          duration: 0.38,
          filterType: 'bandpass',
          filterFreq: 1200,
          filterQ: 2.5
        });
        setTimeout(function () {
          if (!soundEnabled || isMuted) return;
          playNoiseBurst({
            noiseType: 'white',
            duration: 0.04,
            filterType: 'bandpass',
            filterFreq: 1400,
            filterQ: 3.0,
            gain: 0.30
          });
        }, 340);
      }
    },

    // 5. Pacific Outpost Hybrid (Tactical Communications & Sonar Telemetry)
    'pacific-outpost': {
      hover: function () {
        // Tactical Dual-Resonant Sonar Ping (F#6 + Harmonic C#7)
        playFMVoice({
          carrierFreq: 1480.0,
          carrierType: 'sine',
          modFreq: 74.0,
          modIndex: 0.61,
          peakGain: 0.42,
          attack: 0.003,
          decay: 0.32,
          duration: 0.38,
          filterType: 'bandpass',
          filterFreq: 1650,
          filterQ: 5.5
        });
        playTone(2220.0, 'sine', 0.26, 0.20);
      },
      click: function () {
        // Tactical Comms Data Confirmation Dual-Tone (C6 + G6)
        playTone(1046.5, 'sine', 0.07, 0.28);
        playTone(1567.98, 'sine', 0.07, 0.24);
      },
      switch: function () {
        // Tactical Telemetry Hybrid Switch Chime
        playFMVoice({
          carrierFreq: 880.0,
          carrierTargetFreq: 1760.0,
          carrierType: 'sine',
          modFreq: 220.0,
          modIndex: 1.2,
          peakGain: 0.40,
          duration: 0.32
        });
      },
      special: function () {
        // Caldera Geothermal Sub-Bass Rumble
        playTone(42.0, 'sine', 0.55, 0.25);
        playNoiseBurst({
          noiseType: 'pink',
          duration: 0.50,
          filterType: 'lowpass',
          filterFreq: 65,
          filterQ: 2.0,
          gain: 0.24
        });
      }
    }
  };

  // --- Public Interface Methods ---

  /**
   * Switches the active theme sound synthesis profile.
   * @param {string} themeName - Name of the target theme
   * @returns {boolean} True if theme is valid, false otherwise
   */
  function setTheme(themeName) {
    if (VALID_THEMES.indexOf(themeName) !== -1) {
      activeTheme = themeName;
      return true;
    }
    return false;
  }

  /**
   * Sets master output volume clamped between 0.0 and 1.0.
   * @param {number|string} volumeFraction - Volume between 0.0 and 1.0
   * @returns {number} Clamped volume fraction
   */
  function setVolume(volumeFraction) {
    var v = 0.0;
    try {
      if (typeof volumeFraction !== 'symbol' && volumeFraction !== null && typeof volumeFraction !== 'undefined') {
        v = Number(volumeFraction);
      }
    } catch (e) {
      v = 0.0;
    }
    if (isNaN(v) || typeof v !== 'number') {
      v = 0.0;
    }
    currentVolume = Math.max(0.0, Math.min(1.0, v));

    if (!isMuted && masterGainNode && audioCtx) {
      try {
        var now = audioCtx.currentTime;
        masterGainNode.gain.cancelScheduledValues(now);
        masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, now);
        masterGainNode.gain.linearRampToValueAtTime(currentVolume, now + 0.02);
      } catch (e) {}
    }

    return currentVolume;
  }

  /**
   * Toggles master audio mute state with anti-pop parameter ramping.
   * @returns {boolean} New isMuted state
   */
  function toggleMute() {
    isMuted = !isMuted;
    soundEnabled = !isMuted;

    if (!isMuted) {
      initContext();
      if (masterGainNode && audioCtx) {
        try {
          var nowUnmute = audioCtx.currentTime;
          masterGainNode.gain.cancelScheduledValues(nowUnmute);
          masterGainNode.gain.setValueAtTime(0.0001, nowUnmute);
          masterGainNode.gain.linearRampToValueAtTime(currentVolume, nowUnmute + 0.02);
        } catch (e) {}
      }
    } else {
      if (masterGainNode && audioCtx) {
        try {
          var nowMute = audioCtx.currentTime;
          masterGainNode.gain.cancelScheduledValues(nowMute);
          masterGainNode.gain.setValueAtTime(Math.max(0.0001, masterGainNode.gain.value), nowMute);
          masterGainNode.gain.linearRampToValueAtTime(0.0001, nowMute + 0.02);
        } catch (e) {}
      }
    }

    safeSetStorage(STORAGE_KEY_SOUND, isMuted ? 'off' : 'on');
    return isMuted;
  }

  /**
   * Returns current mute state.
   * @returns {boolean} True if muted, false if unmuted
   */
  function isMutedState() {
    return isMuted;
  }

  /**
   * Triggers a procedurally synthesized sound effect for active theme.
   * @param {string} sfxType - 'switch', 'hover', 'click', or 'special'
   * @returns {boolean} True if played, false if muted or throttled
   */
  function playSfx(sfxType) {
    // 1. Validate SFX type (whitelist check defends against prototype bypass and invalid types)
    if (typeof sfxType !== 'string' || VALID_SFX.indexOf(sfxType) === -1) {
      return false;
    }

    // 2. Mute / Sound Enabled Guard (fail fast without spinning up AudioContext if muted)
    if (!soundEnabled || isMuted) {
      return false;
    }

    // 3. Protect audio thread from hover event floods (<25ms throttle)
    var nowPerf = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    if (sfxType === 'hover') {
      if ((nowPerf - lastHoverTime) < 25) {
        return false;
      }
      lastHoverTime = nowPerf;
    }

    // 4. Deferred context initialization (unlocks AudioContext seamlessly on user gesture)
    initContext();
    if (!audioCtx) {
      return false;
    }

    // 5. Execute theme-specific acoustic profile sound with prototype ownership defense
    var profile = PROFILES[activeTheme] || PROFILES[DEFAULT_THEME];
    if (!profile) {
      return false;
    }

    try {
      if (Object.prototype.hasOwnProperty.call(profile, sfxType) && typeof profile[sfxType] === 'function') {
        profile[sfxType]();
        return true;
      }
    } catch (err) {
      return false;
    }

    return false;
  }

  // --- Initial State Hydration from Storage & DOM ---
  try {
    var storedSound = safeGetStorage(STORAGE_KEY_SOUND);
    if (storedSound === 'on') {
      isMuted = false;
      soundEnabled = true;
    } else {
      isMuted = true;
      soundEnabled = false;
    }
  } catch (e) {
    isMuted = true;
    soundEnabled = false;
  }

  // Register passive event listeners in browser environment
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('themechange', function (e) {
      if (e && e.detail && e.detail.theme) {
        setTheme(e.detail.theme);
      }
    });

    if (typeof document !== 'undefined' && document.documentElement) {
      var domTheme = document.documentElement.getAttribute('data-theme');
      if (VALID_THEMES.indexOf(domTheme) !== -1) {
        activeTheme = domTheme;
      }
    }
  }

  // --- Public Interface Export ---
  return {
    initContext: initContext,
    setTheme: setTheme,
    setVolume: setVolume,
    toggleMute: toggleMute,
    isMuted: isMutedState,
    playSfx: playSfx,
    playTone: playTone,
    getActiveTheme: function () { return activeTheme; },
    getVolume: function () { return currentVolume; },
    getContextState: function () { return audioCtx ? audioCtx.state : 'uninitialized'; }
  };
}));
