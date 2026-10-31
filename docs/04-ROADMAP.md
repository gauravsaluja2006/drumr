# 04 — Roadmap: Phases, Tasks, Tests

Owner: Project manager. Status: Approved.

## How to read this

- Phases are sequential. Do not start phase N+1 until phase N meets the Definition of Done.
- Each phase is one pull request (or a small series) on a branch named `phase-N-<slug>`.
- "Required tests" lists test titles that **must exist and pass**; `pnpm check:required-tests` enforces their presence from the manifest at the bottom of this file.
- Estimates are for a single developer (human or AI) and are guidance, not commitments.

## Definition of Done (every phase)

- [ ] All tasks checked off; acceptance criteria demonstrated.
- [ ] All required tests for this phase exist and pass; **all tests from previous phases still pass**.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm build`, `pnpm size-limit` pass locally and in CI.
- [ ] Coverage thresholds met (`05-TESTING.md` §1.5).
- [ ] `docs/METRICS-LOG.md` has a row for this phase with the metrics CI printed.
- [ ] `CHANGELOG.md` has an entry under "Unreleased" for this phase.
- [ ] Any deviation from docs 01–07 is written back into the relevant doc in the same PR.
- [ ] Deployed preview checked manually in Chrome (and Safari for UI-only phases).

---

## Phase 0 — Scaffold, CI, deploy (est. 0.5 day)

Goal: an empty but fully wired project. "Hello Drumr" live on GitHub Pages with green CI.

Tasks:
1. `pnpm create vite` (react-ts), add Tailwind 4, Zustand, Zod, Vitest, Testing Library, Playwright, ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier, size-limit, vite-plugin-pwa (installed, not enabled yet), `@axe-core/playwright`, `@lhci/cli`.
2. `tsconfig` strict + `noUncheckedIndexedAccess`. Path alias `@/` → `src/`.
3. Repository layout from `02-ARCHITECTURE.md` §2 with placeholder `index.ts` files.
4. Theme tokens file from `03-DESIGN.md` §2; app renders the status bar with the name and an empty 4×4 grid of idle pads (static).
5. `scripts/check-required-tests.ts`: parses the manifest at the bottom of this file, greps `tests/**` and `scripts/**` test files for each title of phases `0..drumr.phase` (from `package.json`), exits 1 if missing.
6. `.github/workflows/ci.yml` as in `05-TESTING.md` §5, including Pages deploy and Lighthouse on `main`.
7. `size-limit` config with the budgets from `06-METRICS.md`.
8. `README.md` skeleton, `CHANGELOG.md`, `docs/METRICS-LOG.md` (empty table), MIT `LICENSE`.

Acceptance: CI green on a PR; site served at the Pages URL; Lighthouse ≥ 95 on the empty shell.

Required tests:
- `P0: app renders status bar and 16 pads` (component)
- `P0: smoke — page loads and shows title` (e2e, all 3 browsers)
- `P0: axe — no serious violations on initial screen` (e2e)

---

## Phase 1 — Audio engine core + on-screen playing (est. 2 days)

Goal: click/tap/keyboard plays samples from the test kit with velocity layers, round robins, and master volume. No MIDI yet.

Tasks:
1. `src/engine/audioContext.ts`: `IAudioContext` interface (subset used) + `createRealAudioContext()`.
2. `src/engine/velocity.ts`: `curve`, `layerFor`, `gainFor`, `pickRoundRobin` (pure).
3. `src/engine/Sampler.ts`: `loadKit(manifest, baseUrl, fetchImpl, onProgress)` → decodes all samples; `Map<path, AudioBuffer>`; reports bytes progress; LRU of 2 kits.
4. `src/engine/Voice.ts` + `AudioEngine.ts`: graph from `02` §4; `trigger(articulationId, velocity)`; voice pool with 64 cap and stealing; `setMasterGainDb`, `setGroupGainDb`; `stats()` hook in test mode.
5. `src/kits/schema.ts` (Zod) + `loader.ts` (fetch `index.json`, fetch manifest, validate).
6. `src/state/useKitStore.ts`, `useSettingsStore.ts` (master/group gains persisted to localStorage).
7. `src/input/keyboard.ts` and pointer handling on pads → `PadHit` events (keyboard velocity 100; pointer velocity from y-position).
8. `ui/PadGrid` with hit animation via `data-hit`/`--v` and rAF (no per-hit React state). Pads hard-wired to a temporary built-in mapping for the test kit (real mapping comes in Phase 3).
9. "Tap to start audio" overlay; resume on first gesture.
10. Master volume slider in the Mixer (group sliders in Phase 6).
11. Test kit fixture + `scripts/make-test-kit.ts`.

Implementation notes (as built):
- `pnpm make:test-kit [--public]` generates two synthetic kits (`test-kit`, `test-kit-b`) into `tests/fixtures/kits/`; `--public` also copies them to `public/kits/` so the Phase 1 deploy has something to play. Phase 2 replaces `public/kits/` with real kits and points e2e at the fixtures via `VITE_KITS_BASE_URL`.
- Temporary pad wiring lives in `src/app/tempMapping.ts` (Kick, Snare, HH Closed, HH Open repeating across rows). Delete it in Phase 3.
- Hit feedback is owned by `src/ui/PadGrid/padFlash.ts` (rAF, `--v`, `data-hit`, `data-hit-count`), not React state.
- Playwright uses a dedicated port (4179) and never reuses an existing server, so a stale preview cannot mask a test build.

Acceptance: In the deployed preview with the test kit, pressing `1` plays the kick, clicking pads plays with position-based velocity, master slider works, pads flash with velocity-scaled intensity.

Required tests:
- `P1: velocity.curve matches logic.js values for 1, 28, 64, 100, 127` (unit; expected outputs computed from the formula: 1→28, 28→68, 64→95, 100→115, 127→127)
- `P1: velocity.layerFor returns the layer containing v and throws on gaps` (unit)
- `P1: pickRoundRobin never returns the same index twice in a row when >1 samples` (unit)
- `P1: Sampler.loadKit decodes every sample and reports monotonic progress to totalBytes` (unit, fake fetch + fake context)
- `P1: AudioEngine.trigger starts a source at currentTime with gain = velocity gain × articulation gain` (unit)
- `P1: AudioEngine steals the oldest voice in group when 64 voices are active` (unit)
- `P1: AudioEngine.setMasterGainDb(-6) sets master gain to 0.501` (unit)
- `P1: kit schema rejects overlapping layers, gaps, unknown chokedBy, non-relative paths` (unit)
- `P1: PadGrid sets data-hit and --v on a pad within one rAF of a PadHit` (component)
- `P1: keyboard key "1" maps to pad 0 and "v" maps to pad 15` (unit)
- `US-01: default kit loads with progress and first pad is playable` (e2e)
- `US-02: clicking pad 1 triggers a sound and flashes the pad` (e2e, uses `stats().lastTrigger`)
- `US-02: pressing key "q" triggers pad 4` (e2e)
- `R2: 64-voice cap with stealing` (unit, listed again as metric gate)

---

## Phase 2 — Kit pipeline and real kits (est. 2 days)

Goal: three real kits in `public/kits/`, selectable in the UI, with attribution.

Tasks:
1. Implement `scripts/kit-pipeline` per `07-KIT-PIPELINE.md` (build, verify, index). Share `src/kits/schema.ts`.
2. Recipes for `avl-black-pearl`, `virtuosity-jazz`, `big-rusty-rock` (`oh` only first; add `mix` only if needed).
3. Download sources per `KITS.md`, run the pipeline, commit outputs. Check sizes against `06` S3.
4. `ui/KitSelector` with loading progress bar; `useKitStore.switchKit(id)`; pads disabled while loading; previously loaded kit stays resident (LRU 2).
5. `ui/About` panel with sources table generated from manifests (`license`, `attribution`).
6. Kit folder `LICENSE.txt` for CC-BY-SA kits; README licensing section.

Implementation notes (as built):
- `vite build --mode test` copies `tests/fixtures/kits` to `dist/test-kits/` and `.env.test` points `VITE_KITS_BASE_URL` there, so e2e never loads the real kits.
- Kit selector is a listbox (`aria-activedescendant`); pad keys do not leak out of the open list. About is a slide-over `Dialog` primitive reused later.
- See `docs/07-KIT-PIPELINE.md` §8 for pipeline deviations.

Acceptance: All three kits play from the deployed site; sizes within budget; switching kits mid-play has no errors; About shows attributions.

Required tests:
- `P2: pipeline captures {layer} and {rr} and subsamples layers keeping lowest and highest` (unit)
- `P2: pipeline derives contiguous velocity ranges covering 1-127` (unit)
- `P2: pipeline trim keeps the first transient within 1 ms of file start` (unit, real ffmpeg on fixture)
- `P2: pipeline normalisation offset brings reference peak to -6 dBFS ±1 dB` (unit)
- `P2: pipeline verify fails on missing file, overlap, over-budget, unknown chokedBy` (unit)
- `P2: public/kits/index.json entries all have manifests that validate and total ≤ 120 MB` (unit, reads repo files)
- `US-08: switching kit while playing completes without errors and old voices keep ringing` (e2e, test kit + second test kit fixture)
- `US-13: About panel lists every kit with license and link` (e2e)
- `S4: time to first playable ≤ 3 s at 50 Mbps` (e2e Chromium, test kit; real-kit number recorded manually in METRICS-LOG)

---

## Phase 3 — Web MIDI input and Maschine preset (est. 1.5 days)

Goal: a USB controller plays the kit using the `logic.js` layout.

Tasks:
1. `src/midi/parse.ts`: status byte decode (note on/off incl. velocity-0, CC, running status tolerated; ignore everything else).
2. `src/midi/MidiManager.ts`: `init(requestMIDIAccess)`, `inputs$`, `select(id)`, hot-plug via `statechange`, auto-select when exactly one input, remember last device id, `onMessage` callback. Errors mapped per `02` §6.
3. `src/mapping/voices.ts`, `schema.ts`, `presets/maschine-logic.json` (exact table from `02` §3.3), `presets/generic-gm.json` (GM notes 36–51 on a 4×4), `resolve.ts` with the fallback table.
4. `useMappingStore`: active mapping, preset selection, persistence.
5. Wire `MidiManager.onMessage` → mapping → `engine.trigger` synchronously; UI update via rAF.
6. `ui/MidiStatus` pill + device picker; unsupported/denied banners; keyboard mode remains active always.
7. Velocity curve settings (exponent/floor) in `useSettingsStore`, applied to MIDI only (keyboard/pointer bypass the curve).
8. `ui/VelocityPanel` with curve plot and last-hit dot.
9. Replace Phase 1's temporary pad wiring with the mapping store; on-screen pads show labels and note numbers from the mapping; unavailable pads dimmed per resolver.

Acceptance: With a real Maschine in MIDI mode, all 16 pads play the voices listed in `logic.js`; device hot-plug works; Safari shows the unsupported banner.

Required tests:
- `P3: parse decodes note on, note off, velocity-0 note on as off, CC, and ignores sysex/clock` (unit)
- `P3: MidiManager auto-selects the only input and emits connected state` (unit, FakeMidiAccess)
- `P3: MidiManager handles hot-plug add/remove and falls back to "no device"` (unit)
- `P3: MidiManager remembers last device id and reselects it on reconnect` (unit)
- `P3: resolve returns exact match, documented fallbacks, and null for unavailable` (unit, table-driven over the whole fallback table)
- `P3: mapping schema rejects duplicate notes, out-of-grid pads, unknown voices` (unit)
- `P3: maschine-logic preset matches logic.js PAD_ALIASES for notes 24-39` (unit; assert each note's voice)
- `US-03: fake device appears, is auto-selected, status shows its name` (e2e)
- `US-04: fake note-on 25 velocity 100 triggers snare.center with curved velocity 115` (e2e)
- `US-05: all 16 Maschine notes trigger the expected voices` (e2e, table-driven)
- `US-12: with requestMIDIAccess removed the banner shows and keyboard still plays` (e2e)
- `US-12: with permission denied the banner shows Retry` (e2e)
- `L1: 200 fake note-ons have median event-to-schedule ≤ 2 ms and p95 ≤ 5 ms` (e2e Chromium)
- `R1: 500 note-ons at 10 ms intervals all trigger` (e2e Chromium)

---

## Phase 4 — Hi-hat model: openness and choke (est. 1.5 days)

Goal: CC-controlled openness and realistic choking.

Tasks:
1. `src/engine/HiHat.ts`: band logic from `02` §3.5; `setCC(value)`, `setInvert`, `levelIndex(levels)`, `currentArticulation(kit)`.
2. `src/engine/Choke.ts`: on `trigger`, look up `chokedBy` of all active voices; fade and stop per `02` §3.6. Generalised so crash chokes (`crash.leftChoke` → chokes `crash.left`) work from manifest data alone.
3. `hihat.cc` resolution in `resolve.ts` using `HiHat` state.
4. CC routing: `MidiManager` CC messages with `controller === mapping.hihat.cc` → `HiHat.setCC`; other CCs ignored.
5. `ui/HiHatMeter` (vertical meter, bands, label, CC select, invert).
6. Pad "sounding-open-hat" ring state driven by engine events (`voiceStarted`/`voiceEnded`/`voiceChoked`).
7. Optional flag `pedalOnClose` (default off) in settings.

Acceptance: On a real controller with CC1 strip: sweeping the strip changes which sample the open-hat pad plays; hitting closed/shank/pedal pads chokes ringing open hats; ring indicator appears/disappears.

Required tests:
- `P4: HiHat band mapping reproduces logic.js updateHiHat thresholds for invert on and off` (unit, all 7 bands × 2)
- `P4: HiHat maps 7 bands onto 2, 3, 4 and 6 available levels monotonically` (unit)
- `P4: Choke fades every voice whose chokedBy includes the new articulation and leaves others` (unit)
- `P4: Choke uses setTargetAtTime(0, now, 0.012) and stop(now + 0.08)` (unit)
- `P4: crash.leftChoke chokes crash.left without playing a sample` (unit)
- `P4: resolve(hihat.cc) returns the openness level for the current CC band` (unit)
- `US-06: CC1 sweep changes the articulation triggered by the open-hat pad` (e2e, 4 values)
- `US-07: closed hit chokes ringing open hat within 40 ms` (e2e via `stats().chokes` and active voices)
- `US-07: open hit does not choke another open hit` (e2e)
- `R3: choke timing` (unit alias of the setTargetAtTime test)

---

## Phase 5 — Mapping editor, presets, import/export (est. 1.5 days)

Goal: users can remap pads with MIDI learn and carry mappings between machines.

Tasks:
1. `ui/MappingEditor`: modal panel; pad selection; Note input + Learn (listens to next note-on from the selected device, 10 s timeout); Voice select grouped by family with search; Label input; live apply.
2. Preset menu: built-ins + "Custom" entries saved to localStorage; rename/delete custom presets.
3. Export: `drumr-mapping-<name>.json`; Import: file picker, Zod validate, show issues dialog, apply on success.
4. Grid size stays 4×4 in v1 but the schema and components read `grid.rows/cols` so 2×8 or 4×8 is a data change later.
5. Keyboard shortcuts: `E` toggles editor, `Esc` closes.

Acceptance: Remap a pad via learn, reload, mapping persists; export then import on a fresh profile reproduces it; invalid file rejected with reasons.

Required tests:
- `P5: MappingEditor learn assigns the next note-on and times out after 10 s` (component with fake timers)
- `P5: custom preset saves to localStorage and reloads` (unit on store)
- `P5: import rejects invalid JSON with readable issues and does not change the active mapping` (unit)
- `US-09: learn flow end-to-end with fake MIDI, persists across reload` (e2e)
- `US-10: export then import round-trips the mapping` (e2e, download + setInputFiles)
- `Q6: axe — editor open has no serious violations` (e2e)

---

## Phase 6 — Sound controls (est. 1 day)

Goal: simple, pleasant mixing without touching audio quality.

Tasks:
1. Group gain sliders (kick, snare, hihat, toms, cymbals, perc) + mute, in dB, double-click reset; persisted per kit id.
2. Safety limiter node in the graph with "reduction" readout in debug panel.
3. Slider primitive: pointer + keyboard (arrows, Home/End), `aria-valuetext` in dB.
4. Pad-level quick mute on right-click (optional; skip if time-boxed).

Acceptance: Changing a group slider affects only that group's next hits; no zipper noise (gains use `setTargetAtTime` with 10 ms constant); settings persist per kit.

Required tests:
- `P6: setGroupGainDb affects only the group node and uses a 10 ms smoothing constant` (unit)
- `P6: Slider is keyboard operable and reports aria-valuetext in dB` (component)
- `P6: group gains persist per kit id` (unit)
- `US-11: moving the hi-hat slider to -12 dB changes hi-hat voice gain and persists` (e2e)

---

## Phase 7 — Polish, PWA, performance (est. 2 days)

Goal: portfolio-grade finish and offline support.

Tasks:
1. Implement every component state in `03-DESIGN.md` §4; responsive breakpoints §3; motion §5 incl. `prefers-reduced-motion`.
2. PWA: app shell precached; kits cached on first load with a runtime cache (CacheFirst, max 4 kits); "Available offline" indicator.
3. Debug panel (`` ` ``) with latency stats, limiter reduction, voices, buffers.
4. Open Graph image, favicon set, `manifest.webmanifest`, footer version + commit hash.
5. Performance pass: code-split About/MappingEditor; verify S1/S2; verify F1 with the rAF counter; lazy decode (decode default kit first, others on demand).
6. Visual regression baselines (Chromium) for: idle grid, hit pad, unavailable pad, editor open, phone layout.

Acceptance: All `06-METRICS.md` targets met in CI and logged; offline reload works; design review against `03-DESIGN.md` done by the author.

Required tests:
- `P7: service worker precaches app shell and runtime-caches kit samples` (e2e, Chromium, `page.context().serviceWorkers()`)
- `US-15: reload with network offline still plays the last kit` (e2e, `context.setOffline(true)`)
- `US-14: debug panel shows latency median and p95` (e2e)
- `F1: ≥ 55 fps during 200 hits in 5 s` (e2e Chromium)
- `P7: visual — idle grid matches baseline` (e2e screenshot)
- `P7: visual — phone layout matches baseline` (e2e screenshot, 390×844)
- `P7: reduced motion disables glow and scale` (component, matchMedia mock)

---

## Phase 8 — Release 1.0 and portfolio packaging (est. 0.5 day)

Tasks:
1. Run the manual checklist in `05-TESTING.md` §6 with real hardware; record in `CHANGELOG.md`.
2. README: hero GIF (record with the app, 10 s), badges, "Try it", architecture diagram, metrics table from `METRICS-LOG.md`, licensing section, "How it was built" (link to docs).
3. Tag `v1.0.0`; GitHub release notes.
4. Optional: custom domain.

Required tests: none new; full suite green on the tag.

---

## Backlog (v2 candidates, not scheduled)

Metronome; simple room reverb (convolution, per-kit IR); user-uploaded samples; 4×8 and 8×8 grids; MIDI note-off driven choke for cymbals; multi-mic mix slider for kits that have it; recording to WAV; Android Web MIDI testing; i18n.

---

## Required-test manifest (machine-read by `scripts/check-required-tests.ts`)

```required-tests
phase: 0
P0: app renders status bar and 16 pads
P0: smoke — page loads and shows title
P0: axe — no serious violations on initial screen
phase: 1
P1: velocity.curve matches logic.js values for 1, 28, 64, 100, 127
P1: velocity.layerFor returns the layer containing v and throws on gaps
P1: pickRoundRobin never returns the same index twice in a row when >1 samples
P1: Sampler.loadKit decodes every sample and reports monotonic progress to totalBytes
P1: AudioEngine.trigger starts a source at currentTime with gain = velocity gain × articulation gain
P1: AudioEngine steals the oldest voice in group when 64 voices are active
P1: AudioEngine.setMasterGainDb(-6) sets master gain to 0.501
P1: kit schema rejects overlapping layers, gaps, unknown chokedBy, non-relative paths
P1: PadGrid sets data-hit and --v on a pad within one rAF of a PadHit
P1: keyboard key "1" maps to pad 0 and "v" maps to pad 15
US-01: default kit loads with progress and first pad is playable
US-02: clicking pad 1 triggers a sound and flashes the pad
US-02: pressing key "q" triggers pad 4
R2: 64-voice cap with stealing
phase: 2
P2: pipeline captures {layer} and {rr} and subsamples layers keeping lowest and highest
P2: pipeline derives contiguous velocity ranges covering 1-127
P2: pipeline trim keeps the first transient within 1 ms of file start
P2: pipeline normalisation offset brings reference peak to -6 dBFS ±1 dB
P2: pipeline verify fails on missing file, overlap, over-budget, unknown chokedBy
P2: public/kits/index.json entries all have manifests that validate and total ≤ 120 MB
US-08: switching kit while playing completes without errors and old voices keep ringing
US-13: About panel lists every kit with license and link
S4: time to first playable ≤ 3 s at 50 Mbps
phase: 3
P3: parse decodes note on, note off, velocity-0 note on as off, CC, and ignores sysex/clock
P3: MidiManager auto-selects the only input and emits connected state
P3: MidiManager handles hot-plug add/remove and falls back to "no device"
P3: MidiManager remembers last device id and reselects it on reconnect
P3: resolve returns exact match, documented fallbacks, and null for unavailable
P3: mapping schema rejects duplicate notes, out-of-grid pads, unknown voices
P3: maschine-logic preset matches logic.js PAD_ALIASES for notes 24-39
US-03: fake device appears, is auto-selected, status shows its name
US-04: fake note-on 25 velocity 100 triggers snare.center with curved velocity 115
US-05: all 16 Maschine notes trigger the expected voices
US-12: with requestMIDIAccess removed the banner shows and keyboard still plays
US-12: with permission denied the banner shows Retry
L1: 200 fake note-ons have median event-to-schedule ≤ 2 ms and p95 ≤ 5 ms
R1: 500 note-ons at 10 ms intervals all trigger
phase: 4
P4: HiHat band mapping reproduces logic.js updateHiHat thresholds for invert on and off
P4: HiHat maps 7 bands onto 2, 3, 4 and 6 available levels monotonically
P4: Choke fades every voice whose chokedBy includes the new articulation and leaves others
P4: Choke uses setTargetAtTime(0, now, 0.012) and stop(now + 0.08)
P4: crash.leftChoke chokes crash.left without playing a sample
P4: resolve(hihat.cc) returns the openness level for the current CC band
US-06: CC1 sweep changes the articulation triggered by the open-hat pad
US-07: closed hit chokes ringing open hat within 40 ms
US-07: open hit does not choke another open hit
R3: choke timing
phase: 5
P5: MappingEditor learn assigns the next note-on and times out after 10 s
P5: custom preset saves to localStorage and reloads
P5: import rejects invalid JSON with readable issues and does not change the active mapping
US-09: learn flow end-to-end with fake MIDI, persists across reload
US-10: export then import round-trips the mapping
Q6: axe — editor open has no serious violations
phase: 6
P6: setGroupGainDb affects only the group node and uses a 10 ms smoothing constant
P6: Slider is keyboard operable and reports aria-valuetext in dB
P6: group gains persist per kit id
US-11: moving the hi-hat slider to -12 dB changes hi-hat voice gain and persists
phase: 7
P7: service worker precaches app shell and runtime-caches kit samples
US-15: reload with network offline still plays the last kit
US-14: debug panel shows latency median and p95
F1: ≥ 55 fps during 200 hits in 5 s
P7: visual — idle grid matches baseline
P7: visual — phone layout matches baseline
P7: reduced motion disables glow and scale
```
