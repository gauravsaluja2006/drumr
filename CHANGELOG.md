# Changelog

## Unreleased

### Live playing: feel, sound and a simpler screen
- Soft hits keep their natural loudness: velocity now shapes level only within each recorded layer, instead of turning soft samples down a second time (ADR-40).
- Natural variation: every hit differs a touch in level (±1 dB) and pitch (±8 cents), so fast repeats never sound machine-gunned. On by default; Settings › Sound.
- Tune (±12 semitones) and length (10 % to natural) per drum, saved per kit.
- Deeper kits: Muldjord, ShittyKit and SM Drums rebuilt with 8–12 velocity layers, up to 3 alternate hits, and longer cymbal and tom tails.
- Every kit starts with a little room and hall (less on drum machines). "Reset to its recommended sound" undoes your changes (ADR-41).
- Simpler home screen: kits, pads, mixer and quick effect toggles. Everything else lives in the new Settings panel (header button or `,`): Sound, Playing and Controller tabs (ADR-42).
- Pads show their drum colour and flash in it; an output level meter with a clip light sits beside the master fader.

### Kit browser, kit rotation, MIDI controls, looper
- Effects: Room, Hall and Plate reverb and a tempo-synced Echo, any combination, with an amount for each. Remembered per kit, or "Use on all kits". Amounts are MIDI-learnable knobs. Reverb is sent mostly from snare, toms and cymbals and little from the kick, so the low end stays tight (ADR-39).
- New kit set: Muldjord, ShittyKit, SM Drums, Roland TR-808, TR-909 Detroit, Hard Trap and Bounce. Black Pearl, Virtuosity Jazz and Big Rusty Rock are removed. Licence status per kit in KITS.md (ADR-38).
- Looper: press Record loop (or `L`), then play: recording starts on your first pad hit. Press again to close the loop; it plays back from the first hit at once, with no gap. Overdub layers, undo, stop/play (`Shift+L`) and clear. Length "as played" or rounded to whole bars at the rotation tempo. Hi-hat pedal moves are recorded too, and playback is timed on the audio clock.
- Rotation can switch every 1/2/4 loop passes, exactly on the loop's downbeat, so each kit plays the whole loop. Turning rotation on while a loop plays (or recording a loop while it rotates) switches to every loop pass automatically.
- Loop actions are MIDI-learnable: record/close/overdub, play, stop (for controllers with Rec, Play and Stop buttons, such as Maschine), one-button stop/play, undo, clear.
- Kit list in the left column: every kit one click away, playing kit marked, current kit's name and description below it (licence and author stay in About). It replaces the kit dropdown in the status bar.
- Kit rotation: switch to the next kit every 10/15/30/60 seconds or every 1/2/4/8 bars at a typed or tapped tempo; while rotating, tick kits to narrow it to a shortlist (checkboxes show only while rotation is on). The next kit loads in the background so switches are instant; in bars mode they land just before the downbeat.
- Mixer moved under the pads as vertical faders.
- MIDI controls panel: learn controller buttons (next/previous kit, start/stop rotation, tap tempo, next pad layout, load highlighted kit), knobs (master and group volumes, sensitivity, hardest hit) and an encoder (scroll the kit list). Program change selects a kit. Assignments persist.
- Side columns scroll inside the window instead of pushing the footer over the controls on short screens.

### Phase 7 — Polish, offline, performance
- Works offline after the first visit (installable PWA); "Available offline" indicator.
- Tablet and phone layouts: controls in two tabs under the pads; tighter pad labels on small screens.
- Debug panel with latency, voices, limiter and buffer readouts (`` ` `` key).
- Reduced-motion support, app icons, social preview image, Open Graph tags.
- Editor, About and debug panels load on demand; initial JS 109 KB gzipped.
- Visual regression baselines for macOS and Linux; tertiary text contrast fixed on hover.

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
