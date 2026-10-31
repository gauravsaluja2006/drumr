# 02 — Architecture and Technical Specification

Owner: Tech lead. Status: Approved for Phase 0.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript 6.0 (pinned `~6.0`, see ADR-8), `strict: true`, `noUncheckedIndexedAccess: true` | Catch mapping/schema mistakes at compile time |
| Build | Vite 8 | Fast, static output, trivial GitHub Pages deploy |
| UI | React 19 + function components + hooks | Author familiarity; large ecosystem for testing |
| Styling | Tailwind CSS 4 + CSS variables for theme tokens | Fast iteration, consistent design tokens (`03-DESIGN.md`) |
| State | Zustand (one store per domain: `useKitStore`, `useMidiStore`, `useMappingStore`, `useSettingsStore`) | Tiny, no boilerplate, works outside React (audio engine needs it) |
| Audio | Web Audio API, no wrapper library | Lowest latency, full control, nothing to learn for readers |
| MIDI | Web MIDI API, no wrapper library | Same |
| Schema validation | Zod | Kit manifests and imported mappings are untrusted JSON |
| Unit tests | Vitest + @testing-library/react + jsdom | Fast, Vite-native |
| E2E tests | Playwright (Chromium, Firefox, WebKit) | Can inject fake `navigator.requestMIDIAccess`; cross-browser |
| Lint/format | ESLint (typescript-eslint, react-hooks, jsx-a11y) + Prettier | CI gate |
| Bundle budget | `size-limit` | CI gate (`06-METRICS.md`) |
| Lighthouse | `@lhci/cli` against the preview build | CI gate |
| CI/CD | GitHub Actions | Free; deploys `main` to GitHub Pages |
| PWA | `vite-plugin-pwa` (Workbox) | Offline app shell + kit caching (Phase 7) |
| Kit pipeline | Node script + `ffmpeg` (via `ffmpeg-static`) | Offline tool, not shipped to browser |

Node 24 (engines `>=22`), pnpm 12 (`packageManager` field). Pin versions in `package.json`; commit the lockfile.

## 2. Repository layout

```
drumr/
├── CLAUDE.md                  # operating rules for implementers
├── README.md
├── KITS.md                    # researched source libraries
├── docs/                      # this specification
├── public/
│   └── kits/                  # generated kits (audio + manifest.json), committed
│       ├── index.json         # list of available kits
│       ├── avl-black-pearl/
│       │   ├── manifest.json
│       │   └── samples/*.flac
│       └── ...
├── scripts/
│   └── kit-pipeline/          # source library → public/kits (07-KIT-PIPELINE.md)
├── src/
│   ├── main.tsx
│   ├── app/                   # App shell, routing-free single page, providers
│   ├── engine/                # PURE audio engine, no React imports
│   │   ├── AudioEngine.ts     # owns AudioContext, graph, voice pool
│   │   ├── Voice.ts           # one playing sample (source + gain)
│   │   ├── Sampler.ts         # kit buffers, layer/RR selection
│   │   ├── Choke.ts           # choke groups
│   │   ├── HiHat.ts           # openness state machine
│   │   ├── velocity.ts        # curve + gain mapping (pure functions)
│   │   ├── types.ts
│   │   └── audioContext.ts    # thin interface over AudioContext for mocking
│   ├── midi/                  # PURE MIDI layer, no React imports
│   │   ├── MidiManager.ts     # device enumeration, hot-plug, message parsing
│   │   ├── parse.ts           # Uint8Array → MidiMessage (pure)
│   │   └── types.ts
│   ├── mapping/               # logical voice vocabulary, presets, resolver
│   │   ├── voices.ts          # canonical voice ids
│   │   ├── presets/           # maschine-logic.json, generic-gm.json
│   │   ├── resolve.ts         # voice → kit articulation with fallbacks (pure)
│   │   └── schema.ts          # Zod schema for mapping files
│   ├── kits/                  # manifest loading, caching, schema
│   │   ├── schema.ts
│   │   ├── loader.ts
│   │   └── index.ts
│   ├── state/                 # Zustand stores
│   ├── ui/                    # React components (presentational + containers)
│   │   ├── PadGrid/
│   │   ├── KitSelector/
│   │   ├── MidiStatus/
│   │   ├── HiHatMeter/
│   │   ├── Mixer/
│   │   ├── MappingEditor/
│   │   ├── About/
│   │   ├── DebugPanel/
│   │   └── primitives/        # Button, Slider, Select, Dialog, Toast
│   ├── input/                 # keyboard + pointer → pad events
│   └── lib/                   # small utils (db↔gain, clamp, storage)
├── tests/
│   ├── unit/                  # mirrors src/
│   ├── e2e/                   # Playwright specs + fixtures/fakeMidi.ts
│   └── fixtures/              # tiny test kit (3 short WAVs) + manifests
└── .github/workflows/ci.yml
```

