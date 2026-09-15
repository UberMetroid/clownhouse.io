    // SECTION 1: DUPLICATE EVENT BINDING & RE-TRIGGERING INVESTIGATION
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('SECTION 1: EVENT LISTENER INVARIANTS & DUPLICATE DISPATCH PROBES');
    console.log('----------------------------------------------------------------');

    // Test 1.1: Measure duplicate sound synthesis on hover (Oscillator count)
    const hoverOscTest = await cdp.eval(`
      (async () => {
        let oscCount = 0;
        const origCreateOsc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
          oscCount++;
          return origCreateOsc.apply(this, arguments);
        };

        // Ensure audio context is created
        if (window.ClownAudio.getState().isMuted) {
          window.ClownAudio.toggleMute();
        }

        const card = document.querySelector('.stage-card');
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));

        await new Promise(r => setTimeout(r, 20));
        AudioContext.prototype.createOscillator = origCreateOsc;

        return {
          oscCount,
          pass: oscCount === 1 // Hover SFX is a single oscillator (800Hz -> 1400Hz)
        };
      })()
    `);
    record(
      '1.1 Single stage card mouseenter creates exactly 1 oscillator (no duplicate synthesis)',
      hoverOscTest.pass,
      `Actual oscillators created: ${hoverOscTest.oscCount} (expected 1, got ${hoverOscTest.oscCount} due to dual listener in audio.js + app.js)`
    );

    // Test 1.2: Measure duplicate sound synthesis on click (Oscillator count)
    const clickOscTest = await cdp.eval(`
      (async () => {
        let oscCount = 0;
        const origCreateOsc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
          oscCount++;
          return origCreateOsc.apply(this, arguments);
        };

        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => e.preventDefault();
        card.addEventListener('click', clickWatcher);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        await new Promise(r => setTimeout(r, 20));
        card.removeEventListener('click', clickWatcher);
        AudioContext.prototype.createOscillator = origCreateOsc;

        return {
          oscCount,
          pass: oscCount === 2 // Select SFX is a two-tone chime (1200Hz + 1800Hz) = 2 oscillators
        };
      })()
    `);
    record(
      '1.2 Single stage card click creates exactly 2 oscillators (no duplicate synthesis)',
      clickOscTest.pass,
      `Actual oscillators created: ${clickOscTest.oscCount} (expected 2, got ${clickOscTest.oscCount} due to dual listener in audio.js + app.js)`
    );

    // Test 1.3: Single Space Keydown on Stage Card must trigger at most ONE click event
    const spaceKeyTest = await cdp.eval(`
      (() => {
        let clickEventsFired = 0;
        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => {
          clickEventsFired++;
          e.preventDefault(); // Prevent real navigation in test
        };
        card.addEventListener('click', clickWatcher);

        // Dispatch single Space keydown
        card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));

        card.removeEventListener('click', clickWatcher);

        return {
          clickEventsFired,
          pass: clickEventsFired === 1
        };
      })()
    `);
    record(
      '1.3 Single Space keydown on stage card dispatches exactly 1 click event (no duplicate click execution)',
      spaceKeyTest.pass,
      `Actual click events fired: ${spaceKeyTest.clickEventsFired} (expected 1)`
    );

    // Test 1.4: Single Space Keydown on Stage Card creates at most 2 oscillators
    const spaceOscTest = await cdp.eval(`
      (async () => {
        let oscCount = 0;
        const origCreateOsc = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
          oscCount++;
          return origCreateOsc.apply(this, arguments);
        };

        const card = document.querySelector('.stage-card');
        const clickWatcher = (e) => e.preventDefault();
        card.addEventListener('click', clickWatcher);

        card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));

        await new Promise(r => setTimeout(r, 20));
        card.removeEventListener('click', clickWatcher);
        AudioContext.prototype.createOscillator = origCreateOsc;

        return {
          oscCount,
          pass: oscCount <= 2
        };
      })()
    `);
    record(
      '1.4 Single Space keydown on stage card creates at most 2 oscillators',
      spaceOscTest.pass,
      `Actual oscillators created: ${spaceOscTest.oscCount} (expected <= 2, got ${spaceOscTest.oscCount})`
    );


    // =========================================================================
