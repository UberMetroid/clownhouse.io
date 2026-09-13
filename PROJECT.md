# Project: clownhouse.io Omarchy-Inspired Software Lab Rebuild

## Architecture
- **Architecture Type**: Pure static HTML5, modern vanilla CSS3, and lightweight vanilla ES6 JavaScript. Zero external runtime frameworks. Zero external binary audio assets.
- **Visual Design Language**: Omarchy.org editorial minimalism, high-contrast typography, hairline borders (`1px solid`), translucent surface blurs (`backdrop-filter: blur(10px)`), monospace telemetry accents, and responsive card grids.
- **Theme Palette Engine**: 7 bespoke presets (Tokyo Night, Catppuccin, Gruvbox, Nord, Rosé Pine, Ethereal, Vantablack) with exact hex tokens, hot-swapped via `data-theme` attribute on `<html>`, cycled via keyboard shortcut `T`, and persisted in `localStorage` under key `'theme'`.
- **Audio Engine**: 100% client-side procedural Web Audio API synthesis (zero MP3/WAV/OGG dependencies) with 4 generative frequency modes (Carrier Drift, Cybernetic Drone, Necrometer 528Hz, Velvet Frequency) connected to an `AnalyserNode` driving a 4-bar equalizer in the bottom-left floating audio pill.
- **Command Palette**: High-performance fuzzy search modal triggered by `Cmd+K`, `Ctrl+K`, or `/` with full keyboard accessibility (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) indexing all projects, cluster services, developer stack items, theme actions, and audio controls.
- **Deployment Pipeline**: GitHub Pages deployment from `main` root `/` behind Cloudflare Anycast edge reverse proxy (`cf-cache-status: DYNAMIC`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Clean Slate Purge | Remove legacy theme containers, old CSS, obsolete JS widgets, and outdated tests | M1 | ORIGINAL_REQUEST §R1 |
| F02 | Hero Section | Bold CLOWNHOUSE header, personal bio, status pills, and quick action CTAs | M1 | ORIGINAL_REQUEST §R2 |
| F03 | Featured Projects Showcase | Deep feature cards for openOODA.org, necrometer.dev, and bumtrips.com with links | M1 | ORIGINAL_REQUEST §R2 |
| F04 | Labs & Cluster Services | Cards for reactle.clownhouse.io, giggle.clownhouse.io, and jeryd@clownhouse.io | M1 | ORIGINAL_REQUEST §R2 |
| F05 | Developer Stack Grid | Showcase cards for Neovim, Go, Rust, TypeScript, Cloudflare, Linux | M1 | ORIGINAL_REQUEST §R2 |
| F06 | Activity & Momentum | Sleek ASCII/Unicode 12-week commit cadence sparklines & live telemetry stats | M1 | ORIGINAL_REQUEST §R2 |
| F07 | Editorial Footer & Metadata | Copyright, quick links, keyboard shortcuts hint, and JSON-LD semantic schema | M1 | ORIGINAL_REQUEST §R2 |
| F08 | Modern Favicon & Docs | Modern Omarchy-styled SVG favicon and updated software laboratory README.md | M1 | ORIGINAL_REQUEST §R1 |
| F09 | Editorial Typography & Grid | Dual-font typography (Geist + JetBrains Mono), hairline borders, and responsive CSS grid | M1 | ORIGINAL_REQUEST §R2 |
| F10 | 7 Theme Color Palettes | Tokyo Night, Catppuccin, Gruvbox, Nord, Rosé Pine, Ethereal, Vantablack hex tokens | M1 | ORIGINAL_REQUEST §R3 |
| F11 | Theme Switcher Engine | Hot-swap CSS custom properties, `localStorage` persistence ('theme'), and View Transitions | M1 | ORIGINAL_REQUEST §R3 |
| F12 | Shortcut 'T' Theme Cycling | Single-key `T` listener to cycle themes with input/textarea guard | M1 | ORIGINAL_REQUEST §R3 |
| F13 | Floating Audio Pill Layout | Fixed bottom-left pill with play/pause, track info, and volume controls | M2 | ORIGINAL_REQUEST §R3 |
| F14 | Procedural Web Audio Engine | 100% client-side synthesis with 4 generative frequency modes (zero audio files) | M2 | ORIGINAL_REQUEST §R4 |
| F15 | Analyser Real-Time EQ Bars | 4 equalizer bars driven dynamically by Web Audio AnalyserNode frequency bins | M2 | ORIGINAL_REQUEST §R3 |
| F16 | Audio Lifecycle & Autoplay | Muted by default, unlocked on gesture, smooth gain ramps, visibility change handling | M2 | ORIGINAL_REQUEST §R4 |
| F17 | Command Palette Modal | Blurred backdrop modal opened via Cmd+K, Ctrl+K, or `/` | M3 | ORIGINAL_REQUEST §R3 |
| F18 | Fuzzy Search Filtering | Multi-token search algorithm across titles, descriptions, categories, and keywords | M3 | ORIGINAL_REQUEST §R3 |
| F19 | Keyboard Navigation | ArrowUp, ArrowDown with wrap-around, Enter to execute, Escape to clear/close | M3 | ORIGINAL_REQUEST §R3 |
| F20 | Searchable Catalog Actions | Index of all projects, cluster endpoints, navigation anchors, themes, and audio controls | M3 | ORIGINAL_REQUEST §R3 |
| F21 | E2E Test Suite (Tiers 1-4) | Comprehensive opaque-box test suite verifying all features, boundaries, and scenarios | M4 | Acceptance Criteria |
| F22 | Adversarial Hardening (Tier 5) | CDP / browser fuzzing, mutation tests, and resilience verification | M4 | User Global Rule 12 |
| F23 | Git Deployment to Main | Commit and push verified code to studio2201/clownhouse.io on branch main | M5 | ORIGINAL_REQUEST §R5 |
| F24 | GitHub Pages Build | Automated GitHub Pages workflow completes with success (~26s) | M5 | ORIGINAL_REQUEST §R5 |
| F25 | Cloudflare Edge Verification | curl -sI https://clownhouse.io returns HTTP/2 200 with zero syntax errors | M5 | ORIGINAL_REQUEST §R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Omarchy Foundation & Theme Engine | Purge legacy theme code; write clean index.html, style.css (7 themes), app.js (theme engine), favicon.svg, README.md | none | COMPLETE |
| M2 | Procedural Web Audio & Floating Player | Implement audio.js (4 generative modes), floating audio pill, and AnalyserNode EQ bars | M1 | COMPLETE |
| M3 | Command Palette & Fuzzy Navigation | Implement Cmd+K fuzzy modal, keyboard navigation, and catalog in app.js and style.css | M1 | COMPLETE |
| M4 | E2E Test Suite & Adversarial Hardening | Comprehensive test suite (Tiers 1-5), test runner, and 100% pass verification with double-run parity | M1, M2, M3 | COMPLETE |
| M5 | Git Deployment & Edge Verification | Push to main, verify Pages build, verify edge HTTP/2 200, and Sentinel completion report | M4 | COMPLETE |

## Interface Contracts

### Global Window Contracts (`app.js` & `audio.js`)
- `window.ClownTheme`:
  - `setTheme(themeId: string): void`
  - `cycleTheme(): string`
  - `getCurrentTheme(): string`
  - `THEMES: string[] = ['tokyo-night', 'catppuccin', 'gruvbox', 'nord', 'rose-pine', 'ethereal', 'vantablack']`
- `window.ClownAudio`:
  - `play(): Promise<void>`
  - `pause(): void`
  - `togglePlay(): Promise<void>`
  - `toggleMute(): void`
  - `setVolume(fraction: number): void`
  - `nextTrack(): void`
  - `prevTrack(): void`
  - `getState(): { isPlaying: boolean, isMuted: boolean, volume: number, trackIndex: number, currentTrack: object }`
  - `getFrequencyData(array: Uint8Array): void`
- `window.ClownPalette`:
  - `open(): void`
  - `close(): void`
  - `toggle(): void`
  - `search(query: string): Array<object>`
  - `executeItem(itemId: string): void`

### DOM Element Contracts
- `#site-header`: Sticky top navigation with brand glyph, nav anchors, and control triggers.
- `#hero`: Bold CLOWNHOUSE header, bio, status badges, and quick CTA links.
- `#projects`: Featured project cards (`#featured-openooda`, `#featured-necrometer`, `#featured-bumtrips`).
- `#services`: Labs & cluster services cards (`#service-reactle`, `#service-giggle`, `#service-email`).
- `#stack`: Developer stack grid (`#stack-neovim`, `#stack-go`, `#stack-rust`, `#stack-typescript`, `#stack-cloudflare`, `#stack-linux`).
- `#activity`: ASCII/Unicode commit sparkline and telemetry stats.
- `#floating-audio-pill`: Docked bottom-left audio controller with `#audio-play-btn`, `#audio-track-title`, `#audio-track-freq`, `#audio-eq-bars`, `#audio-mute-btn`.
- `#command-palette-modal`: Modal dialog `#palette-dialog`, search input `#palette-input`, results list `#palette-results`.

## Code Layout
- `index.html`: Complete semantic HTML5 document, structured metadata, and landmark sections.
- `style.css`: Modern responsive CSS, 7 theme palettes (`[data-theme="..."]`), typography, hairline borders, and layout grids.
- `app.js`: Application controller, theme switcher engine, command palette engine, UI event bindings.
- `audio.js`: Procedural Web Audio API synthesizer, 4 generative tracks, and analyser bridge.
- `favicon.svg`: Minimalist Omarchy-styled SVG brand glyph.
- `README.md`: Project documentation for Jeryd's Omarchy-inspired software laboratory.
- `tests/`: Automated test suite (Tiers 1-5) validating syntax, links, theme engine, audio, and command palette.