Rule: `src/engine`, `src/midi`, `src/mapping`, `src/kits` must not import React or DOM-only globals except through the injectable interfaces in `audioContext.ts`/`MidiManager.ts`. This is what makes them unit-testable.

## 3. Core concepts

### 3.1 Logical voices (`src/mapping/voices.ts`)

Mappings never reference kit-specific file names. They reference a fixed vocabulary so a mapping survives kit switches.

```
kick
snare.center  snare.edge  snare.rimshot  snare.sidestick
tom.high  tom.highMid  tom.lowMid  tom.low
hihat.closed  hihat.half  hihat.threeQuarter  hihat.open
hihat.pedal  hihat.splash  hihat.shank          # shank = closed hit with stick shoulder
hihat.cc                                        # special: openness chosen by CC (see 3.4)
ride.bow  ride.bell  ride.edge
crash.left  crash.right  crash.leftChoke  crash.rightChoke
china  splash
clap  tambourine  shaker  cowbell  stick
```

### 3.2 Kit manifest (`public/kits/<id>/manifest.json`)

Produced by the pipeline, validated with Zod at load.

```jsonc
{
  "schemaVersion": 1,
  "id": "virtuosity-jazz",
  "name": "Virtuosity Jazz Kit",
  "description": "Contemporary jazz kit, sticks. Six mic positions mixed to stereo.",
  "license": { "name": "CC0-1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/" },
  "attribution": { "author": "Versilian Studios / Karoryfer", "url": "https://versilian-studios.com/virtuosity-drums/" },
  "sampleRate": 44100,
  "format": "flac",
  "totalBytes": 24816000,
  "groups": ["kick", "snare", "hihat", "toms", "cymbals", "perc"],
  "articulations": [
    {
      "id": "hihat.half",            // uses the logical voice vocabulary when it matches
      "group": "hihat",
      "chokeGroup": "hihat",         // sounding voices in this group can be choked
      "chokedBy": ["hihat.closed", "hihat.pedal", "hihat.shank"],
      "gainDb": 0,
      "layers": [                    // ascending velocity ranges, inclusive
        { "lovel": 1,  "hivel": 40,  "samples": ["samples/hh_half_v1_rr1.flac", "samples/hh_half_v1_rr2.flac"] },
        { "lovel": 41, "hivel": 80,  "samples": ["samples/hh_half_v2_rr1.flac"] },
        { "lovel": 81, "hivel": 127, "samples": ["samples/hh_half_v3_rr1.flac"] }
      ]
    }
  ],
  "hihat": {
    "openness": ["hihat.closed", "hihat.half", "hihat.threeQuarter", "hihat.open"],  // ordered closed→open
    "pedal": "hihat.pedal",
    "splash": "hihat.splash"
  }
}
```

Constraints enforced by schema: layers cover 1–127 with no gaps or overlaps; every `chokedBy` id exists; `hihat.openness` has ≥ 2 entries that all exist; sample paths are relative and end in `.flac` or `.wav`.

`public/kits/index.json`: `[{ "id", "name", "description", "totalBytes", "thumbnail"? }]`.

### 3.3 Mapping file (`src/mapping/schema.ts`)

```jsonc
{
  "schemaVersion": 1,
  "name": "Maschine 4x4 (Logic)",
  "grid": { "rows": 4, "cols": 4 },
  "pads": [
    { "row": 3, "col": 0, "note": 24, "voice": "kick",         "label": "Kick" },
    { "row": 3, "col": 1, "note": 25, "voice": "snare.center", "label": "Snare" },
    { "row": 3, "col": 2, "note": 26, "voice": "hihat.shank",  "label": "HH Shank" },
    { "row": 3, "col": 3, "note": 27, "voice": "hihat.closed", "label": "HH Tip" },
    { "row": 2, "col": 0, "note": 28, "voice": "kick" },
    { "row": 2, "col": 1, "note": 29, "voice": "snare.rimshot" },
    { "row": 2, "col": 2, "note": 30, "voice": "snare.sidestick" },
    { "row": 2, "col": 3, "note": 31, "voice": "hihat.cc" },
    { "row": 1, "col": 0, "note": 32, "voice": "tom.high" },
    { "row": 1, "col": 1, "note": 33, "voice": "tom.highMid" },
    { "row": 1, "col": 2, "note": 34, "voice": "tom.lowMid" },
    { "row": 1, "col": 3, "note": 35, "voice": "tom.low" },
    { "row": 0, "col": 0, "note": 36, "voice": "crash.left" },
    { "row": 0, "col": 1, "note": 37, "voice": "crash.right" },
    { "row": 0, "col": 2, "note": 38, "voice": "ride.bow" },
    { "row": 0, "col": 3, "note": 39, "voice": "ride.bell" }
  ],
  "velocity": { "exponent": 2.4, "floor": 28 },
  "hihat": { "cc": 1, "invert": true },
  "channel": null                      // null = omni
}
```

