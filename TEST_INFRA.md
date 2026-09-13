# E2E Test Infrastructure & Verification Specification
**clownhouse.io Multi-Concept Theme Showcase**

- **Document Version**: 1.0.0
- **Author**: E2E Test Suite Architect (`teamwork_preview_test_writer_e2e_1`)
- **Authority**: `/home/jeryd/Projects/studio2201/clownhouse.io/.agents/ORIGINAL_REQUEST.md` & `PROJECT.md`
- **Scope**: Comprehensive Opaque-Box E2E Testing Suite (Tiers 1–4)

---

## 1. Executive Summary & Test Strategy

This document specifies the end-to-end (E2E) testing infrastructure, formal methodologies, and test harness for the `clownhouse.io` interactive multi-concept theme showcase.

The showcase presents 5 bespoke themes:
1. **The Tower of Power** (Sega Genesis Model 1 + Sega CD + 32X hardware stack)
2. **Chozo Scan Visor** (Metroid holographic combat HUD & Hawaiian volcanic basalt/magma)
3. **WRX TR Rally Telemetry** (World Rally Blue, Brembo red, carbon weave & turbo boost gauge)
4. **Hunter Base Dispatch** (Mega Man X 16-bit anime tech, 3x3 stage grid, health bars & X-Buster charge)
5. **Pacific Outpost Hybrid** (Unified tactical convergence of all four aesthetic pillars)

The testing architecture is designed from first principles with an opaque-box, requirement-driven philosophy. It exercises the web application through its public interfaces, semantic DOM tree, CSS cascade rules, JavaScript state machine, Web Audio API procedural synthesis engine, responsive breakpoints, and external navigation invariants.

---

## 2. Formal Testing Methodologies

### 2.1. Category-Partition Method (TSL)
The application domain is partitioned into orthogonal operational categories, each defined with specific environmental parameters, choices, and constraint rules:

| Category | Parameter | Choices / Partitions | Constraints / Preconditions |
| :--- | :--- | :--- | :--- |
| **Theme Selection** | Active Theme ID | `tower-of-power`, `chozo-visor`, `wrx-telemetry`, `hunter-base`, `pacific-outpost` | Valid theme strings only |
| **Theme Persistence** | `localStorage['clownhouse_theme']` | Present & Valid, Missing/Null, Empty string, Malformed/Corrupted, Restricted/Blocked | Throws `SecurityError` if incognito/sandboxed |
| **Audio Engine** | Master Audio State | Muted (`false`), Unmuted (`true`) | Default must be Muted (`false`) |
| **Audio Synthesis** | Sound Profile Target | Genesis FM, Chozo Visor Harmonics, WRX Turbo Spool, MMX Square Wave, Pacific Hybrid | Swapped on `themechange` event |
| **Audio Volume** | Gain Multiplier | `0.0` (min), `0.5` (mid), `1.0` (max), Clamped safe ceiling ($\le 0.35$) | Clamped strictly to $[0.0, 1.0]$ |
| **Universal Links** | Destination Target | `openooda`, `necrometer`, `bumtrips`, `reactle`, `giggle`, `contact` | All 6 present in all 5 themes (30 instances) |
| **Viewport Profile** | Screen Width | Mobile ($320\text{px}-480\text{px}$), Tablet ($768\text{px}-1024\text{px}$), Desktop ($1200\text{px}-2560\text{px}+$) | Zero horizontal document overflow |
| **Motion Preference** | CSS Media Query | `prefers-reduced-motion: no-preference`, `prefers-reduced-motion: reduce` | Animations dampened under `reduce` |

