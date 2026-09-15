    // --- SECTION 4: Synchronous State, Meta Sync & CSS Transition Tokens ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 4: SYNCHRONOUS STATE, META COLOR SYNC & CSS TOKENS');
    console.log('----------------------------------------------------------------');

    const metaAndStorageCheck = await cdp.eval(`
      (() => {
        const THEME_META_COLORS = {
          'tokyo-night': '#1a1b26',
          'catppuccin': '#1e1e2e',
          'gruvbox': '#282828',
          'nord': '#2e3440',
          'rose-pine': '#faf4ed',
          'ethereal': '#060b1e',
          'vantablack': '#000000'
        };

        const checks = [];
        for (const [theme, expectedColor] of Object.entries(THEME_META_COLORS)) {
          window.ClownTheme.setTheme(theme);
          const current = window.ClownTheme.getCurrentTheme();
          const domAttr = document.documentElement.getAttribute('data-theme');
          const metaContent = document.querySelector('meta[name="theme-color"]').getAttribute('content');
          const stored = localStorage.getItem('theme');

          checks.push({
            theme,
            pass: current === theme && domAttr === theme && metaContent === expectedColor && stored === theme
          });
        }

        return {
          allPass: checks.every(c => c.pass),
          failedChecks: checks.filter(c => !c.pass)
        };
      })()
    `);
    record('4.1 Synchronous update across data-theme, meta theme-color, and localStorage for all 7 themes', metaAndStorageCheck.allPass, JSON.stringify(metaAndStorageCheck.failedChecks));

    // 4.2 Verify CSS custom property --transition-theme is 800ms cubic-bezier
    // style.css is an @import manifest over styles/ — resolve it fully
    const manifest = fs.readFileSync(path.join(PROJECT_ROOT, 'style.css'), 'utf8');
    const cssContent = manifest + [...manifest.matchAll(/@import url\("([^"]+)"\)/g)]
      .map(m => fs.readFileSync(path.join(PROJECT_ROOT, m[1]), 'utf8')).join('\n');
    const hasTransitionThemeVar = cssContent.includes('--transition-theme: 800ms cubic-bezier(0.16, 1, 0.3, 1);');
    record('4.2 style.css defines --transition-theme: 800ms cubic-bezier(0.16, 1, 0.3, 1);', hasTransitionThemeVar);

    // --- SECTION 5: Clean Slate Negative Audit ---
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 5: CLEAN SLATE NEGATIVE AUDIT (SOURCE CODE)');
    console.log('----------------------------------------------------------------');
    const FORBIDDEN_LEGACY = ['hunter-base', 'tower-of-power', 'chozo-visor', 'wrx-telemetry', 'pacific-outpost'];
    const htmlContent = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const audioJsContent = fs.readFileSync(path.join(PROJECT_ROOT, 'audio.js'), 'utf8');

    for (const forbidden of FORBIDDEN_LEGACY) {
      const notInHtml = !htmlContent.toLowerCase().includes(forbidden);
      const notInCss = !cssContent.toLowerCase().includes(forbidden);
      const notInApp = !appJsContent.toLowerCase().includes(forbidden);
      const notInAudio = !audioJsContent.toLowerCase().includes(forbidden);
      record(`5.x Zero occurrences of "${forbidden}" across core source files`, notInHtml && notInCss && notInApp && notInAudio);
    }

    console.log('\n================================================================');
    console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log('================================================================\n');

    if (results.failed > 0) {
      console.error('FINDINGS:');
      results.findings.forEach(f => console.error(`- ${f.name}: ${f.details}`));
      process.exitCode = 1;
    } else {
      console.log('EXPLICIT VERDICT: APPROVE (ALL M3 DUAL-TRIGGER THEME RANDOMIZER REQUIREMENTS VERIFIED)');
      process.exitCode = 0;
    }

  } catch (err) {
    console.error('CRITICAL RUNTIME ERROR:', err);
    process.exitCode = 2;
  } finally {
    if (cdp) try { cdp.close(); } catch (_) {}
    if (chromeData && chromeData.chrome) try { chromeData.chrome.kill('SIGKILL'); } catch (_) {}
    if (chromeData && chromeData.tmpDir) try { fs.rmSync(chromeData.tmpDir, { recursive: true, force: true }); } catch (_) {}
    if (serverObj && serverObj.server) try { serverObj.server.close(); } catch (_) {}
  }
}

runTestSuite();