Row 0 is the **top** row on screen. Maschine pad 1 (note 24) is bottom-left, so it is `row: 3, col: 0`. This matches `PAD_ALIASES` in `logic.js` ("Row 1" there is the bottom row of the hardware).

### 3.4 Voice resolution (`src/mapping/resolve.ts`, pure)

`resolve(voice, kit, hihatState) → articulationId | null`

1. `hihat.cc` → pick `kit.hihat.openness[i]` where `i` is derived from the current CC band (3.5).
2. Exact match: if `kit.articulations` has `voice`, use it.
3. Fallback table (first available wins):
   - `snare.edge → snare.center`; `snare.rimshot → snare.center`; `snare.sidestick → snare.rimshot → snare.center`
   - `tom.highMid → tom.high`; `tom.lowMid → tom.low`; any tom → nearest existing tom by order `[high, highMid, lowMid, low]`
   - `hihat.threeQuarter → hihat.open`; `hihat.half → hihat.threeQuarter → hihat.open`; `hihat.shank → hihat.closed`; `hihat.splash → hihat.open`; `hihat.pedal → hihat.closed`
   - `ride.edge → ride.bow`; `ride.bell → ride.bow`
   - `crash.right → crash.left`; `crash.*Choke → null` (silent, performs choke only)
   - `china → crash.left`; `splash → crash.left`
   - `clap|tambourine|shaker|cowbell|stick → null`
4. `null` → pad shows as "unavailable in this kit" (dimmed) and plays nothing.

### 3.5 Hi-hat openness (`src/engine/HiHat.ts`)

State: `ccValue` (0–127), `invert`, `levelsAvailable = kit.hihat.openness.length`.

Band index from `logic.js` (7 bands, value > 114 → band 6 ... ≤ 14 → band 0) where band 0 = closed and band 6 = fully open after applying `invert`. Map band 0..6 onto `0..levelsAvailable-1` with `round(band * (levels-1) / 6)`.

Pads mapped to `hihat.closed`, `hihat.shank`, `hihat.pedal` ignore CC. Pads mapped to `hihat.cc` use the band. Pads mapped to a fixed openness (e.g. `hihat.half`) ignore CC.

Optional (Phase 4, flagged): when CC crosses from band ≥ 1 to band 0 while an open hat is sounding, trigger `hihat.pedal` at velocity 60 and choke. Default off.

### 3.6 Choke (`src/engine/Choke.ts`)

When an articulation with `chokeGroup` G starts, and it is listed in another sounding voice's `chokedBy`, that voice is released: gain ramps `setTargetAtTime(0, now, 0.012)` (≈ 40 ms to −60 dB) then the source stops at `now + 0.08`. Voices with the same `chokeGroup` but not in `chokedBy` are left alone (open hat does not choke open hat).

### 3.7 Velocity (`src/engine/velocity.ts`, pure)

```
curve(v, {exponent, floor}) = max(floor, round(127 * (v/127)^(1/exponent)))     // identical to logic.js
layerFor(v, layers) = the layer with lovel ≤ v ≤ hivel
gainFor(v) = (v/127)^1.0  applied as linear gain, then articulation gainDb, group gain, master gain
```
Round robin: per articulation+layer keep `lastIndex`; pick uniformly among the others when `samples.length > 1`.

## 4. Audio graph

```
Voice: AudioBufferSourceNode → GainNode(velocity × articulation)  ─┐
                                                                     ├→ GroupGain[kick|snare|hihat|toms|cymbals|perc] → MasterGain → DynamicsCompressor(safety limiter: threshold −3 dB, ratio 20, knee 0) → destination
```

