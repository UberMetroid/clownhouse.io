    // SECTION 8: CLEAN SLATE FORBIDDEN TOKEN AUDIT
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 8: CLEAN SLATE NEGATIVE AUDIT (SOURCE CODE)');
    console.log('----------------------------------------------------------------');

    const forbidden = ['hunter-base', 'tower-of-power', 'chozo-visor', 'wrx-telemetry', 'pacific-outpost'];
    const filesToAudit = ['index.html', 'style.css', 'app.js', 'audio.js'];

    for (const f of filesToAudit) {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8').toLowerCase();
      for (const token of forbidden) {
        const found = content.includes(token);
        record(`8.x Zero occurrences of "${token}" in ${f}`, !found, found ? `Found "${token}" in ${f}` : '');
      }
    }

    console.log('\n================================================================');
    console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
    console.log(`EXPLICIT VERDICT: ${verdict}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.log('CRITICAL FINDINGS REQUIRING REMEDIATION:');
      for (const f of results.findings) {
        console.log(` - ${f.name}`);
        if (f.details) console.log(`   ${f.details}`);
      }
    }

    process.exitCode = results.failed === 0 ? 0 : 1;

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

runM2ChaosEngineSuite();
