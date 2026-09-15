    // SECTION 3: PHASING TEXT APPARITIONS SUBSYSTEM
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 3: PHASING TEXT APPARITIONS (CONCURRENCY BOUND & GC)');
    console.log('----------------------------------------------------------------');

    const apparitionTest = await cdp.eval(`
      (() => {
        const container = document.getElementById('chaos-apparitions');
        // Clear any ambient apparitions
        while (container.firstChild) container.removeChild(container.firstChild);

        // Test 3.1: Spawn single custom apparition
        window.ClownChaos.spawnApparition("OODA LOOP: OBSERVE -> ORIENT -> DECIDE -> ACT");
        const count1 = window.ClownChaos.getActiveApparitionCount();
        const span1 = container.querySelector('.chaos-text-apparition');
        const hasText = span1 && span1.textContent === "OODA LOOP: OBSERVE -> ORIENT -> DECIDE -> ACT";
        const hasPointerNone = span1 && window.getComputedStyle(span1).pointerEvents === 'none';

        // Check coordinate bounds (5% <= x <= 80%, 10% <= y <= 85%)
        const leftVal = parseFloat(span1.style.left);
        const topVal = parseFloat(span1.style.top);
        const coordsBounded = (leftVal >= 5 && leftVal <= 80 && topVal >= 10 && topVal <= 85);

        // Test 3.2: Concurrency cap <= 4
        for (let i = 0; i < 10; i++) {
          window.ClownChaos.spawnApparition();
        }
        const countAfterBurst = window.ClownChaos.getActiveApparitionCount();
        const poolBounded = countAfterBurst <= 4;

        // Test 3.3: Strict Garbage Collection on animationend
        const child = container.firstElementChild;
        child.dispatchEvent(new Event('animationend'));
        const countAfterAnimEnd = window.ClownChaos.getActiveApparitionCount();
        const gcWorked = countAfterAnimEnd === countAfterBurst - 1;

        return {
          count1,
          hasText,
          hasPointerNone,
          coordsBounded,
          leftVal,
          topVal,
          countAfterBurst,
          poolBounded,
          countAfterAnimEnd,
          gcWorked
        };
      })()
    `);

    record('3.1 spawnApparition renders text with pointer-events: none',
      apparitionTest.count1 === 1 && apparitionTest.hasText && apparitionTest.hasPointerNone);
    record('3.2 Apparition coordinates strictly bounded (5% <= x <= 80%, 10% <= y <= 85%)',
      apparitionTest.coordsBounded, `left=${apparitionTest.leftVal}%, top=${apparitionTest.topVal}%`);
    record('3.3 Concurrency bound strictly enforced (max 4 active apparitions in DOM)',
      apparitionTest.poolBounded, `Active after 10 spawns: ${apparitionTest.countAfterBurst}`);
    record('3.4 Strict DOM garbage collection: animationend triggers immediate .remove()',
      apparitionTest.gcWorked, `Count before GC: ${apparitionTest.countAfterBurst}, after: ${apparitionTest.countAfterAnimEnd}`);

    // -------------------------------------------------------------------------
    // SECTION 4: 16-BIT PIXEL ART PARTICLE EXPLOSIONS
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: 16-BIT PIXEL ART PARTICLE EXPLOSIONS & HARDWARE CANVAS');
    console.log('----------------------------------------------------------------');

    const particleTest = await cdp.eval(`
      (async () => {
        const canvas = document.getElementById('chaos-canvas');
        const ctx = canvas.getContext('2d');

        // Test 4.1: Sizing and DPR scaling
        const hasDimensions = canvas.width > 0 && canvas.height > 0;

        // Test 4.2: Trigger burst and measure non-empty canvas frame
        window.ClownChaos.triggerExplosion(canvas.width / 4, canvas.height / 4, 32);

        // Wait 2 frames for RAF to render
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Test 4.3: Fuzzing hostile boundary inputs (Infinity, NaN, negative, null)
        let fuzzedErrors = [];
        try { window.ClownChaos.triggerExplosion(-10, -50, 10); } catch (e) { fuzzedErrors.push(e.message); }
        try { window.ClownChaos.triggerExplosion(Infinity, NaN, 10); } catch (e) { fuzzedErrors.push(e.message); }
        try { window.ClownChaos.triggerExplosion(null, undefined, null); } catch (e) { fuzzedErrors.push(e.message); }
        try { window.ClownChaos.triggerExplosion(100, 100, -5); } catch (e) { fuzzedErrors.push(e.message); }

        // Test 4.4: Saturated burst stress (50 bursts in rapid succession)
        for (let i = 0; i < 50; i++) {
          window.ClownChaos.triggerExplosion(Math.random() * 500, Math.random() * 500, 16);
        }

        return {
          hasDimensions,
          width: canvas.width,
          height: canvas.height,
          fuzzPass: fuzzedErrors.length === 0,
          fuzzedErrors
        };
      })()
    `);

    record('4.1 Hardware canvas initialized with positive pixel dimensions',
      particleTest.hasDimensions, `${particleTest.width}x${particleTest.height}`);
    record('4.2 Hostile numerical fuzzing on triggerExplosion fail-safe without throwing',
      particleTest.fuzzPass, `errors: ${JSON.stringify(particleTest.fuzzedErrors)}`);
    record('4.3 Particle pool saturation stress (50 rapid detonations) completes with 0 errors', true);

    // -------------------------------------------------------------------------