- `AudioContext({ latencyHint: 'interactive' })`, created/resumed on first user gesture (browser autoplay policy). A "Tap to start audio" overlay appears until `state === 'running'`.
- All buffers decoded once per kit with `decodeAudioData`, held in `Map<samplePath, AudioBuffer>`. Max two kits resident; LRU evict.
- Polyphony cap 64 voices; when exceeded, steal the oldest voice in the same group with a 5 ms fade.
- Note-off is ignored for drums (one-shots) except for the choke rules.
- Scheduling: `source.start(ctx.currentTime)` immediately; no look-ahead. Event-to-schedule time is measured and shown in the debug panel (`06-METRICS.md`).

## 5. MIDI flow

```
navigator.requestMIDIAccess({ sysex: false })
  → MidiManager enumerates inputs, listens to `statechange` for hot-plug
  → selected input `onmidimessage` → parse(Uint8Array) → MidiMessage
      { type: 'noteon'|'noteoff'|'cc', channel, note|controller, velocity|value, timeStamp }
  → noteon with velocity 0 is treated as noteoff
  → mapping lookup: note (and channel if set) → pad → voice
  → engine.trigger(voice, curve(velocity))   (synchronous, same JS task)
  → UI store update is batched via requestAnimationFrame (never block the audio trigger on React)
```

Keyboard and pointer input produce the same `PadHit { padIndex, velocity }` events as MIDI, through `src/input/`. Keyboard velocity is fixed 100; pointer velocity is derived from vertical hit position within the pad (top = 60, bottom = 127) to make the demo expressive.

Device selection, last device id, mapping, settings are persisted in `localStorage` under the key prefix `drumr.v1.`.

## 6. Error handling

| Situation | Behaviour |
|---|---|
| `navigator.requestMIDIAccess` undefined | Banner "MIDI not supported in this browser. Use keyboard or tap the pads." Keyboard mode on. |
| Permission denied | Banner with "Retry" button |
| Kit manifest fails schema | Toast with kit id + first Zod issue; kit removed from selector; previous kit remains |
| Sample 404 or decode error | Articulation marked unavailable (pad dimmed with tooltip); kit still usable |
| AudioContext suspended | Overlay "Tap to start audio" |
| Imported mapping invalid | Dialog listing issues; nothing applied |

## 7. Build and deploy

- `pnpm dev` / `pnpm build` / `pnpm preview`.
- `vite.config.ts` sets `base` from `VITE_BASE_PATH` (default `/`, GitHub Pages uses `/drumr/`).
- `VITE_KITS_BASE_URL` (default `${base}kits/`) so kits can move to a CDN later without code changes.
- GitHub Actions `ci.yml`: on PR → lint, typecheck, unit (with coverage), build, size-limit, e2e. On push to `main` → same + deploy to GitHub Pages + Lighthouse CI against the deployed URL.

## 8. Decision log (ADRs)

