    // SECTION 4: MODAL / CONTEXT INTERACTION RESILIENCE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: MODAL INTERACTION & CONTEXT RESILIENCE');
    console.log('----------------------------------------------------------------');

    // Test 4.1: Command Palette open suppresses 'T', Escape closes and unblocks 'T'
    const modalCheck = await cdp.eval(`
      (async () => {
        window.ClownTheme.setTheme('tokyo-night');
        await new Promise(r => setTimeout(r, 50));

        // Open palette
        if (window.ClownPalette) window.ClownPalette.open();
        await new Promise(r => setTimeout(r, 50));

        // T should be suppressed
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const themeWhileOpen = window.ClownTheme.getCurrentTheme();

        // Escape closes
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));

        // T should now work
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        await new Promise(r => setTimeout(r, 200));
        const themeAfterClose = window.ClownTheme.getCurrentTheme();

        return {
          themeWhileOpen,
          themeAfterClose,
          pass: themeWhileOpen === 'tokyo-night' && themeAfterClose === 'catppuccin'
        };
      })()
    `);
    record('4.1 Palette open suppresses T shortcut; Escape closes palette and restores T shortcut', modalCheck.pass, `whileOpen=${modalCheck.themeWhileOpen}, afterClose=${modalCheck.themeAfterClose}`);

    console.log('\n================================================================');
    console.log(`EXTENDED SUITE TOTAL: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
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
    console.error('CRITICAL EXTENDED HARNESS RUNTIME ERROR:', err);
    process.exitCode = 2;
  } finally {
    if (cdp) try { cdp.close(); } catch (_) {}
    if (chromeInstance) try { chromeInstance.kill('SIGKILL'); } catch (_) {}
    if (chromeTmpDir) try { fs.rmSync(chromeTmpDir, { recursive: true, force: true }); } catch (_) {}
    if (server) try { server.close(); } catch (_) {}
  }
}

runExtendedStressVerification();
