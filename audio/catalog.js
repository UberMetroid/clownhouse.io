/**
 * CLOWNHOUSE.IO // AUDIO TRACK CATALOG
 * Four procedural frequency modes. Zero binary audio assets —
 * every track is a declarative Web Audio patch built at runtime.
 */
(function (root) {
  'use strict';
  const CH = root.__clownaudio = root.__clownaudio || {};

  CH.TRACKS = Object.freeze([
    {
      id: 'lab-01',
      title: 'Carrier Drift',
      artist: 'LAB-01',
      freq: '55Hz Sub · 432Hz Carrier',
      desc: 'Binaural carrier wave — sub-bass fundamental under a 432Hz overtone pair',
      patch: {
        voices: [
          { type: 'sine', freq: 55, gain: 0.42 },
          { type: 'sine', freq: 432, gain: 0.05 },
          { type: 'sine', freq: 434.5, gain: 0.04 }
        ],
        filter: { type: 'lowpass', freq: 1600, Q: 0.5 },
        lfo: { freq: 0.08, depth: 0.3 }
      }
    },
    {
      id: 'lab-02',
      title: 'Cybernetic Drone',
      artist: 'LAB-02',
      freq: '110Hz Drone · Modulated Filter',
      desc: 'Sawtooth drone through a slowly sweeping lowpass gate',
      patch: {
        voices: [
          { type: 'sawtooth', freq: 110, gain: 0.16 },
          { type: 'sawtooth', freq: 110.7, gain: 0.10 },
          { type: 'sine', freq: 220, gain: 0.05 }
        ],
        filter: { type: 'lowpass', freq: 700, Q: 4 },
        lfo: { freq: 0.15, depth: 420, target: 'filter' }
      }
    },
    {
      id: 'lab-03',
      title: 'Necrometer 528Hz',
      artist: 'LAB-03',
      freq: '528Hz · Pulse Sweep',
      desc: '528Hz solfeggio tone through a quarter-second feedback delay',
      patch: {
        voices: [
          { type: 'sine', freq: 528, gain: 0.09 },
          { type: 'sine', freq: 264, gain: 0.06 },
          { type: 'triangle', freq: 132, gain: 0.05 }
        ],
        filter: { type: 'lowpass', freq: 2400, Q: 0.8 },
        lfo: { freq: 0.4, depth: 0.5 },
        delay: { time: 0.25, feedback: 0.35, mix: 0.28 }
      }
    },
    {
      id: 'lab-04',
      title: 'Velvet Frequency',
      artist: 'LAB-04',
      freq: '63Hz Bass · Noise Wash',
      desc: 'Warm 63Hz bass under a filtered noise wash — analog floor hum',
      patch: {
        voices: [
          { type: 'sine', freq: 63, gain: 0.38 },
          { type: 'sine', freq: 126.5, gain: 0.10 },
          { type: 'noise', gain: 0.05 }
        ],
        filter: { type: 'lowpass', freq: 480, Q: 0.6 },
        lfo: { freq: 0.05, depth: 0.35 }
      }
    }
  ]);
}(typeof globalThis !== 'undefined' ? globalThis : this));
