async function runTestSuite(runIndex) {
  console.log(`\n================================================================`);
  console.log(`CLOWNHOUSE.IO // Milestone M2 Procedural Web Audio Engine (Run ${runIndex})`);
  console.log(`================================================================\n`);

  const { sandbox, elements, eqBars } = createMockEnvironment();
  const audioCode = AUDIO_MODULE_PATHS
    .map(p => fs.readFileSync(p, 'utf8'))
    .join('\n');

  // Execute in isolated sandbox
  vm.runInContext(audioCode, sandbox);
  const audio = sandbox.window.ClownAudio;

  // 1. Interface Contract Verification
  console.log('--- 1. Window Contract Verification ---');
  assert(typeof audio === 'object' && audio !== null, 'window.ClownAudio is defined and exported');
  assert(typeof audio.play === 'function', 'audio.play is a function');
  assert(typeof audio.pause === 'function', 'audio.pause is a function');
  assert(typeof audio.togglePlay === 'function', 'audio.togglePlay is a function');
  assert(typeof audio.toggleMute === 'function', 'audio.toggleMute is a function');
  assert(typeof audio.setVolume === 'function', 'audio.setVolume is a function');
  assert(typeof audio.setTrack === 'function', 'audio.setTrack is a function');
  assert(typeof audio.nextTrack === 'function', 'audio.nextTrack is a function');
  assert(typeof audio.prevTrack === 'function', 'audio.prevTrack is a function');
  assert(typeof audio.getState === 'function', 'audio.getState is a function');
  assert(typeof audio.getFrequencyData === 'function', 'audio.getFrequencyData is a function');
  assert(Array.isArray(audio.TRACKS) && audio.TRACKS.length >= 1, 'audio.TRACKS contains valid tracks');

  // 2. Track Catalog Metadata Accuracy — 4 procedural LAB patches, zero binary assets
  console.log('\n--- 2. Track Catalog Metadata ---');
  const expectedIds = ['lab-01', 'lab-02', 'lab-03', 'lab-04'];
  assert(audio.TRACKS.length === 4, `TRACKS contains exactly 4 procedural modes (got ${audio.TRACKS.length})`);
  expectedIds.forEach((id, i) => {
    const t = audio.TRACKS[i];
    assert(t && t.id === id, `Track ${i} ID is "${id}"`);
    assert(t && typeof t.patch === 'object' && t.patch !== null, `Track ${i} carries a procedural patch descriptor`);
    assert(t && !('src' in t), `Track ${i} has no binary src (zero-asset contract)`);
    assert(t && !('art' in t), `Track ${i} has no binary art (zero-asset contract)`);
  });
  assert(audio.TRACKS[0].title === 'Carrier Drift', 'Track 0 title is "Carrier Drift"');
  assert(audio.TRACKS[1].title === 'Cybernetic Drone', 'Track 1 title is "Cybernetic Drone"');

  // 3. Volume Clamping & Numerical Boundary Fuzzing
  console.log('\n--- 3. Volume Boundary Clamping ---');
  audio.setVolume(0.5);
  assert(audio.getState().volume === 0.5, 'setVolume(0.5) sets volume to 0.5');

  audio.setVolume(-0.8);
  assert(audio.getState().volume === 0.0, 'setVolume(-0.8) clamps strictly to 0.0');

  audio.setVolume(2.4);
  assert(audio.getState().volume === 1.0, 'setVolume(2.4) clamps strictly to 1.0');

  audio.setVolume(NaN);
  assert(audio.getState().volume >= 0.0 && audio.getState().volume <= 1.0, 'setVolume(NaN) does not corrupt volume');

  audio.setVolume('invalid');
  assert(audio.getState().volume >= 0.0 && audio.getState().volume <= 1.0, 'setVolume(string) does not corrupt volume');

  audio.setVolume(0.7); // reset to comfortable level

  // 4. Track Navigation & Modulo Wrapping (4 LAB modes)
  console.log('\n--- 4. Track Navigation & Modulo Wrapping ---');
  audio.setTrack(0);
  assert(audio.getState().trackIndex === 0, 'setTrack(0) sets trackIndex to 0');

  audio.nextTrack();
  assert(audio.getState().trackIndex === 1, 'nextTrack() advances to 1 (LAB-02)');

  audio.setTrack(3);
  audio.nextTrack();
  assert(audio.getState().trackIndex === 0, 'nextTrack() wraps modulo cleanly from 3 to 0');

  audio.prevTrack();
  assert(audio.getState().trackIndex === 3, 'prevTrack() wraps modulo cleanly from 0 to 3');

  audio.setTrack(99);
  assert(audio.getState().trackIndex === 0, 'setTrack(99) out-of-bounds falls back to 0');

  // 5. Synthesis Lifecycle: Play, Pause, Mute
  console.log('\n--- 5. Synthesis Play / Pause / Mute Lifecycle ---');
  let state = audio.getState();
  assert(state.isPlaying === false, 'Initial state is paused (autoplay safe)');
  assert(state.isMuted === true, 'Initial state is muted (autoplay safe)');

  await audio.play();
  state = audio.getState();
  assert(state.isPlaying === true, 'audio.play() transitions isPlaying to true');
  assert(state.isMuted === false, 'audio.play() unmutes master channel');

  audio.pause();
  state = audio.getState();
  assert(state.isPlaying === false, 'audio.pause() transitions isPlaying to false');

  await audio.togglePlay();
  state = audio.getState();
  assert(state.isPlaying === true, 'audio.togglePlay() transitions back to playing');

  audio.toggleMute();
  state = audio.getState();
  assert(state.isMuted === true, 'audio.toggleMute() transitions isMuted to true');

  audio.toggleMute();
  state = audio.getState();
  assert(state.isMuted === false, 'audio.toggleMute() transitions isMuted back to false');

  // 6. Analyser Frequency Data Extraction & EQ Bars
  console.log('\n--- 6. AnalyserNode Frequency Extraction ---');
  const buffer = new Uint8Array(32);
  audio.getFrequencyData(buffer);
  assert(buffer[0] > 0, 'getFrequencyData writes non-zero frequency spectrum bytes');

  // Check UI synchronization
  assert(elements['audio-track-title'].textContent.length > 0, 'audio-track-title updated in DOM');
  assert(elements['audio-track-freq'].textContent.length > 0, 'audio-track-freq updated in DOM');

  // 7. Security & Prototype Pollution Immunity
  console.log('\n--- 7. Security & Prototype Pollution Immunity ---');
  const polluteAttacks = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
  polluteAttacks.forEach((attack) => {
    const res = audio.playSfx(attack);
    assert(res === false, `playSfx("${attack}") rejected fail-closed`);
  });

  audio.pause();
}

async function run() {
  await runTestSuite(1);
  const run1Failures = failedTests;

  // Run 2: Double-Run Verification Parity Law ($Run_1 == Run_2$)
  totalTests = 0;
  passedTests = 0;
  failedTests = 0;
  failures.length = 0;

  await runTestSuite(2);
  const run2Failures = failedTests;

  console.log('\n================================================================');
  console.log(`SUMMARY: Run 1 Failures: ${run1Failures} | Run 2 Failures: ${run2Failures}`);
  console.log(`Total Checks Executed Per Run: ${passedTests}`);
  console.log('================================================================\n');

  if (run1Failures === 0 && run2Failures === 0) {
    console.log('VERDICT: PASS (Double-Run Parity Verified)');
    process.exit(0);
  } else {
    console.error('VERDICT: FAIL (Assertion errors detected)');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(2);
});