| # | Decision | Alternatives rejected | Reason |
|---|---|---|---|
| ADR-1 | FLAC for shipped samples | MP3, Opus, WAV | Lossless, zero encoder delay/priming (MP3/AAC/Opus add leading samples that decoders handle inconsistently), ~55 % of WAV size, decodable by `decodeAudioData` in Chrome, Firefox, Safari |
| ADR-2 | Kits committed to the repo under `public/kits/` | Git LFS, R2/S3 bucket | GitHub Pages does not serve LFS; a bucket adds infra; ≤ 120 MB total is acceptable. `VITE_KITS_BASE_URL` keeps migration a one-line change |
| ADR-3 | No audio/MIDI wrapper libraries | Tone.js, webmidi.js | Lower latency, smaller bundle, the APIs are small, and reading raw usage is a portfolio plus |
| ADR-4 | Mapping by logical voice, not by file | Per-kit mappings | One mapping works across every kit (US-08) |
| ADR-5 | Zustand over Redux/Context | Redux Toolkit, Context | Engine code must read/write state outside React with no re-render cost |
| ADR-6 | Playwright with injected fake MIDI | Manual testing only, jsdom only | The only way to automate US-03..US-07 end-to-end in CI |
| ADR-7 | Single-page, no router | React Router | One screen; About/Settings are panels |
| ADR-8 | Pin TypeScript to `~6.0` | TypeScript 7 (native Go compiler) | typescript-eslint 8.x peer range is `<6.1`; lint is a CI gate. Revisit when typescript-eslint supports TS 7 |
| ADR-9 | Self-host fonts with `@fontsource-variable/inter` and `jetbrains-mono` as dev dependencies | Google Fonts CDN | No third-party network calls (privacy constraint, offline PWA). Bundled at build time, so they are not runtime JS dependencies |
| ADR-10 | `--fg-2` changed from `#6b7280` to `#8a92a2` | Keep and avoid small text in `--fg-2` | Original failed 4.5:1 on `--bg-2` (Phase 0); `#7d8595` then failed on the `--bg-3` hover state (Phase 7, intermittent axe failure) |
| ADR-11 | Current phase recorded as `drumr.phase` in `package.json` | Separate file | `check:required-tests` checks every phase `0..drumr.phase`; bump it in the PR that starts a phase |
| ADR-12 | Velocity curve and hi-hat CC settings live in the mapping, not in global settings | `useSettingsStore` (roadmap Phase 3 task 7) | They are part of a player's setup for a controller and must travel with mapping export/import (US-10); the schema in §3.3 already contains them |
| ADR-13 | "Generic pads" preset uses notes 36–51 chromatic with GM voice names for those notes | Exact GM layout | Most pad controllers (Akai MPD/MPC, Arturia) default to 36–51 bottom-left upward; GM names keep it familiar |
| ADR-14 | Resolver fallbacks extended: `hihat.open → ¾ → half`, `crash.left ↔ crash.right`, toms search outward by distance | Doc table only | Avoids silent pads on kits that lack one cymbal or tom |
| ADR-15 | Audio overlay dismisses on the first click/key, even if audio cannot start | Stay until `running` | CI Firefox (no output device) never reaches `running`; users must never be blocked |
| ADR-16 | Hi-hat band = 7 − Drum Kit Designer articulation from logic.js `updateHiHat` | Re-derive thresholds | DKD articulation 7 is closed and 1 is open (logic.js forces closed pads to 7 with invert on). `invert: true` therefore means "high CC opens", the author's strip; `invert: false` means "high CC closes", standard for CC4 pedals. Verified by executing the original function in tests |
| ADR-17 | `pedalOnClose` stored in `mapping.hihat` (default false) | Global setting | Same reason as ADR-12 |
| ADR-18 | Before the first CC arrives, `hihat.cc` plays the most open level | Closed | Matches logic.js initial articulation 1 (open) |
| ADR-19 | Editor toggle key is `M`, not `E` | `E` (roadmap) | `E` is a pad key in the `qwer` row |
| ADR-20 | Assigning a note already used by another pad swaps the two notes | Reject, or clear the other pad | Keeps the mapping valid (no duplicate notes) without an error state mid-edit |
| ADR-21 | Voice picker is a native `<select>` with `<optgroup>` per family | Custom searchable combobox | 31 voices in 7 families fit a native select; native is accessible and works on touch. Revisit if voices grow |
| ADR-22 | In edit mode, any hit (MIDI, keyboard, pointer) selects that pad and still plays it | Silent selection | Lets the player audition and pick pads straight from the controller |
| ADR-23 | Engine records requested gains in `engine.gainDb` | Read `AudioParam.value` | `value` lags `setTargetAtTime` and never moves while the context is suspended (CI); tests and UI need the requested value |
| ADR-24 | Group mix stored as `settings.mix[kitId][group] = { db, muted }`; mixer only lists groups the kit has | One global mix | Kits are balanced differently; per-kit memory is what US-11 asks for |
| ADR-25 | Service worker registered with an injected script (`injectRegister: 'script-defer'`), not `virtual:pwa-register` | React hook from vite-plugin-pwa | Avoids adding `workbox-window` as a runtime dependency |
| ADR-26 | After a kit loads, the app copies its files into the Workbox runtime caches (`warmKitCache`) | Rely on runtime caching only | The first kit load happens before the worker controls the page, so it would never be cached and US-15 would fail on first visit |
| ADR-27 | Below 1024 px the side columns render as two tabs under the grid, chosen with `matchMedia` in JS | CSS-only hiding | Rendering both trees would duplicate controls (ids, tests, screen readers) |
| ADR-28 | Reduced motion handled in JS: `data-hit="reduced"` gives a 50 ms colour step with no glow or scale | CSS media query only | Testable in jsdom, and the same code path in every browser |
| ADR-29 | Size budget split: initial JS (`index-*.js`) ≤ 180 KB, all chunks ≤ 200 KB | One budget over all chunks | Lazy chunks (editor, About, debug) are not on the critical path |
| ADR-30 | Pad flash restarts by alternating keyframe names (`data-hit="a"/"b"`), glow and flash are opacity-only layers | `offsetWidth` reflow + animated `box-shadow` | No forced layout or repaint per hit; CI frame rate while playing rose from 48 to 54 fps on one run |
| ADR-31 | F1 frame-rate budget gated locally, recorded (not gated) in CI | Gate in CI | GitHub runner frame rate varies more between identical commits than the budget margin; not reproducible on any controlled machine |