### 2.2. Boundary Value Analysis (BVA)
Boundary value testing probes the system at and beyond operating limits:
- **Audio Gain**: $-1.0$ (underflow), $-0.01$, $0.0$ (minimum boundary), $0.001$, $0.5$, $0.999$, $1.0$ (maximum boundary), $1.01$, $2.0$ (overflow), `NaN`, `null`.
- **Viewport Dimensions**: $320\text{px}$ (absolute mobile floor), $321\text{px}$, $480\text{px}$, $768\text{px}$ (tablet breakpoint), $1024\text{px}$, $1200\text{px}$ (desktop breakpoint), $2560\text{px}$, $3840\text{px}$ (4K ultra-wide ceiling).
- **Storage Payloads**: Empty string `""`, oversized strings ($>256$ chars), JSON payloads `{"theme":"hack"}`, injection vectors `<script>alert(1)</script>`, directory traversal `../../hack`.
- **Rapid Input Thrashing**: Rapid consecutive theme switching ($50\times$ switches $<10\text{ms}$) to detect race conditions, DOM desynchronization, or audio graph leaks.

### 2.3. Pairwise Combinatorial Testing (All-Pairs)
To guarantee high defect detection with minimal combinatorial explosion, all 2-way interactions between critical orthogonal factors are systematically tested:
$$\text{Theme} \times \text{Audio State} \times \text{Interaction Type} \times \text{Destination}$$
- $5 \text{ Themes} \times 2 \text{ Audio States} = 10 \text{ states}$
- $10 \text{ states} \times 2 \text{ Interactions (Hover, Click)} = 20 \text{ combinations}$
- $20 \text{ combinations} \times 6 \text{ Universal Destinations} = 120 \text{ pairwise interaction pairs}$

### 2.4. Real-World Workload Testing (E2E User Journeys)
Multi-step stateful user sessions that mirror realistic audience behaviors:
1. **Fresh Visitor Onboarding**: Initial page load $\to$ default theme verification $\to$ inspection of top switcher $\to$ audio mute status check $\to$ universal link discovery.
2. **Full Theme Traversal**: Sequential navigation through all 5 themes $\to$ verifying DOM container visibility toggle $\to$ CSS variable recomputation $\to$ custom event dispatching.
3. **Acoustic Exploration & Tuning**: User gesture unmute $\to$ volume slider dragging $\to$ triggering interactive sound effects (cartridge click, visor chime, boost spool, buster charge) $\to$ mute toggling.
4. **Session Persistence & Reload**: Custom theme selection $\to$ browser reload simulation $\to$ `localStorage` inspection $\to$ instantaneous restoration without flash of unstyled content (FOUC).
5. **Universal Destination Traversal**: Exhaustive audit of all 30 link anchors (6 links across 5 themes) verifying target URLs, security attributes (`target="_blank"`, `rel="noopener noreferrer"`), and native mailto handling.
6. **Mobile Viewport Ergonomics**: Responsive testing at $360\text{px}\times 640\text{px}$ ensuring layout reflow, touch target compliance ($\ge 44\times 44\text{px}$), and zero horizontal scroll.

### 2.5. Mechanical Anti-Cheating & Zero-Trust QA
- **The Double-Run Law ($Run_1 == Run_2$)**: Every test suite must be executed twice consecutively. A suite that passes on Run 1 but fails or leaks state on Run 2 is considered failed.
- **Mandatory 1:1 Negative Falsification**: Hostile inputs (corrupted storage, blocked audio, extreme boundaries) must prove fail-closed termination.
- **Anti-Vacuity Gate**: Tests must assert concrete invariants against project files; no tests may pass unconditionally without assertions.

---

## 3. Test Suite Architecture & Directory Layout

```
/home/jeryd/Projects/studio2201/clownhouse.io/
├── index.html              # Multi-container HTML structure: Switcher bar + 5 Theme containers
├── style.css               # Core CSS variables, typography, layout, animations, theme overrides
├── app.js                  # Dynamic switcher controller, localStorage manager, link listeners
├── audio.js                # Zero-dependency Web Audio API procedural synthesis engine
├── tests/                  # E2E test suite directory
│   ├── run_tests.sh        # Master automated test runner (executable, exit code 0 when all pass)
│   ├── test_tier1_features.py   # Tier 1: Feature Coverage (F01–F42, >=5 tests per feature)
│   ├── test_tier2_boundary.py   # Tier 2: Boundary & Corner Cases (Failsafe, Thrash, Viewports)
│   ├── test_tier3_pairwise.py   # Tier 3: Cross-Feature Pairwise Combinatorial Interactions
│   ├── test_tier4_scenarios.py  # Tier 4: Real-World Application Scenarios (E2E User Journeys)
│   └── test_tier5_adversarial.py # Tier 5: Adversarial Hardening (M4 dual-track gate)
├── TEST_INFRA.md           # This infrastructure specification
└── TEST_READY.md           # Readiness declaration published upon test suite completion
```

