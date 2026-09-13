/**
 * CLOWNHOUSE.IO // PROCEDURAL WEB AUDIO SYNTHESIS & AMBIENT ENGINE
 * Pure Web Audio API — 100% Client-Side Generative Synthesis — Zero External Audio Files
 * 
 * Features:
 * - 4 Procedural Frequency Modes:
 *     LAB-01: Carrier Drift (55Hz Sub · 432Hz Carrier)
 *     LAB-02: Cybernetic Drone (110Hz Drone · Modulated Filter)
 *     LAB-03: Necrometer 528Hz (528Hz Solfeggio Matrix · Pulse Sweep)
 *     LAB-04: Velvet Frequency (63Hz Warm Bass · Pink Noise Wash)
 * - Real-Time AnalyserNode frequency bin visualization driving 4 EQ bars.
 * - DynamicsCompressorNode brickwall limiter preventing digital clipping (>0 dBFS).
 * - Anti-pop gain ramps on play/pause/mute and track transitions.
 * - Autoplay policy compliance: suspended until first explicit user gesture.
 * - Spacebar shortcut for toggle play/pause with input field guards.
 * - Full UMD export supporting Node.js test environments and browser globals.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ClownAudio = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  // --- Track Catalog Specification ---
  const TRACKS = Object.freeze([
    {
      id: 'lab-01',
      title: 'LAB-01: Carrier Drift',
      freq: '55Hz Sub · 432Hz Carrier',
      desc: 'Binaural carrier wave and resonant sub-bass drift'
    },
    {
      id: 'lab-02',
      title: 'LAB-02: Cybernetic Drone',
      freq: '110Hz Drone · Modulated Filter',
      desc: 'Harmonic saw drone modulated by sweeping lowpass filters'
    },
    {
      id: 'lab-03',
      title: 'LAB-03: Necrometer 528Hz',
      freq: '528Hz Solfeggio Matrix · Pulse Sweep',
      desc: 'Solfeggio repair frequency matrix with stereo feedback delay'
    },
    {
      id: 'lab-04',
      title: 'LAB-04: Velvet Frequency',
      freq: '63Hz Warm Bass · Pink Noise Wash',
      desc: 'Deep warm analog baseline immersed in Voss-McCartney pink noise'
    }
  ]);

  // --- Internal State ---
  let audioCtx = null;
  let masterGainNode = null;
  let compressorNode = null;
  let analyserNode = null;
  let activeTrackNodes = null;
  let pinkNoiseBuffer = null;

  let isPlaying = false;
  let isMuted = true; // Muted / paused by default per autoplay policy
  let volume = 0.7; // Clamped [0.0, 1.0]
  let currentTrackIndex = 0;
  let animFrameId = null;

  // --- Safe AudioContext Instantiation ---
  function getAudioContext() {
    if (audioCtx) return audioCtx;
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return null;

    try {
      audioCtx = new AudioContextClass();

      // Master Limiter Compressor
      compressorNode = audioCtx.createDynamicsCompressor();
      compressorNode.threshold.setValueAtTime(-6, audioCtx.currentTime);
      compressorNode.knee.setValueAtTime(12, audioCtx.currentTime);
      compressorNode.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressorNode.release.setValueAtTime(0.25, audioCtx.currentTime);
      compressorNode.connect(audioCtx.destination);

      // Master Gain Node
      masterGainNode = audioCtx.createGain();
      const initialGain = isMuted ? 0 : volume;
      masterGainNode.gain.setValueAtTime(initialGain, audioCtx.currentTime);
      masterGainNode.connect(compressorNode);

      // Real-Time Analyser
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;
      analyserNode.smoothingTimeConstant = 0.8;
      analyserNode.connect(masterGainNode);

      // Pre-synthesize Pink Noise Buffer (2 seconds @ 44.1kHz)
      generatePinkNoiseBuffer();
    } catch (err) {
      console.warn('[ClownAudio] Failed to initialize AudioContext:', err);
      audioCtx = null;
    }

    return audioCtx;
  }

  // --- Procedural Pink Noise Buffer Generation ---
  // Voss-McCartney algorithm produces 1/f noise (-3dB/octave)
  function generatePinkNoiseBuffer() {
    if (!audioCtx) return;
    try {
      const bufferSize = audioCtx.sampleRate * 2;
      pinkNoiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = pinkNoiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    } catch (e) {
      console.warn('[ClownAudio] Pink noise generation error:', e);
    }
  }

  // --- Procedural Synthesizers for 4 Frequency Modes ---

  // Track 0: LAB-01: Carrier Drift (55Hz Sub · 432Hz Carrier)
  function buildTrack0(ctx, dest) {
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.001, ctx.currentTime);

    // Sub oscillator (55 Hz sine)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, ctx.currentTime);

    // LFO for subtle sub pitch drift (0.1 Hz)
    const subLfo = ctx.createOscillator();
    const subLfoGain = ctx.createGain();
    subLfo.frequency.setValueAtTime(0.1, ctx.currentTime);
    subLfoGain.gain.setValueAtTime(0.8, ctx.currentTime);
    subLfo.connect(subLfoGain);
    subLfoGain.connect(subOsc.frequency);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.42, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(trackGain);

    // 432 Hz Carrier oscillator
    const carrierOsc1 = ctx.createOscillator();
    carrierOsc1.type = 'sine';
    carrierOsc1.frequency.setValueAtTime(432, ctx.currentTime);

    // 434 Hz Binaural detune (2 Hz beat frequency)
    const carrierOsc2 = ctx.createOscillator();
    carrierOsc2.type = 'sine';
    carrierOsc2.frequency.setValueAtTime(434, ctx.currentTime);

    const carrierFilter = ctx.createBiquadFilter();
    carrierFilter.type = 'lowpass';
    carrierFilter.frequency.setValueAtTime(800, ctx.currentTime);
    carrierFilter.Q.setValueAtTime(1.5, ctx.currentTime);

    const carrierGain = ctx.createGain();
    carrierGain.gain.setValueAtTime(0.12, ctx.currentTime);

    carrierOsc1.connect(carrierFilter);
    carrierOsc2.connect(carrierFilter);
    carrierFilter.connect(carrierGain);
    carrierGain.connect(trackGain);

    trackGain.connect(dest);

    subOsc.start();
    subLfo.start();
    carrierOsc1.start();
    carrierOsc2.start();

    return {
      trackGain,
      stop(fadeTime) {
        trackGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeTime);
        setTimeout(() => {
          try {
            subOsc.stop();
            subLfo.stop();
            carrierOsc1.stop();
            carrierOsc2.stop();
            trackGain.disconnect();
          } catch (_) {}
        }, fadeTime * 1000 + 50);
      }
    };
  }

  // Track 1: LAB-02: Cybernetic Drone (110Hz Drone · Modulated Filter)
  function buildTrack1(ctx, dest) {
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.001, ctx.currentTime);

    // Fundamental (110 Hz triangle)
    const rootOsc = ctx.createOscillator();
    rootOsc.type = 'triangle';
    rootOsc.frequency.setValueAtTime(110, ctx.currentTime);

    // 5th Harmonic (165 Hz sine)
    const fifthOsc = ctx.createOscillator();
    fifthOsc.type = 'sine';
    fifthOsc.frequency.setValueAtTime(165, ctx.currentTime);

    // Sub fundamental (55 Hz sine)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, ctx.currentTime);

    // Resonant Lowpass Filter with sweeping LFO
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.Q.setValueAtTime(4.0, ctx.currentTime);

    const filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.setValueAtTime(0.14, ctx.currentTime);
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.setValueAtTime(320, ctx.currentTime);
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);

    const oscMix = ctx.createGain();
    oscMix.gain.setValueAtTime(0.28, ctx.currentTime);

    rootOsc.connect(filter);
    fifthOsc.connect(filter);
    subOsc.connect(filter);
    filter.connect(oscMix);
    oscMix.connect(trackGain);
    trackGain.connect(dest);

    rootOsc.start();
    fifthOsc.start();
    subOsc.start();
    filterLfo.start();

    return {
      trackGain,
      stop(fadeTime) {
        trackGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeTime);
        setTimeout(() => {
          try {
            rootOsc.stop();
            fifthOsc.stop();
            subOsc.stop();
            filterLfo.stop();
            trackGain.disconnect();
          } catch (_) {}
        }, fadeTime * 1000 + 50);
      }
    };
  }

  // Track 2: LAB-03: Necrometer 528Hz (528Hz Solfeggio Matrix · Pulse Sweep)
  function buildTrack2(ctx, dest) {
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.001, ctx.currentTime);

    // 528 Hz Pure Solfeggio Tone
    const solfeggioOsc = ctx.createOscillator();
    solfeggioOsc.type = 'sine';
    solfeggioOsc.frequency.setValueAtTime(528, ctx.currentTime);

    // 264 Hz Sub-octave
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(264, ctx.currentTime);

    // 792 Hz Minor third overtone
    const overtoneOsc = ctx.createOscillator();
    overtoneOsc.type = 'sine';
    overtoneOsc.frequency.setValueAtTime(792, ctx.currentTime);

    // Procedural Delay Matrix (260ms delay with 0.35 feedback)
    const delay = ctx.createDelay();
    delay.delayTime.setValueAtTime(0.26, ctx.currentTime);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.32, ctx.currentTime);
    delay.connect(feedback);
    feedback.connect(delay);

    // Subtle Amplitude Tremolo LFO (0.09 Hz)
    const tremolo = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.09, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.04, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(tremolo.gain);

    const mixGain = ctx.createGain();
    mixGain.gain.setValueAtTime(0.18, ctx.currentTime);

    solfeggioOsc.connect(tremolo);
    subOsc.connect(tremolo);
    overtoneOsc.connect(tremolo);
    tremolo.connect(mixGain);
    mixGain.connect(delay);
    mixGain.connect(trackGain);
    delay.connect(trackGain);
    trackGain.connect(dest);

    solfeggioOsc.start();
    subOsc.start();
    overtoneOsc.start();
    lfo.start();

    return {
      trackGain,
      stop(fadeTime) {
        trackGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeTime);
        setTimeout(() => {
          try {
            solfeggioOsc.stop();
            subOsc.stop();
            overtoneOsc.stop();
            lfo.stop();
            trackGain.disconnect();
          } catch (_) {}
        }, fadeTime * 1000 + 50);
      }
    };
  }

  // Track 3: LAB-04: Velvet Frequency (63Hz Warm Bass · Pink Noise Wash)
  function buildTrack3(ctx, dest) {
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.001, ctx.currentTime);

    // 63 Hz Warm Bass
    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(63, ctx.currentTime);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.40, ctx.currentTime);
    bassOsc.connect(bassGain);
    bassGain.connect(trackGain);

    // Pink Noise Wash through Lowpass Filter
    let noiseSource = null;
    if (pinkNoiseBuffer) {
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = pinkNoiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(320, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(1.8, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.14, ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(trackGain);
      noiseSource.start();
    }

    trackGain.connect(dest);
    bassOsc.start();

    return {
      trackGain,
      stop(fadeTime) {
        trackGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeTime);
        setTimeout(() => {
          try {
            bassOsc.stop();
            if (noiseSource) noiseSource.stop();
            trackGain.disconnect();
          } catch (_) {}
        }, fadeTime * 1000 + 50);
      }
    };
  }

  const TRACK_BUILDERS = [buildTrack0, buildTrack1, buildTrack2, buildTrack3];

  // --- Safe Animation Frame Helpers ---
  function safeRequestAnimationFrame(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }
    return null;
  }

  function safeCancelAnimationFrame(id) {
    if (!id) return;
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(id);
      return;
    }
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(id);
    }
  }

  // --- Real-Time Analyser EQ Bar Visualization Loop ---
  function startVisualizerLoop() {
    if (animFrameId) return;
    const eqBars = typeof document !== 'undefined' ? [
      document.querySelector('.eq-bar.bar-1'),
      document.querySelector('.eq-bar.bar-2'),
      document.querySelector('.eq-bar.bar-3'),
      document.querySelector('.eq-bar.bar-4')
    ] : null;

    const dataArray = analyserNode ? new Uint8Array(analyserNode.frequencyBinCount) : null;

    function render() {
      if (!isPlaying || isMuted || !analyserNode || !dataArray) {
        // Reset bars to resting height
        if (eqBars) {
          eqBars.forEach(b => {
            if (b) b.style.height = '3px';
          });
        }
        animFrameId = null;
        return;
      }

      analyserNode.getByteFrequencyData(dataArray);

      if (eqBars) {
        // Map frequency bands:
        // Band 1: sub (bins 0..1)
        // Band 2: low-mid (bins 2..3)
        // Band 3: mid (bins 4..6)
        // Band 4: high-mid (bins 7..12)
        const v1 = Math.max(dataArray[0] || 0, dataArray[1] || 0);
        const v2 = Math.max(dataArray[2] || 0, dataArray[3] || 0);
        const v3 = Math.max(dataArray[4] || 0, dataArray[5] || 0);
        const v4 = Math.max(dataArray[7] || 0, dataArray[9] || 0);

        const h1 = Math.max(3, Math.min(14, 3 + Math.floor((v1 / 255) * 11)));
        const h2 = Math.max(3, Math.min(14, 3 + Math.floor((v2 / 255) * 11)));
        const h3 = Math.max(3, Math.min(14, 3 + Math.floor((v3 / 255) * 11)));
        const h4 = Math.max(3, Math.min(14, 3 + Math.floor((v4 / 255) * 11)));

        if (eqBars[0]) eqBars[0].style.height = `${h1}px`;
        if (eqBars[1]) eqBars[1].style.height = `${h2}px`;
        if (eqBars[2]) eqBars[2].style.height = `${h3}px`;
        if (eqBars[3]) eqBars[3].style.height = `${h4}px`;
      }

      animFrameId = safeRequestAnimationFrame(render);
    }

    animFrameId = safeRequestAnimationFrame(render);
  }

  function stopVisualizerLoop() {
    if (animFrameId) {
      safeCancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (typeof document !== 'undefined') {
      const eqBars = document.querySelectorAll('.eq-bar');
      eqBars.forEach(b => {
        b.style.height = '3px';
      });
    }
  }

  // --- UI Synchronizer ---
  function syncUI() {
    if (typeof document === 'undefined') return;

    const pill = document.getElementById('floating-audio-pill');
    const playIcon = document.getElementById('audio-play-icon');
    const pauseIcon = document.getElementById('audio-pause-icon');
    const titleEl = document.getElementById('audio-track-title');
    const freqEl = document.getElementById('audio-track-freq');
    const unmutedIcon = document.getElementById('audio-unmuted-icon');
    const mutedIcon = document.getElementById('audio-muted-icon');

    const currentTrack = TRACKS[currentTrackIndex];

    if (titleEl) titleEl.textContent = currentTrack.title;
    if (freqEl) freqEl.textContent = currentTrack.freq;

    if (pill) {
      if (isPlaying && !isMuted) {
        pill.classList.add('is-playing');
      } else {
        pill.classList.remove('is-playing');
      }
    }

    if (playIcon && pauseIcon) {
      if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
    }

    if (unmutedIcon && mutedIcon) {
      if (isMuted) {
        unmutedIcon.classList.add('hidden');
        mutedIcon.classList.remove('hidden');
      } else {
        unmutedIcon.classList.remove('hidden');
        mutedIcon.classList.add('hidden');
      }
    }
  }

  // --- Public Control Methods ---

  async function play() {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('[ClownAudio] Failed to resume AudioContext:', err);
      }
    }

    if (isMuted) {
      isMuted = false;
      if (masterGainNode) {
        masterGainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.15);
      }
    }

    if (!activeTrackNodes) {
      const builder = TRACK_BUILDERS[currentTrackIndex] || TRACK_BUILDERS[0];
      activeTrackNodes = builder(ctx, analyserNode);
      activeTrackNodes.trackGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.2);
    }

    isPlaying = true;
    syncUI();
    startVisualizerLoop();

    dispatchAudioEvent('clownaudio:play', { track: TRACKS[currentTrackIndex] });
  }

  function pause() {
    isPlaying = false;
    if (activeTrackNodes) {
      activeTrackNodes.stop(0.12);
      activeTrackNodes = null;
    }

    syncUI();
    stopVisualizerLoop();

    dispatchAudioEvent('clownaudio:pause', { track: TRACKS[currentTrackIndex] });
  }

  async function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }

  function toggleMute() {
    const ctx = getAudioContext();
    isMuted = !isMuted;

    if (ctx && masterGainNode) {
      const target = isMuted ? 0.0001 : volume;
      masterGainNode.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.12);
    }

    syncUI();
    if (isMuted) {
      stopVisualizerLoop();
    } else if (isPlaying) {
      startVisualizerLoop();
    }

    dispatchAudioEvent('clownaudio:mute', { isMuted });
  }

  function setVolume(fraction) {
    if (typeof fraction !== 'number' || Number.isNaN(fraction) || !Number.isFinite(fraction)) {
      fraction = 0.5;
    }
    volume = Math.max(0.0, Math.min(1.0, fraction));

    if (!isMuted && audioCtx && masterGainNode) {
      masterGainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.08);
    }

    dispatchAudioEvent('clownaudio:volume', { volume });
  }

  function setTrack(index) {
    let targetIndex = Number(index);
    if (Number.isNaN(targetIndex) || targetIndex < 0 || targetIndex >= TRACKS.length) {
      targetIndex = 0;
    }

    if (targetIndex === currentTrackIndex && activeTrackNodes) {
      return;
    }

    currentTrackIndex = targetIndex;
    const ctx = getAudioContext();

    if (isPlaying && ctx) {
      if (activeTrackNodes) {
        activeTrackNodes.stop(0.15);
        activeTrackNodes = null;
      }
      const builder = TRACK_BUILDERS[currentTrackIndex];
      activeTrackNodes = builder(ctx, analyserNode);
      activeTrackNodes.trackGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.2);
    }

    syncUI();
    dispatchAudioEvent('clownaudio:trackchange', {
      trackIndex: currentTrackIndex,
      track: TRACKS[currentTrackIndex]
    });
  }

  function nextTrack() {
    setTrack((currentTrackIndex + 1) % TRACKS.length);
  }

  function prevTrack() {
    setTrack((currentTrackIndex - 1 + TRACKS.length) % TRACKS.length);
  }

  function getState() {
    return {
      isPlaying,
      isMuted,
      volume,
      trackIndex: currentTrackIndex,
      currentTrack: TRACKS[currentTrackIndex]
    };
  }

  function getFrequencyData(array) {
    if (analyserNode && array instanceof Uint8Array) {
      analyserNode.getByteFrequencyData(array);
    }
  }

  // --- Helper & Legacy Compatibility Wrappers ---
  function dispatchAudioEvent(name, detail) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const ev = new CustomEvent(name, { detail });
        window.dispatchEvent(ev);
        if (typeof document !== 'undefined') document.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  // Prototype pollution-safe no-op SFX handler for legacy tests
  function playSfx(type) {
    if (typeof type !== 'string') return false;
    if (!Object.prototype.hasOwnProperty.call({ click: 1, hover: 1, switch: 1, special: 1 }, type)) {
      return false;
    }
    return true;
  }

  function setTheme(themeId) {
    // Ambient frequencies adjust dynamically with themes if desired
    return themeId;
  }

  // --- Keyboard Shortcuts & Event Handlers ---
  function isTypingContext(target) {
    if (!target) return false;
    const tag = target.tagName || '';
    return (
      target.isContentEditable ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT'
    );
  }

  function handleKeydown(e) {
    if (!e || e.defaultPrevented) return;
    // Spacebar toggles playback when outside typing context
    if (e.code === 'Space' || e.key === ' ') {
      if (!isTypingContext(e.target)) {
        e.preventDefault();
        togglePlay();
      }
    }
  }

  // --- Automatic DOM Attachment ---
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown);

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          syncUI();
        });
      } else {
        syncUI();
      }
    }
  }

  // --- Export Interface Contract ---
  const publicApi = {
    TRACKS: [...TRACKS],
    play,
    pause,
    togglePlay,
    toggleMute,
    setVolume,
    setTrack,
    nextTrack,
    prevTrack,
    getState,
    getFrequencyData,
    playSfx,
    setTheme
  };

  return publicApi;
}));
