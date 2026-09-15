    // SECTION 4: RAPID HOVER SWEEPS ACROSS ALL 5 CARDS
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: RAPID HOVER SWEEPS ACROSS ALL 5 CARDS');
    console.log('----------------------------------------------------------------');

    // 4.1 Rapid hover sweep while audio uninitialized
    const uninitHoverTest = await cdp.eval(`
      (async () => {
        const cards = Array.from(document.querySelectorAll('.stage-card'));
        let errors = [];
        const errHandler = (e) => errors.push(e.message || String(e));
        window.addEventListener('error', errHandler);

        // Sweep back and forth across all 5 cards 20 times (200 mouseenter events)
        for (let round = 0; round < 20; round++) {
          for (let i = 0; i < cards.length; i++) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
          for (let i = cards.length - 1; i >= 0; i--) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
        }

        await new Promise(r => setTimeout(r, 50));
        window.removeEventListener('error', errHandler);

        return {
          cardsCount: cards.length,
          errors,
          pass: cards.length === 5 && errors.length === 0
        };
      })()
    `);
    record(
      '4.1 Rapid hover sweep (200 events) across all 5 cards with uninitialized audio yields 0 errors',
      uninitHoverTest.pass,
      `errors: ${JSON.stringify(uninitHoverTest.errors)}`
    );

    // 4.2 Rapid hover sweep while audio is initialized & unmuted
    const initHoverTest = await cdp.eval(`
      (async () => {
        const cards = Array.from(document.querySelectorAll('.stage-card'));
        let errors = [];
        const errHandler = (e) => errors.push(e.message || String(e));
        window.addEventListener('error', errHandler);

        // Initialize audio by toggling or calling play
        if (window.ClownAudio.getState().isMuted) {
          window.ClownAudio.toggleMute();
        }

        // Rapid sweep back and forth
        for (let round = 0; round < 20; round++) {
          for (let i = 0; i < cards.length; i++) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
          for (let i = cards.length - 1; i >= 0; i--) {
            cards[i].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
          }
        }

        await new Promise(r => setTimeout(r, 100));
        window.removeEventListener('error', errHandler);

        return {
          errors,
          pass: errors.length === 0
        };
      })()
    `);
    record(
      '4.2 Rapid hover sweep (200 events) across all 5 cards with active/unmuted audio yields 0 errors',
      initHoverTest.pass,
      `errors: ${JSON.stringify(initHoverTest.errors)}`
    );

    console.log('\n================================================================');
    console.log(`STRESS SUITE TOTAL: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.log('FINDINGS:');
      results.findings.forEach(f => console.log(`- ${f.name}: ${f.details}`));
      process.exitCode = 1;
    } else {
      console.log('VERDICT: APPROVE');
      process.exitCode = 0;
    }

  } catch (err) {
    console.error('CRITICAL HARNESS RUNTIME ERROR:', err);
    process.exitCode = 2;
  } finally {
    if (cdp) try { cdp.close(); } catch (_) {}
    if (chromeInstance) try { chromeInstance.kill('SIGKILL'); } catch (_) {}
    if (chromeTmpDir) try { fs.rmSync(chromeTmpDir, { recursive: true, force: true }); } catch (_) {}
    if (server) try { server.close(); } catch (_) {}
  }
}

runEmpiricalStressSuite();
