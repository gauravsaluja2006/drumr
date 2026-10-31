# Changelog

## Unreleased

### Phase 6 — Mixer
- Per-group volume and mute (kick, snare, hi-hat, toms, cymbals, percussion), remembered per kit; only groups the kit has are shown.
- Sliders work from the keyboard (arrows, Page Up/Down, Home/End) and announce values in dB.

### Phase 5 — Mapping editor
- Edit layout (button or `M`): select a pad on screen or by hitting it, set its MIDI note by learning from the controller (10 s timeout), choose its sound and label.
- Save layouts as presets, rename and delete them; reset to the saved version.
- Export the layout as JSON and import it elsewhere; invalid files are rejected with readable reasons and change nothing.

### Phase 4 — Hi-hat openness and choke
- CC-controlled openness: logic.js `updateHiHat` ported exactly (verified by running the original), 7 bands mapped onto each kit's levels (2 to 6).
- Choke: closed, pedal and shank hits fade ringing open hats in ≈40 ms; open does not choke open; crash choke pads work even without a choke sample.
- Hi-hat panel: live openness meter and level name, controller select, direction toggle, optional pedal "chick" on close.
- Ring indicator on pads whose open hat is still sounding.

### Phase 3 — Web MIDI and the Maschine preset
- Web MIDI: permission, device list, hot-plug, auto-select, remembered device, running-status parser.
- Mapping by logical voice with fallbacks; presets "Maschine 4×4 (Logic)" (checked against logic.js) and "Generic pads (GM 36–51)".
- MIDI status pill with device picker; banners when MIDI is unsupported or blocked, with Retry.
- Velocity panel: live curve plot with the last hit, editable curve and floor.
- Fake Web MIDI for Playwright; latency (L1) and load (R1) gates.

### Phase 2 — Kit pipeline and real kits
- Offline kit pipeline: recipes, {layer}/{rr} discovery, layer subsampling, multi-mic mixing, normalise-then-trim, clip guard, FLAC encoding, provenance, verify, index.
- Three kits: Black Pearl (AVL, CC-BY-SA), Virtuosity Jazz (CC0), Big Rusty Rock (CC0, six hi-hat openings). 30.5 MB total.
- Kit selector listbox with licence and size badges; About panel with sources and licences.
- Test builds serve synthetic fixture kits from /test-kits/.

### Phase 1 — Audio engine core and on-screen playing
- Web Audio engine: voice → group → master → safety limiter graph, 64-voice pool with group-aware stealing, velocity layers, round robin, event-to-schedule latency stats.
- Velocity curve ported exactly from logic.js (`scaleVelocity`).
- Kit manifest schema (Zod) with layer coverage, choke reference and path validation; kit loader and LRU sampler (2 kits resident).
- Keyboard (1234/qwer/asdf/zxcv) and pointer input with position-based velocity; tap-to-start-audio overlay.
- Pad hit flash scaled by velocity, driven by requestAnimationFrame outside React.
- Kit panel with licence and attribution, master volume slider (persisted), loading progress bar.
- Synthetic test kits generator; Playwright test hooks in `--mode test` builds.

### Phase 0 — Scaffold, CI, deploy
- Vite 8 + React 19 + TypeScript 6 + Tailwind 4 project with design tokens from docs/03-DESIGN.md.
- Static app shell: status bar, three-column layout, 4×4 pad grid with keyboard hints, footer with version and commit.
- Vitest (unit, coverage thresholds), Playwright (Chromium, Firefox, WebKit) with axe accessibility checks.
- ESLint, Prettier, size-limit budgets, Lighthouse CI config.
- `check:required-tests` enforces the roadmap's required test titles per phase.
- GitHub Actions: lint, format, typecheck, unit, build, size, e2e on every PR; deploy to GitHub Pages and Lighthouse on main.
- Decisions ADR-8 to ADR-11 (TypeScript pin, self-hosted fonts, contrast token fix, phase tracking).

### Spec
- Project specification written (docs/).
