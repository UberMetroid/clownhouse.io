# Project: clownhouse.io Multi-Concept Theme Showcase

## Architecture
The application is a zero-dependency static web application delivered via GitHub Pages and proxied through Cloudflare edge. It implements a multi-container DOM architecture with a persistent top switcher bar and five modular bespoke theme containers:

1. **Persistent Switcher Bar (`#theme-switcher-bar`)**:
   - Always visible, docked at the top of the viewport.
   - Provides instant 1-click theme switching across all 5 themes without page reload.
   - Includes master audio mute/unmute toggle and visual status indicators.
   - Manages single source of truth in `localStorage` (`clownhouse_theme`) with fail-closed fallback for restricted/corrupted storage.
   - Updates `data-theme` attribute on `document.documentElement` to drive theme-scoped CSS variables.

2. **Five Bespoke Theme Enclosures**:
   - `#theme-tower-of-power`: Sega Genesis Model 1 + Sega CD + 32X hardware stack, ribbed ventilation grilles, physical cartridge slot links, interactive volume slider widget.
   - `#theme-chozo-visor`: Metroid holographic combat HUD, Hawaiian volcanic basalt textures, pulsing geothermal magma lines, energy tanks (E-tanks), targeting reticles, scannable HUD link nodes.
   - `#theme-wrx-telemetry`: World Rally Blue, Brembo red, carbon weave dashboard, dynamic digital turbo boost gauge, sequential shift lights, rally waypoint telemetry links.
   - `#theme-hunter-base`: Mega Man X 16-bit futuristic anime tech, 3x3 stage select mission grid with universal link boss icons, segmented 28-tick health bars, interactive X-Buster charge animations.
   - `#theme-pacific-outpost`: Tactical fusion of Hawaiian volcanic ridge outpost, Chozo alien technology, WRX rally instrument gauges, and nostalgic 16-bit console hardware.

3. **Client-Side Procedural Web Audio API Engine**:
   - Zero external MP3/WAV audio assets; 100% synthesized in-browser.
   - Multi-operator FM synthesis, subtractive filtered noise, and ADSR gain envelopes.
   - Discrete acoustic profiles per theme (Genesis FM slap bass/chimes, Metroid scanner harmonics, WRX turbo spool & blow-off valve, MMX Buster charge & stage select beeps, Pacific Outpost sonar/geothermal rumble).
   - Muted by default; unmuting unlocks browser `AudioContext` gracefully on user gesture.

4. **Universal Link Matrix**:
   - Every theme layout embeds all 6 required destinations:
     1. `https://openooda.org` (openOODA.org)
     2. `https://necrometer.dev` (necrometer.dev)
     3. `https://bumtrips.com` (bumtrips.com)
     4. `https://reactle.clownhouse.io` (Reactle cluster service)
     5. `https://giggle.clownhouse.io` (Giggle cluster service)
     6. `mailto:jeryd@clownhouse.io` (Direct contact)
   - Proper attributes: `target="_blank" rel="noopener noreferrer"` for web links; native mailto handling.
   - Theme-specific hover/focus visual feedback and procedural audio cues.

5. **Performance & Deployment**:
   - 60fps animations utilizing GPU-accelerated CSS transforms (`translate3d`) and opacity.
   - Zero console errors; verified syntax via `node --check`.
   - Git push to `studio2201/clownhouse.io` branch `main`, automated GitHub Pages deployment, Cloudflare edge cache verification, and SSL validation via `curl -sI https://clownhouse.io`.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F01_SWITCHER_BAR | Persistent top switcher bar for 1-click theme switching | M1 | ORIGINAL_REQUEST §R2 |
