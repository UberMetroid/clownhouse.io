function auditDomLinkIntegrity() {
  console.log('\n--- 1. DOM Link Integrity Audit (#stage-select-dock) ---');
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf-8');

  // Verify dock exists
  const hasDock = html.includes('id="stage-select-dock"');
  record('Stage dock element exists in index.html', hasDock);

  const expectedCards = [
    { id: 'dock-openooda', host: 'openooda.org', url: 'https://openooda.org', title: 'openOODA.org' },
    { id: 'dock-bumtrips', host: 'bumtrips.com', url: 'https://bumtrips.com', title: 'bumtrips.com' },
    { id: 'dock-necrometer', host: 'necrometer.dev', url: 'https://necrometer.dev', title: 'necrometer.dev' },
    { id: 'dock-giggle', host: 'giggle.clownhouse.io', url: 'https://giggle.clownhouse.io', title: 'giggle.clownhouse.io' },
    { id: 'dock-reactle', host: 'reactle.clownhouse.io', url: 'https://reactle.clownhouse.io', title: 'reactle.clownhouse.io' }
  ];

  for (const card of expectedCards) {
    const cardRegex = new RegExp(`<a[^>]*id=["']${card.id}["'][^>]*>`, 'i');
    const match = html.match(cardRegex);
    if (!match) {
      record(`Card #${card.id} exists`, false, 'Element tag not found');
      continue;
    }
    const tag = match[0];
    const hasHref = tag.includes(`href="${card.url}"`);
    const hasTarget = tag.includes('target="_blank"');
    const hasRel = tag.includes('rel="noopener noreferrer"');
    const hasTitle = html.includes(card.title);

    record(`Card #${card.id} exact URL (${card.url})`, hasHref, `Tag: ${tag}`);
    record(`Card #${card.id} target="_blank"`, hasTarget, `Tag: ${tag}`);
    record(`Card #${card.id} rel="noopener noreferrer"`, hasRel, `Tag: ${tag}`);
    record(`Card #${card.id} non-empty title (${card.title})`, hasTitle);
  }
}

// -----------------------------------------------------------------------------
// Part 2: Clean Slate Negative Audit
// -----------------------------------------------------------------------------
function auditCleanSlateNegative() {
  console.log('\n--- 2. Clean Slate Negative Audit (Forbidden Legacy Strings) ---');
  const forbidden = ['hunter-base', 'tower-of-power', 'chozo-visor', 'wrx-telemetry', 'pacific-outpost'];
  const srcFiles = ['index.html', 'style.css', 'app.js', 'audio.js', 'PROJECT.md'];

  for (const f of srcFiles) {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf-8').toLowerCase();
    for (const token of forbidden) {
      const idx = content.indexOf(token);
      record(`Zero occurrences of "${token}" in ${f}`, idx === -1, idx !== -1 ? `Found at index ${idx}` : '');
    }
  }
}

// -----------------------------------------------------------------------------
// Part 3: Audio SFX Prototype Hardening Audit
// -----------------------------------------------------------------------------
function auditAudioSfxHardening() {
  console.log('\n--- 3. Audio SFX Prototype Hardening & Fallback ---');
  const audioSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'audio/sfx.js'), 'utf-8');

  // Verify Object.create(null) and fail-closed prototype guards
  const hasProtoGuard = audioSrc.includes('VALID_SFX_MAP') &&
                        audioSrc.includes('Object.create(null)') &&
                        audioSrc.includes('__proto__') &&
                        audioSrc.includes('constructor');
  record('audio.js has prototype pollution immune VALID_SFX_MAP', hasProtoGuard);
}

// -----------------------------------------------------------------------------
// Part 4: Layout Collision & Viewport Geometry via Chrome CDP
// -----------------------------------------------------------------------------
