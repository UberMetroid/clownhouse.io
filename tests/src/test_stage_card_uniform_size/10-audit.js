async function runAudit() {
  console.log('================================================================');
  console.log('STAGE SELECT DOCK UNIFORM SIZE & MARQUEE AUDIT');
  console.log('================================================================\n');

  // 1. Static HTML Audit
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf-8');
  const scrollContainers = (html.match(/class="card-title-scroll"/g) || []).length;
  record('index.html contains 5 .card-title-scroll containers', scrollContainers === 5, `Found: ${scrollContainers}`);

  const glyphsCount = (html.match(/class="portrait-glyph"/g) || []).length;
  record('index.html contains 0 .portrait-glyph flavor icons', glyphsCount === 0, `Found: ${glyphsCount}`);
  const subTextCount = (html.match(/class="card-sub"/g) || []).length;
  record('index.html contains 0 .card-sub flavor text elements', subTextCount === 0, `Found: ${subTextCount}`);

  // 2. Static CSS Audit — style.css is an @import manifest over styles/
  const manifest = fs.readFileSync(path.join(PROJECT_ROOT, 'style.css'), 'utf-8');
  const css = manifest + [...manifest.matchAll(/@import url\("([^"]+)"\)/g)]
    .map(m => fs.readFileSync(path.join(PROJECT_ROOT, m[1]), 'utf-8')).join('\n');
  const hasFixedCardWidth = css.includes('width: 172px') && css.includes('flex: 0 0 172px');
  record('style.css defines uniform fixed width (172px) on .stage-card', hasFixedCardWidth);
  const hasMarqueeKeyframes = css.includes('@keyframes stageTitleMarquee');
  record('style.css defines @keyframes stageTitleMarquee', hasMarqueeKeyframes);

  // 3. Dynamic Headless Chrome Layout & Marquee Audit
  const { server, port } = await startStaticServer();
  const { chrome, wsUrl } = await launchHeadlessChrome();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');

  // Test at Desktop 1440px
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  await new Promise(r => setTimeout(r, 600));

  const desktopData = await cdp.eval(`
    (() => {
      const dock = document.getElementById('stage-select-dock');
      const cards = Array.from(document.querySelectorAll('.stage-card'));
      if (!dock || cards.length !== 5) return { error: 'Missing dock or cards' };

      const dockRect = dock.getBoundingClientRect();
      const cardRects = cards.map(c => {
        const r = c.getBoundingClientRect();
        const title = c.querySelector('.card-title');
        const scrollEl = c.querySelector('.card-title-scroll');
        const dist = title ? title.style.getPropertyValue('--scroll-distance') : '';
        const isMarquee = title ? title.classList.contains('marquee-title') : false;
        return {
          id: c.id,
          width: r.width,
          height: r.height,
          titleText: title ? title.textContent.trim() : '',
          dist,
          isMarquee
        };
      });

      return {
        dockWidth: dockRect.width,
        cardRects
      };
    })()
  `);

  const widths = desktopData.cardRects.map(c => c.width);
  const heights = desktopData.cardRects.map(c => c.height);

  const minWidth = Math.min(...widths);
  const maxWidth = Math.max(...widths);
  const widthDelta = maxWidth - minWidth;

  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const heightDelta = maxHeight - minHeight;

  record(
    'All 5 stage cards have identical width on desktop (delta <= 1px)',
    widthDelta <= 1,
    `Widths: ${JSON.stringify(widths)} (delta: ${widthDelta.toFixed(2)}px)`
  );

  record(
    'All 5 stage cards have identical height on desktop (delta <= 1px)',
    heightDelta <= 1,
    `Heights: ${JSON.stringify(heights)} (delta: ${heightDelta.toFixed(2)}px)`
  );

  record(
    'Total dock width is comfortable (< 960px)',
    desktopData.dockWidth < 960,
    `Dock width: ${desktopData.dockWidth.toFixed(1)}px`
  );

  // Check long titles have marquee active
  const giggleCard = desktopData.cardRects.find(c => c.id === 'dock-giggle');
  const reactleCard = desktopData.cardRects.find(c => c.id === 'dock-reactle');

  record(
    'giggle.clownhouse.io triggers marquee animation with negative scroll distance',
    giggleCard && giggleCard.isMarquee && giggleCard.dist.startsWith('-'),
    `isMarquee: ${giggleCard ? giggleCard.isMarquee : 'N/A'}, dist: ${giggleCard ? giggleCard.dist : 'N/A'}`
  );

  record(
    'reactle.clownhouse.io triggers marquee animation with negative scroll distance',
    reactleCard && reactleCard.isMarquee && reactleCard.dist.startsWith('-'),
    `isMarquee: ${reactleCard ? reactleCard.isMarquee : 'N/A'}, dist: ${reactleCard ? reactleCard.dist : 'N/A'}`
  );

  // Clean up
  cdp.close();
  chrome.kill();
  server.close();

  console.log('\n================================================================');
  console.log(`TOTAL AUDITED: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
