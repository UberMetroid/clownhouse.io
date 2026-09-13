# Project: clownhouse.io Mega Man X Stage-Select & Chaos Engine

## Architecture
- **Architecture Type**: Pure static HTML5, modern vanilla CSS3, and modular vanilla ES6 JavaScript. Zero external runtime frameworks, zero third-party CDNs.
- **Visual Design Language**: Omarchy editorial minimalism fused with authentic 16-bit Mega Man X cybernetic aesthetics: segmented energy borders, corner L-brackets, scanline shaders, boss kicker badges, targeting reticles, energy charging animations, and high-contrast typography (Geist + JetBrains Mono).
- **Mega Man X Cyber-Dock**: Persistent floating `<nav id="stage-select-dock">` centered at viewport bottom (`z-index: 120`), linking directly to 5 core projects (openOODA.org, bumtrips.com, necrometer.dev, giggle.clownhouse.io, reactle.clownhouse.io) with strict security attributes (`target="_blank" rel="noopener noreferrer"`), 16-bit micro-SFX on hover/click, and collision-free coexistence with the bottom-left floating audio pill.
- **Surreal Ambient Chaos Engine (`window.ClownChaos`)**: Dedicated visual effects subsystem:
  - Phasing text apparitions: Cryptic cybernetic telemetry fragments spawning at random coordinates, drifting, and dissolving with strict DOM garbage collection (bounded pool $\le 4$).
  - 16-Bit pixel art explosions: Hardware-accelerated full-viewport `<canvas id="chaos-canvas">` with 256 pre-allocated particle pool (zero GC pause) detonating spontaneously and on pointer click/stage card selection.
  - Sci-Fi optical lens flares: Anamorphic horizontal light streaks and chromatic glints reacting to cursor and scroll velocity with strict `pointer-events: none !important;`.
  - 60fps performance with tab visibility pause (`visibilitychange`) and `prefers-reduced-motion` compliance.
- **Dual-Trigger Theme Randomizer (`window.ClownTheme`)**:
  - 7 authoritative Omarchy palettes: `tokyo-night`, `catppuccin`, `gruvbox`, `nord`, `rose-pine`, `ethereal`, `vantablack`.
  - Trigger 1: Ambient periodic cycle every 15–25 seconds.
  - Trigger 2: Scroll velocity and stop detector with 4.0s anti-strobe cooldown.
  - Cinematic 800ms smooth cross-fades via CSS custom properties.
- **Audio Soundtrack & Real-Time Equalizer (`window.ClownAudio`)**:
  - Chrono Trigger soundtrack (*Corridors of Time* & *Wind Scene* by Yasunori Mitsuda) locally hosted in `music/` and streamed via HTML5 Audio + Web Audio `AnalyserNode`.
  - 4-bar equalizer dynamically animated in `#floating-audio-pill`.
  - Autoplay safe (muted by default), anti-pop 30ms gain ramps, Spacebar shortcut, and prototype-pollution immune 16-bit sound effects.