---

## 4. Feature Coverage Matrix (Tier 1: F01–F42)

Tier 1 enforces $\ge 5$ distinct test cases for every feature in the inventory:

| Feature ID | Feature Name | Test Count | Key Verification Objectives |
| :--- | :--- | :---: | :--- |
| `F01_SWITCHER_BAR` | Persistent Switcher Bar | 5 | Switcher bar element exists, fixed at viewport top, contains 5 theme buttons, displays sound toggle, accessible roles |
| `F02_NO_RELOAD_SWAP` | Zero-Reload Theme Swap | 5 | In-page click handling, `preventDefault` on navigation, updates root `data-theme`, dispatches `themechange` CustomEvent, zero reload |
| `F03_STORAGE_PERSIST` | LocalStorage Persistence | 5 | Sets `clownhouse_theme` on switch, reads on init, persists across invocations, respects user choice, updates cleanly |
| `F04_STORAGE_FAILSAFE` | Storage Fail-Closed Fallback | 5 | Rejects `<script>`, rejects unknown strings, falls back to `tower-of-power`, handles `SecurityError`, fallback to memory |
| `F05_THEME_CONTAINERS` | 5 Theme DOM Containers | 5 | All 5 container elements exist, class `theme-container`, active container visible, inactive containers hidden, valid semantic tags |
| `F06_AUDIO_ENGINE_INIT` | Web Audio API Initialization | 5 | Context init deferred to gesture, exposes `window.ClownAudio`, handles missing AudioContext, tracks context state, zero external files |
| `F07_AUDIO_MUTE_TOGGLE` | Audio Mute Toggle | 5 | Toggle button exists (`#sound-toggle`), muted by default, `aria-pressed` updates, click flips state, persisted in `clownhouse_sound` |
| `F08_AUDIO_FM_SYNTH` | Multi-Operator FM Synthesis | 5 | FM synthesis implementation defined, carrier + modulator oscillators, modulation index envelope, frequency ratios, no audio samples |
| `F09_AUDIO_NOISE_GEN` | Procedural Noise Generation | 5 | Buffer noise generator defined, biquad filter routing, envelope gain, BOV hiss and magma rumble synthesis, memory release |
| `F10_AUDIO_TOP_SOUNDS` | Tower of Power Audio Profile | 5 | Genesis FM slap bass and chimes profile, cartridge click sound, volume scaling, muted state silence, custom event response |
| `F11_AUDIO_CHOZO_SOUNDS` | Chozo Visor Audio Profile | 5 | High-resonance HUD scan chimes, frequency sweep, magma ambient drone, muted silence, theme activation sound |
| `F12_AUDIO_WRX_SOUNDS` | WRX Rally Audio Profile | 5 | Turbo boost spool rising tone, BOV hiss burst, sequential shift beeps, muted silence, volume clamping |
| `F13_AUDIO_MMX_SOUNDS` | Hunter Base Audio Profile | 5 | 16-bit square wave beeps, stage select cursor chirps, X-Buster charging ascending loop, muted silence, release sound |
| `F14_AUDIO_PACIFIC_SOUNDS` | Pacific Outpost Audio Profile | 5 | Multi-layered hybrid cues, sonar ping, volcanic rumble, muted silence, gain limiting to prevent clipping |
| `F15_TOP_GENESIS_CASE` | Sega Genesis Hardware Aesthetic | 5 | Matte black console chassis styling, 16-bit gold foil accents, power LED element, retro typography, Genesis Model 1 aesthetic |
| `F16_TOP_RIBBED_VENTS` | Chunky Ribbed Cooling Vents | 5 | Ribbed vent elements/classes, horizontal/diagonal louvers, CSS gradient relief shading, border containment, responsive reflow |
| `F17_TOP_CARTRIDGE_LINKS` | Physical Cartridge Slot Links | 5 | Links presented as cartridges, gold pin connector details, hover lift animation (`translateY`), target blank, security rel |
| `F18_TOP_VOLUME_SLIDER` | Model 1 Volume Slider Widget | 5 | Tactile slider widget present, binds to master audio volume, min=0 max=1 / 0-100%, clamped range, visual tick marks |
| `F19_CHOZO_HUD_FRAME` | Chozo Holographic Visor Frame | 5 | Curved HUD visor border overlay, glass tint vignette, corner bracket notches, ambient scan panels, non-overflowing CSS |
| `F20_CHOZO_BASALT_MAGMA` | Volcanic Basalt & Magma Veins | 5 | Basalt rock background, pulsing geothermal magma lines, `@keyframes` animation, obsidian dark palette, static gradient fallback |
| `F21_CHOZO_ETANKS` | Energy Tanks (E-Tanks) HUD | 5 | E-Tanks display widget present, segmented pink/magenta status boxes, numeric energy readout, non-blocking layout, responsive |
| `F22_CHOZO_RETICLES` | Targeting Reticles & Crosshairs | 5 | Holographic targeting reticle markup/CSS, scan visor crosshair animations, spinning bracket lock-on, smooth CSS transitions, active target |
| `F23_CHOZO_SCANNABLE_LINKS` | Scannable HUD Target Nodes | 5 | Links styled as scannable nodes, scan progress / lock-on indicator, hover feedback, click activation, accessible anchors |
| `F24_WRX_DASHBOARD` | WRX Motorsport Dashboard | 5 | World Rally Blue (`#003399`) theme tokens, carbon weave 45-degree twill background, Brembo red accents, cockpit framing, contrast |
| `F25_WRX_TURBO_GAUGE` | Digital Turbo Boost Gauge | 5 | Boost gauge widget present, needle / digital readout, scale -1.0 to +1.8 bar (-15 to +25 PSI), peak hold display, hover updates |
| `F26_WRX_SHIFT_LIGHTS` | Sequential Shift Light Bar | 5 | Sequential LED shift light strip, green-yellow-red progression, redline indicator, telemetry trigger, responsive placement |
| `F27_WRX_PACE_NOTES` | Mechanical Rally Telemetry Links | 5 | Links styled as ECU telemetry channels (`CH-01` to `CH-06`), mock sensor readouts (RPM, BOOST), valid target URLs, security rel |
| `F28_MMX_TECH_AESTHETIC` | Mega Man X Anime Tech Aesthetic | 5 | Deep navy and cyan command palette, Dr. Cain Maverick Hunter HQ interface, threat alert banner, retro arcade styling, responsive |
| `F29_MMX_STAGE_GRID` | 3x3 Stage Select Mission Grid | 5 | 3x3 stage select grid structure, universal destination boss nodes, responsive reflow, flashing border cursor on hover, accessible |
| `F30_MMX_HEALTH_BARS` | Segmented 28-Tick Health Bars | 5 | Vertical Capcom-style health bar, segmented yellow/green ticks, dark divider borders, golden energy cap, zero layout shift |
| `F31_MMX_BUSTER_CHARGE` | X-Buster Charge Animation | 5 | Interactive charge widget/button, multi-stage charge levels (Lv1 Blue -> Lv2 Green -> Lv3 Pink), visual aura glow, cancel safety, sound |
| `F32_PACIFIC_HYBRID_FUSION` | Pacific Outpost Hybrid Console | 5 | Harmonious fusion of basalt, Chozo visor, WRX gauge telemetry, and 16-bit console hardware, unified palette, responsive layout |
| `F33_PACIFIC_COMMS_LINKS` | Tactical Communications Array | 5 | Communications array layout for universal links, priority feed styling, interactive telemetry status, responsive reflow, security rel |
| `F34_LINK_OPENOODA` | `openOODA.org` Destination | 5 | Link to `https://openooda.org` present across all 5 themes, correct `target="_blank"`, `rel="noopener noreferrer"`, accessible text |
| `F35_LINK_NECROMETER` | `necrometer.dev` Destination | 5 | Link to `https://necrometer.dev` present across all 5 themes, correct `target="_blank"`, `rel="noopener noreferrer"`, accessible text |
| `F36_LINK_BUMTRIPS` | `bumtrips.com` Destination | 5 | Link to `https://bumtrips.com` present across all 5 themes, correct `target="_blank"`, `rel="noopener noreferrer"`, accessible text |
| `F37_LINK_REACTLE` | `reactle.clownhouse.io` Service | 5 | Link to `https://reactle.clownhouse.io` present across all 5 themes, correct `target="_blank"`, `rel="noopener noreferrer"`, accessible text |
| `F38_LINK_GIGGLE` | `giggle.clownhouse.io` Service | 5 | Link to `https://giggle.clownhouse.io` present across all 5 themes, correct `target="_blank"`, `rel="noopener noreferrer"`, accessible text |
| `F39_LINK_MAILTO` | `mailto:jeryd@clownhouse.io` Mail | 5 | Link to `mailto:jeryd@clownhouse.io` present across all 5 themes, native mailto protocol (no target blank), accessible label |
| `F40_LINK_INTERACTIONS` | Theme-Specific Link Feedback | 5 | Hover and click event listeners attached, CSS visual feedback, Web Audio cues triggered, non-blocking navigation, touch safety |
| `F41_RESPONSIVE_60FPS` | 60fps & Responsive Layout | 5 | GPU transforms (`translate3d`), mobile media query (<480px), tablet query (768-1024px), desktop query (>1200px), zero horizontal overflow |
| `F42_SYNTAX_ZERO_ERRORS` | Syntax Pass & Zero JS Errors | 5 | `node --check app.js` and `audio.js` pass with exit code 0, strict mode compliance, zero uncaught exceptions, try/catch safety |
| **Total** | **All 42 Features** | **210** | **Comprehensive Full-Spectrum Functional Verification** |