| 2 | F02_NO_RELOAD_SWAP | Real-time hot-swapping of DOM/CSS without page reload | M1 | ORIGINAL_REQUEST §R2 |
| 3 | F03_STORAGE_PERSIST | Persistent theme selection in `localStorage` | M1 | ORIGINAL_REQUEST §R2 |
| 4 | F04_STORAGE_FAILSAFE | Fail-closed graceful fallback on corrupted/blocked storage | M1 | Mined E01 |
| 5 | F05_THEME_CONTAINERS | 5 distinct DOM layout containers toggled dynamically | M1 | ORIGINAL_REQUEST §R1 |
| 6 | F06_AUDIO_ENGINE_INIT | Client-side Web Audio API context with user unlock | M2 | ORIGINAL_REQUEST §R4 |
| 7 | F07_AUDIO_MUTE_TOGGLE | Accessible sound toggle, muted by default | M2 | ORIGINAL_REQUEST §R4 |
| 8 | F08_AUDIO_FM_SYNTH | Multi-operator FM synthesis for 16-bit console chimes | M2 | ORIGINAL_REQUEST §R1, R4 |
| 9 | F09_AUDIO_NOISE_GEN | Procedural white/pink noise buffer with biquad filtering | M2 | Explorer Survey 2 |
| 10 | F10_AUDIO_TOP_SOUNDS | Tower of Power FM chimes and cartridge click sounds | M2 | ORIGINAL_REQUEST §R1 |
| 11 | F11_AUDIO_CHOZO_SOUNDS | Chozo Scan Visor harmonic HUD chimes and magma drone | M2 | ORIGINAL_REQUEST §R1 |
| 12 | F12_AUDIO_WRX_SOUNDS | WRX turbo spool, shift beeps, and blow-off valve pop | M2 | ORIGINAL_REQUEST §R1 |
| 13 | F13_AUDIO_MMX_SOUNDS | Hunter Base stage select clicks and Buster charge sweep | M2 | ORIGINAL_REQUEST §R1 |
| 14 | F14_AUDIO_PACIFIC_SOUNDS | Pacific Outpost tactical sonar ping and geothermal rumble | M2 | ORIGINAL_REQUEST §R1 |
| 15 | F15_TOP_GENESIS_CASE | Sega Genesis Model 1 + Sega CD + 32X aesthetic shell | M3 | ORIGINAL_REQUEST §R1 |
| 16 | F16_TOP_RIBBED_VENTS | Chunky ribbed ventilation grilles styling | M3 | ORIGINAL_REQUEST §R1 |
| 17 | F17_TOP_CARTRIDGE_LINKS | Physical cartridge slot links for universal destinations | M3 | ORIGINAL_REQUEST §R1 |
| 18 | F18_TOP_VOLUME_SLIDER | Interactive volume slider widget controlling audio gain | M3 | ORIGINAL_REQUEST §R1 |
| 19 | F19_CHOZO_HUD_FRAME | Metroid holographic combat HUD visor frame | M3 | ORIGINAL_REQUEST §R1 |
| 20 | F20_CHOZO_BASALT_MAGMA | Hawaiian volcanic basalt with pulsing geothermal magma | M3 | ORIGINAL_REQUEST §R1 |
| 21 | F21_CHOZO_ETANKS | Segmented Energy Tanks (E-tanks) display | M3 | ORIGINAL_REQUEST §R1 |
| 22 | F22_CHOZO_RETICLES | Animated targeting reticles and scanning crosshairs | M3 | ORIGINAL_REQUEST §R1 |
| 23 | F23_CHOZO_SCANNABLE_LINKS | Scannable HUD target nodes for universal destinations | M3 | ORIGINAL_REQUEST §R1 |
| 24 | F24_WRX_DASHBOARD | World Rally Blue, Brembo red, carbon weave dashboard | M3 | ORIGINAL_REQUEST §R1 |
| 25 | F25_WRX_TURBO_GAUGE | Dynamic digital/SVG turbo boost gauge (-1.0 to +1.8 bar) | M3 | ORIGINAL_REQUEST §R1 |
| 26 | F26_WRX_SHIFT_LIGHTS | Sequential RPM shift lights (green -> yellow -> red) | M3 | ORIGINAL_REQUEST §R1 |
| 27 | F27_WRX_PACE_NOTES | Mechanical rally telemetry stage notes for links | M3 | ORIGINAL_REQUEST §R1 |
| 28 | F28_MMX_TECH_AESTHETIC | Mega Man X 16-bit futuristic anime tech aesthetic | M3 | ORIGINAL_REQUEST §R1 |
| 29 | F29_MMX_STAGE_GRID | 3x3 stage select mission grid for universal links | M3 | ORIGINAL_REQUEST §R1 |
| 30 | F30_MMX_HEALTH_BARS | Segmented 28-tick energy health bars with tick marks | M3 | ORIGINAL_REQUEST §R1 |
| 31 | F31_MMX_BUSTER_CHARGE | Interactive X-Buster charging animation | M3 | ORIGINAL_REQUEST §R1 |
| 32 | F32_PACIFIC_HYBRID_FUSION | Cohesive fusion of volcanic ridge, Chozo, WRX, & 16-bit | M3 | ORIGINAL_REQUEST §R1 |
| 33 | F33_PACIFIC_COMMS_LINKS | Tactical communications array for universal links | M3 | ORIGINAL_REQUEST §R1 |
| 34 | F34_LINK_OPENOODA | Universal link to https://openooda.org in all 5 themes | M3 | ORIGINAL_REQUEST §R3 |
| 35 | F35_LINK_NECROMETER | Universal link to https://necrometer.dev in all 5 themes | M3 | ORIGINAL_REQUEST §R3 |
| 36 | F36_LINK_BUMTRIPS | Universal link to https://bumtrips.com in all 5 themes | M3 | ORIGINAL_REQUEST §R3 |
| 37 | F37_LINK_REACTLE | Universal link to https://reactle.clownhouse.io | M3 | ORIGINAL_REQUEST §R3 |
| 38 | F38_LINK_GIGGLE | Universal link to https://giggle.clownhouse.io | M3 | ORIGINAL_REQUEST §R3 |
| 39 | F39_LINK_MAILTO | Universal link to mailto:jeryd@clownhouse.io | M3 | ORIGINAL_REQUEST §R3 |
| 40 | F40_LINK_INTERACTIONS | Theme-specific visual feedback and audio cues on hover/click | M3 | ORIGINAL_REQUEST §R3 |
| 41 | F41_RESPONSIVE_60FPS | 60fps GPU transforms and responsive mobile/tablet/desktop | M3 | ORIGINAL_REQUEST §R4 |
| 42 | F42_SYNTAX_ZERO_ERRORS | Zero JavaScript console errors; node --check syntax pass | M3 | ORIGINAL_REQUEST §R4 |
| 43 | F43_E2E_TEST_SUITE | 100% pass on comprehensive E2E test suite (Tiers 1-4) | M4 | ORIGINAL_REQUEST §Acceptance |
| 44 | F44_ADVERSARIAL_HARDENING | Tier 5 white-box adversarial test coverage hardening | M4 | Project Pattern §Dual Track |
| 45 | F45_GIT_DEPLOYMENT | Commit and push to studio2201/clownhouse.io main | M5 | ORIGINAL_REQUEST §R5 |
| 46 | F46_PAGES_VERIFICATION | Automated GitHub Pages build & deployment verification | M5 | ORIGINAL_REQUEST §R5 |
| 47 | F47_CLOUDFLARE_EDGE | Verify curl -sI https://clownhouse.io HTTP/2 200 via Cloudflare | M5 | ORIGINAL_REQUEST §R5 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Independent test suite: runner, test cases (Tiers 1-4), TEST_READY.md | none | DONE |
| M1 | Core Shell & Dynamic Switcher | Switcher bar, layout containers, localStorage state persistence, hot-swapping | none | DONE |
| M2 | Procedural Web Audio Engine | Web Audio FM synthesis, noise generation, per-theme audio profiles, mute toggle | M1 interface | DONE |
| M3 | 5 Bespoke Themes & Links | 5 theme layouts, bespoke widgets (cartridges, visor, gauges, grid, outpost), 6 universal links | M1, M2 | DONE |
| M4 | Final Milestone (E2E & Hardening) | Pass 100% of E2E tests (Tiers 1-4) and Adversarial Coverage Hardening (Tier 5) | M3, E2E | DONE |
| M5 | Deployment & Edge Verification | Git commit/push, GitHub Pages verification, Cloudflare edge cache & SSL check | M4 | IN_PROGRESS |

