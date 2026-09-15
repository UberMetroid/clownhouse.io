    // SECTION 5: SCI-FI ANAMORPHIC LENS FLARES
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 5: SCI-FI ANAMORPHIC LENS FLARES & CLICK TRANSPARENCY');
    console.log('----------------------------------------------------------------');

    const flareTest = await cdp.eval(`
      (() => {
        const flares = document.getElementById('chaos-flares');
        const streak = flares.querySelector('.chaos-flare-streak');
        const glint = flares.querySelector('.chaos-flare-glint');
        const aura = flares.querySelector('.chaos-flare-aura');

        const elementsExist = streak !== null && glint !== null && aura !== null;

        const streakStyle = streak ? window.getComputedStyle(streak) : {};
        const glintStyle = glint ? window.getComputedStyle(glint) : {};
        const auraStyle = aura ? window.getComputedStyle(aura) : {};

        // Verify click transparency via elementFromPoint
        const playBtn = document.getElementById('audio-play-btn');
        const btnRect = playBtn.getBoundingClientRect();
        const hitEl = document.elementFromPoint(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2);
        const clicksPassThrough = (hitEl === playBtn || playBtn.contains(hitEl));

        return {
          elementsExist,
          streakPointer: streakStyle.pointerEvents,
          glintPointer: glintStyle.pointerEvents,
          auraPointer: auraStyle.pointerEvents,
          clicksPassThrough,
          hitElement: hitEl ? hitEl.tagName + (hitEl.id ? '#' + hitEl.id : '') : null
        };
      })()
    `);

    record('5.1 Anamorphic flare layers (.chaos-flare-streak, .chaos-flare-glint, .chaos-flare-aura) initialized',
      flareTest.elementsExist);
    record('5.2 Flare layers strictly enforce pointer-events: none',
      flareTest.streakPointer === 'none' && flareTest.glintPointer === 'none' && flareTest.auraPointer === 'none',
      `streak=${flareTest.streakPointer}, glint=${flareTest.glintPointer}, aura=${flareTest.auraPointer}`
    );
    record('5.3 Optical flares do not occlude interactive controls (elementFromPoint passes through)',
      flareTest.clicksPassThrough, `Hit: ${flareTest.hitElement}`);

    // -------------------------------------------------------------------------
    // SECTION 6: ACCESSIBILITY & REDUCED MOTION
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 6: ACCESSIBILITY & PREFERS-REDUCED-MOTION SUPPORT');
    console.log('----------------------------------------------------------------');

    const reducedMotionTest = await cdp.eval(`
      (() => {
        // Enable reduced motion
        window.ClownChaos.setReducedMotion(true);

        // Attempt to spawn apparition while reduced motion is enabled
        window.ClownChaos.spawnApparition("SHOULD NOT SPAWN");
        const countDuringReduced = window.ClownChaos.getActiveApparitionCount();

        // Restore normal motion
        window.ClownChaos.setReducedMotion(false);

        return {
          countDuringReduced,
          suppressed: countDuringReduced === 0
        };
      })()
    `);

    record('6.1 setReducedMotion(true) suppresses apparitions and clears dynamics',
      reducedMotionTest.suppressed, `Count during reduced: ${reducedMotionTest.countDuringReduced}`);

    // -------------------------------------------------------------------------
    // SECTION 7: LIFECYCLE MANAGEMENT & TEARDOWN (destroy)
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 7: LIFECYCLE MANAGEMENT & CLEAN DESTROY');
    console.log('----------------------------------------------------------------');

    const lifecycleTest = await cdp.eval(`
      (() => {
        // Spawn an apparition first
        window.ClownChaos.spawnApparition();
        const countBefore = window.ClownChaos.getActiveApparitionCount();

        // Call destroy
        window.ClownChaos.destroy();
        const countAfter = window.ClownChaos.getActiveApparitionCount();

        return {
          countBefore,
          countAfter,
          cleanedUp: countAfter === 0
        };
      })()
    `);

    record('7.1 window.ClownChaos.destroy() removes apparitions and stops loop',
      lifecycleTest.cleanedUp, `Before: ${lifecycleTest.countBefore}, After: ${lifecycleTest.countAfter}`);

    // -------------------------------------------------------------------------
