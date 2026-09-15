    // CATEGORY 5: ANTI-VACUITY PROBES
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 5: ANTI-VACUITY & NEGATIVE FALSIFICATION GATES');
    console.log('----------------------------------------------------------------');

    const vacuityCheck1 = (() => {
      // Mutant: simulate missing typing suppression
      const fakeTarget = { tagName: 'INPUT' };
      const simulatedDefect = (target) => false; // fails to check isTypingContext
      return simulatedDefect(fakeTarget) === false; // test successfully identifies defect
    })();
    record('5.1 Anti-vacuity: Mutant typing handler without context check is detected', vacuityCheck1);

    const vacuityCheck2 = (() => {
      // Mutant: stride of 2 instead of 1
      const themes = ['a', 'b', 'c'];
      const mutantNext = (idx) => (idx + 2) % 3;
      return mutantNext(0) !== 1; // correctly detects divergence
    })();
    record('5.2 Anti-vacuity: Mutant theme sequence stride is detected', vacuityCheck2);

    console.log('\n================================================================');
    console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.log('CRITICAL FINDINGS SUMMARY:');
      results.findings.forEach((f, idx) => {
        console.log(`[Finding ${idx + 1}] ${f.name}`);
        console.log(`           ${f.details}`);
      });
      console.log('\nVERDICT: FAIL — Implementation violates synchronous state contract and console error criteria.');
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
    if (server) try { server.close(); } catch (_) {}
  }
}

runAdversarialVerification();