---

## Interface Contracts

### Switcher Bar ↔ Theme Containers
- Switcher sets `data-theme` attribute on `document.documentElement` (`"tower-of-power"`, `"chozo-visor"`, `"wrx-telemetry"`, `"hunter-base"`, `"pacific-outpost"`).
- Only the active theme container (`.theme-container[data-theme="..."]`) is displayed (`display: block` / `grid` / `flex`); others are hidden (`display: none`).
- Switcher dispatches a CustomEvent `themechange` with detail `{ theme: newTheme, previousTheme: oldTheme }`.

### Theme State ↔ Audio Engine
- Audio engine exposes an interface:
  ```javascript
  window.ClownAudio = {
    setTheme(themeName),
    setVolume(volumeFraction),
    toggleMute(),
    playSfx(sfxType), // 'switch', 'hover', 'click', 'special'
    isMuted(),
    initContext()
  };
  ```
- Audio is muted by default (`muted = true`). Clicking the switcher sound toggle or interacting with the page resumes the `AudioContext` and toggles mute.
- When `themechange` event is received, `ClownAudio.setTheme(themeName)` switches the active synthesis profile.

### Theme Containers ↔ Universal Link Destinations
- Every theme container MUST contain accessible anchor tags for:
  - `openooda`: `https://openooda.org`
  - `necrometer`: `https://necrometer.dev`
  - `bumtrips`: `https://bumtrips.com`
  - `reactle`: `https://reactle.clownhouse.io`
  - `giggle`: `https://giggle.clownhouse.io`
  - `contact`: `mailto:jeryd@clownhouse.io`
- External links must include `target="_blank" rel="noopener noreferrer"`.
- Anchors must have class `theme-link` and data attributes `data-destination="openooda|necrometer|bumtrips|reactle|giggle|contact"`.
- Hover and click events on `.theme-link` trigger `ClownAudio.playSfx('hover')` and `ClownAudio.playSfx('click')`.

---

## Code Layout

```
/home/jeryd/Projects/studio2201/clownhouse.io/
├── index.html              # Multi-container HTML structure: Switcher bar + 5 Theme containers
├── style.css               # Core CSS variables, typography, layout, animations, theme overrides
├── app.js                  # Dynamic switcher controller, localStorage manager, link listeners
├── audio.js                # Zero-dependency Web Audio API procedural synthesis engine
├── tests/                  # E2E test suite
│   ├── run_tests.sh        # Master automated test runner
│   ├── test_tier1_features.py
│   ├── test_tier2_boundary.py
│   ├── test_tier3_pairwise.py
│   ├── test_tier4_scenarios.py
│   └── test_tier5_adversarial.py
├── CNAME                   # clownhouse.io
├── .nojekyll               # Disable Jekyll static processing
├── favicon.svg             # Favicon
├── TEST_INFRA.md           # E2E test infrastructure specification
├── TEST_READY.md           # Published when test suite is ready
└── .agents/                # Subagent working directories (metadata only)
```
