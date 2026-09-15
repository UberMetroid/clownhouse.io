/**
 * CLOWNHOUSE.IO // AUDIO GRAPH
 * AudioContext construction (limiter -> master gain <- analyser) and
 * the patch player that instantiates catalog descriptors as live nodes.
 */
(function (root) {
  'use strict';
  const CH = root.__clownaudio = root.__clownaudio || {};

  function getAudioContext() {
    const S = CH.state;
    if (S.ctx) return S.ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;

    try {
      S.ctx = new AC();

      S.compressor = S.ctx.createDynamicsCompressor();
      S.compressor.threshold.setValueAtTime(-6, S.ctx.currentTime);
      S.compressor.knee.setValueAtTime(12, S.ctx.currentTime);
      S.compressor.ratio.setValueAtTime(12, S.ctx.currentTime);
      S.compressor.attack.setValueAtTime(0.003, S.ctx.currentTime);
      S.compressor.release.setValueAtTime(0.25, S.ctx.currentTime);
      S.compressor.connect(S.ctx.destination);

      S.masterGain = S.ctx.createGain();
      S.masterGain.gain.setValueAtTime(S.isMuted ? 0.0001 : S.volume, S.ctx.currentTime);
      S.masterGain.connect(S.compressor);

      S.analyser = S.ctx.createAnalyser();
      S.analyser.fftSize = 64;
      S.analyser.smoothingTimeConstant = 0.8;
      S.analyser.connect(S.masterGain);
    } catch (err) {
      console.warn('[ClownAudio] Failed to initialize AudioContext:', err);
      S.ctx = null;
    }
    return S.ctx;
  }

  function makeNoiseSource(ctx) {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // cheap pink-ish tilt
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function startPatch(track) {
    const S = CH.state;
    const ctx = getAudioContext();
    if (!ctx || !track || !track.patch) return;
    stopPatch();

    const patchGain = ctx.createGain();
    patchGain.gain.setValueAtTime(1, ctx.currentTime);

    const p = track.patch;
    let filterNode = null;
    if (p.filter && typeof ctx.createBiquadFilter === 'function') {
      filterNode = ctx.createBiquadFilter();
      filterNode.type = p.filter.type || 'lowpass';
      filterNode.frequency.setValueAtTime(p.filter.freq || 1200, ctx.currentTime);
      filterNode.Q.setValueAtTime(p.filter.Q || 0.7, ctx.currentTime);
      patchGain.connect(filterNode);
      filterNode.connect(S.analyser);
      S.voices.push(filterNode);
    } else {
      patchGain.connect(S.analyser);
    }

    if (p.delay && typeof ctx.createDelay === 'function') {
      const delay = ctx.createDelay();
      delay.delayTime.setValueAtTime(p.delay.time, ctx.currentTime);
      const fb = ctx.createGain();
      fb.gain.setValueAtTime(p.delay.feedback, ctx.currentTime);
      const mix = ctx.createGain();
      mix.gain.setValueAtTime(p.delay.mix, ctx.currentTime);
      (filterNode || patchGain).connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(mix);
      mix.connect(S.analyser);
      S.voices.push(delay, fb, mix);
    }

    for (const v of p.voices || []) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, v.gain || 0.1), ctx.currentTime);
      g.connect(patchGain);
      let src;
      if (v.type === 'noise' && typeof ctx.createBufferSource === 'function') {
        src = makeNoiseSource(ctx);
      } else {
        src = ctx.createOscillator();
        src.type = v.type || 'sine';
        src.frequency.setValueAtTime(v.freq || 110, ctx.currentTime);
      }
      src.connect(g);
      try { src.start(); } catch (_) {}
      S.voices.push(src, g);
    }

    if (p.lfo) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(p.lfo.freq, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(p.lfo.depth, ctx.currentTime);
      lfo.connect(lfoGain);
      const target = (p.lfo.target === 'filter' && filterNode)
        ? filterNode.frequency
        : patchGain.gain;
      try {
        lfoGain.connect(target);
        lfo.start();
        S.voices.push(lfo, lfoGain);
      } catch (_) {}
    }

    S.patchGain = patchGain;
  }

  function stopPatch() {
    const S = CH.state;
    for (const node of S.voices) {
      try { if (typeof node.stop === 'function') node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    }
    S.voices = [];
    if (S.patchGain) {
      try { S.patchGain.disconnect(); } catch (_) {}
      S.patchGain = null;
    }
  }

  CH.getAudioContext = getAudioContext;
  CH.startPatch = startPatch;
  CH.stopPatch = stopPatch;
}(typeof globalThis !== 'undefined' ? globalThis : this));