- **Testing & Deployment**:
  - Strict Double-Run State Invariance Law ($Run_1 == Run_2 = 0$) on `bash tests/run_tests.sh`.
  - GitHub Pages automatic deployment from `main` behind Cloudflare edge reverse proxy (`curl -sI https://clownhouse.io` $\to$ `HTTP/2 200`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Mega Man X Bottom Cyber-Dock | Pinned bottom navigation dock coexisting with floating audio pill | M1 | ORIGINAL_REQUEST §R1 |
| F02 | 5 Stage-Select Cards | Cards for openOODA, bumtrips, necrometer, giggle, reactle | M1 | ORIGINAL_REQUEST §R1 |
| F03 | 16-Bit Frame & Scanlines | Segmented borders, corner L-brackets, and CRT scanline shader | M1 | ORIGINAL_REQUEST §R1 |
| F04 | Boss Kicker Badges | High-contrast monospace kicker badges (e.g. AUTONOMOUS CORE) | M1 | ORIGINAL_REQUEST §R1 |
| F05 | Hover Targeting Reticles | Pulsing crosshair overlay snapping to card on hover/focus | M1 | ORIGINAL_REQUEST §R1 |
| F06 | Energy Charging Animations | Segmented vertical tick marks charging upwards with glow | M1 | ORIGINAL_REQUEST §R1 |
| F07 | 16-Bit Audio Feedback | Synthesized micro-chirps and confirm chimes for hover/click | M1 | ORIGINAL_REQUEST §R1 |
| F08 | Direct Navigation Security | Strict `target="_blank"` and `rel="noopener noreferrer"` | M1 | ORIGINAL_REQUEST §R1 |
| F09 | Phasing Text Apparitions | Ephemeral cyber phrases spawning at random coords and fading | M2 | ORIGINAL_REQUEST §R2 |
| F10 | Apparition Garbage Collection | Strict DOM `.remove()` on animationend and pool bound $\le 4$ | M2 | ORIGINAL_REQUEST §R2 |
| F11 | 16-Bit Pixel Art Explosions | Chunky square particle explosions via `<canvas id="chaos-canvas">` | M2 | ORIGINAL_REQUEST §R2 |
| F12 | Pre-Allocated Particle Pool | 256 particle pool for zero runtime heap allocation and 60fps | M2 | ORIGINAL_REQUEST §R2 |
| F13 | Sci-Fi Anamorphic Lens Flares | Horizontal streaks and glints reacting to cursor and scroll | M2 | ORIGINAL_REQUEST §R2 |
| F14 | Non-Blocking Anomaly Invariant | `pointer-events: none` on all chaos layers preventing click blocking | M2 | ORIGINAL_REQUEST §R2 |
| F15 | Chaos Lifecycle Management | RAF loop with tab visibility throttling and reduced-motion support | M2 | ORIGINAL_REQUEST §R2 |
| F16 | 7 Omarchy Theme Palettes | Tokyo Night, Catppuccin, Gruvbox, Nord, Rosé Pine, Ethereal, Vantablack | M3 | ORIGINAL_REQUEST §R3 |
| F17 | Ambient Time Randomizer | Random theme shift every 15–25 seconds | M3 | ORIGINAL_REQUEST §R3 |
| F18 | Scroll Velocity Detector | Scroll speed and stop detection triggering random theme morphs | M3 | ORIGINAL_REQUEST §R3 |
| F19 | Anti-Strobe Cooldown | 4.0-second cooldown preventing seizure/flicker artifacts | M3 | ORIGINAL_REQUEST §R3 |
| F20 | 800ms Color Cross-Fades | Cinematic smooth transitions across backgrounds, borders, text | M3 | ORIGINAL_REQUEST §R3 |
| F21 | Chrono Trigger Audio Streams | Corridors of Time & Wind Scene streamed via HTML5 Audio | M4 | ORIGINAL_REQUEST §R4 |
| F22 | Real-Time Analyser EQ Bars | Web Audio AnalyserNode driving 4 equalizer bars | M4 | ORIGINAL_REQUEST §R4 |
| F23 | Autoplay Safe & Anti-Pop Ramps| Muted by default, 30ms volume ramps, gesture initialization | M4 | ORIGINAL_REQUEST §R4 |
| F24 | Spacebar Audio Shortcut | Space key toggles audio outside form typing contexts | M4 | ORIGINAL_REQUEST §R4 |
| F25 | Test Suite Parity & Invariance | `bash tests/run_tests.sh` passes 100% under $Run_1 == Run_2 = 0$ | M5 | ORIGINAL_REQUEST §R5 |
| F26 | Git Production Push | Commit and push verified code to `studio2201/clownhouse.io` on `main` | M6 | ORIGINAL_REQUEST §R5 |
| F27 | Live Edge Verification | `curl -sI https://clownhouse.io` returns HTTP/2 200 via Cloudflare | M6 | ORIGINAL_REQUEST §R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Mega Man X Stage-Select Bottom Dock & 16-Bit SFX | F01–F08 (Dock HTML/CSS, 5 cards, brackets, reticles, charge anims, 16-bit sound synthesis) | none | DONE |
| M2 | Surreal Ambient Visual Chaos Engine | F09–F15 (`#chaos-overlay`, canvas pixel explosions, text apparitions, lens flares, 60fps loop) | M1 | DONE |
| M3 | Dual-Trigger Theme Randomizer | F16–F20 (15-25s timer, scroll velocity/stop detector, 4s cooldown, 800ms morphs) | M1 | DONE |
| M4 | Chrono Trigger Audio & Equalizer Polish | F21–F24 (Chrono Trigger streams, AnalyserNode EQ, anti-pop, Spacebar, prototype defense) | M1 | DONE |
| M5 | E2E Test Suite Expansion & Adversarial Hardening | F25 (Update tests/ for stage dock, chaos, theme randomizer; verify double-run invariance) | M1, M2, M3, M4 | DONE |
| M6 | Production Git Push & Live Edge Verification | F26, F27 (Git push to main, Pages build verification, Cloudflare edge curl HTTP/2 200) | M5 | DONE |

## Interface Contracts

### Global Window Contracts
- `window.ClownTheme`:
  - `THEMES: readonly string[] = ['tokyo-night', 'catppuccin', 'gruvbox', 'nord', 'rose-pine', 'ethereal', 'vantablack']`
  - `setTheme(themeId: string): void`
  - `cycleTheme(): string`
  - `randomTheme(): string`
  - `getCurrentTheme(): string`
  - `startAutoRandom(intervalMs?: number): void`
  - `stopAutoRandom(): void`
  - `resetAutoRandom(): void`
- `window.ClownAudio`:
  - `TRACKS: readonly TrackMetadata[]`
  - `play(): Promise<void>`
  - `pause(): void`
  - `togglePlay(): Promise<void>`
  - `toggleMute(): void`
  - `setVolume(fraction: number): void`
  - `nextTrack(): void`
  - `prevTrack(): void`
  - `getState(): AudioState`
  - `getFrequencyData(array: Uint8Array): void`
  - `playSfx(type: string): boolean`
- `window.ClownChaos`:
  - `spawnApparition(text?: string): void`
  - `triggerExplosion(x: number, y: number, particleCount?: number): void`
  - `setReducedMotion(enabled: boolean): void`
  - `getActiveApparitionCount(): number`
  - `destroy(): void`

### DOM Element Contracts
- `#stage-select-dock`: Pinned bottom navigation dock (`z-index: 120`).
- Stage cards: `#dock-openooda`, `#dock-bumtrips`, `#dock-necrometer`, `#dock-giggle`, `#dock-reactle`.
- `#chaos-overlay`: Full viewport fixed overlay (`inset: 0; pointer-events: none; z-index: 20;`).
- `#chaos-canvas`: Hardware-accelerated canvas for 16-bit pixel explosions (`pointer-events: none;`).
- `#chaos-apparitions`: Container for phasing text spans (`pointer-events: none;`).
- `#floating-audio-pill`: Bottom-left audio player (`left: 1.25rem; bottom: 1.25rem; z-index: 100`).

## Code Layout
- `index.html`: Main document with semantic landmarks, `#stage-select-dock`, `#chaos-overlay`, `#floating-audio-pill`, `#command-palette-modal`.
- `style.css`: 7 Omarchy palettes, cybernetic stage-select dock styles, scanlines, reticles, chaos engine styling, responsive breakpoints.
- `app.js`: Application controller, theme randomizer (time + scroll), chaos engine (`window.ClownChaos`), command palette.
- `audio.js`: Chrono Trigger streaming, Web Audio AnalyserNode EQ, 16-bit synthesized sound effects (`playSfx`).
- `tests/`: Automated test suite (Python + Node.js) executed via `bash tests/run_tests.sh`.