---

## 5. Master Test Runner Specification (`tests/run_tests.sh`)

The test runner is a zero-dependency Bash script executing the Python test harness and Node.js syntax checkers.

### 5.1. CLI Usage
```bash
# Run the complete test suite (Tiers 1, 2, 3, 4) with double-run verification:
bash tests/run_tests.sh

# Run specific tiers:
bash tests/run_tests.sh --tier 1
bash tests/run_tests.sh --tier 2
bash tests/run_tests.sh --tier 3
bash tests/run_tests.sh --tier 4

# Run with verbose output:
bash tests/run_tests.sh --verbose

# Run fast self-test / structural audit:
bash tests/run_tests.sh --audit
```

### 5.2. Exit Code Invariant
- Returns exit code `0` if and only if **all executed tests pass**.
- Returns exit code `1` if any test fails, errors, or violates the Double-Run state invariance law ($Run_1 \ne Run_2$).

---

## 6. Verification & Gate Criteria

1. **Compilation & Syntax Gate**: `node --check` must pass with code 0 on all JavaScript files (`app.js`, `audio.js`).
2. **Tier 1 Feature Gate**: 100% pass on all 210+ feature tests across F01–F42.
3. **Tier 2 Boundary Gate**: 100% pass on all boundary, failsafe, thrash, and extreme viewport tests.
4. **Tier 3 Combinatorial Gate**: 100% pass on all pairwise interaction tests.
5. **Tier 4 Scenario Gate**: 100% pass on all end-to-end user journeys.
6. **Double-Run Invariance**: Consecutive execution runs produce identical results with zero state leakage.
