async function auditLayoutGeometry() {
  console.log('\n--- 4. Layout Geometry & Collision Audit (Chrome CDP: 320px to 2560px) ---');
  const { server, port } = await startStaticServer();
  const { chrome, wsUrl } = await launchHeadlessChrome();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');

  const testWidths = [320, 360, 375, 414, 600, 639, 640, 768, 800, 900, 1024, 1100, 1200, 1280, 1440, 1920, 2560];

  for (const width of testWidths) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    await new Promise(r => setTimeout(r, 200));

    const metrics = await cdp.eval(`
      (() => {
        const dock = document.getElementById('stage-select-dock');
        const pill = document.getElementById('floating-audio-pill');
        const playBtn = document.getElementById('audio-play-btn');
        const docEl = document.documentElement;

        if (!dock || !pill) return { error: 'Missing dock or pill' };

        const dockRect = dock.getBoundingClientRect();
        const pillRect = pill.getBoundingClientRect();
        const btnRect = playBtn ? playBtn.getBoundingClientRect() : null;

        const xOverlap = Math.max(0, Math.min(dockRect.right, pillRect.right) - Math.max(dockRect.left, pillRect.left));
        const yOverlap = Math.max(0, Math.min(dockRect.bottom, pillRect.bottom) - Math.max(dockRect.top, pillRect.top));
        const collides = (xOverlap > 0 && yOverlap > 0);

        let playBtnClickable = true;
        let occludingElement = null;
        if (btnRect) {
          const cx = btnRect.left + btnRect.width / 2;
          const cy = btnRect.top + btnRect.height / 2;
          const el = document.elementFromPoint(cx, cy);
          playBtnClickable = (el === playBtn || playBtn.contains(el));
          if (!playBtnClickable && el) {
            occludingElement = el.tagName + (el.className ? '.' + (typeof el.className === 'string' ? el.className.split(' ').join('.') : '') : '');
          }
        }

        return {
          width: window.innerWidth,
          collides,
          xOverlap,
          yOverlap,
          dock: { left: dockRect.left, top: dockRect.top, right: dockRect.right, bottom: dockRect.bottom, width: dockRect.width, height: dockRect.height },
          pill: { left: pillRect.left, top: pillRect.top, right: pillRect.right, bottom: pillRect.bottom, width: pillRect.width, height: pillRect.height },
          playBtnClickable,
          occludingElement,
          overflow: docEl.scrollWidth > window.innerWidth,
          scrollWidth: docEl.scrollWidth
        };
      })()
    `);

    // Verify no collision between dock and pill
    const collisionFree = !metrics.collides;
    const collisionDetails = metrics.collides
      ? `AABB Overlap: dx=${metrics.xOverlap.toFixed(1)}px, dy=${metrics.yOverlap.toFixed(1)}px | Dock: [${metrics.dock.left.toFixed(0)}..${metrics.dock.right.toFixed(0)}, Y:${metrics.dock.top.toFixed(0)}..${metrics.dock.bottom.toFixed(0)}] vs Pill: [${metrics.pill.left.toFixed(0)}..${metrics.pill.right.toFixed(0)}, Y:${metrics.pill.top.toFixed(0)}..${metrics.pill.bottom.toFixed(0)}]`
      : '';
    record(`Viewport ${width}px: Stage dock does NOT overlap floating audio pill`, collisionFree, collisionDetails);

    // Verify audio play button is not occluded / intercepted
    const btnClickable = metrics.playBtnClickable;
    const btnDetails = !btnClickable ? `Audio play button is occluded by ${metrics.occludingElement} at center point` : '';
    record(`Viewport ${width}px: Audio play button is unoccluded and clickable`, btnClickable, btnDetails);

    // Verify no viewport horizontal overflow
    const noOverflow = !metrics.overflow;
    const overflowDetails = metrics.overflow ? `document.documentElement.scrollWidth (${metrics.scrollWidth}px) > innerWidth (${metrics.width}px)` : '';
    record(`Viewport ${width}px: Zero horizontal viewport overflow`, noOverflow, overflowDetails);
  }

  cdp.close();
  chrome.kill();
  server.close();
}

async function main() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // CHALLENGER 2 ADVERSARIAL VERIFICATION REPORT');
  console.log('Milestone M1: Mega Man X Stage Dock Integrity, Layout & Invariants');
  console.log('================================================================');

  auditDomLinkIntegrity();
  auditCleanSlateNegative();
  auditAudioSfxHardening();
  await auditLayoutGeometry();

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

  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
