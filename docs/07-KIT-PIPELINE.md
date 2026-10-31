# 07 — Kit Pipeline

Owner: Developer. Status: Approved.

Turns large source sample libraries (see `../KITS.md`) into small, consistent app kits in `public/kits/`. Runs offline on the developer's machine; never in the browser or in CI (sources are gigabytes).

## 1. Goals

- Each kit ≤ 30 MB, ≤ ~250 files, loads in ≤ 3 s cached / ≤ 15 s cold.
- Same loudness and format across kits.
- Full provenance: every output sample traceable to a source file; license and attribution in the manifest.
- Deterministic: same inputs + same recipe → byte-identical output (use fixed ffmpeg flags, sort inputs).

## 2. Tooling

`scripts/kit-pipeline/` (Node 20, TypeScript via `tsx`), `ffmpeg` via `ffmpeg-static`, `zod` for recipe validation.

```
pnpm kit:build <recipe.json>      # builds one kit into public/kits/<id>/
pnpm kit:verify <kitId>           # checks manifest schema, file presence, loudness, size budget
pnpm kit:index                    # regenerates public/kits/index.json
pnpm kit:build-all                # all recipes under scripts/kit-pipeline/recipes/
```

Sources are expected under `~/drumr-sources/<libraryId>/` (configurable with `DRUMR_SOURCES`). The README of the pipeline lists the exact download URLs from `KITS.md` and the expected folder names after extraction.

## 3. Recipe format (`scripts/kit-pipeline/recipes/<id>.json`)

```jsonc
{
  "id": "virtuosity-jazz",
  "name": "Virtuosity Jazz Kit",
  "description": "Contemporary jazz kit, sticks. 'Mid' mic mix.",
  "license": { "name": "CC0-1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/" },
  "attribution": { "author": "Versilian Studios / Karoryfer", "url": "https://versilian-studios.com/virtuosity-drums/" },
  "source": { "libraryId": "virtuosity", "root": "Samples/mid" },
  "output": { "format": "flac", "sampleRate": 44100, "bitDepth": 16, "channels": 2 },
  "budget": { "maxBytes": 30000000, "maxRoundRobins": 2, "maxVelocityLayers": 4 },
  "trim": { "startThresholdDb": -60, "endThresholdDb": -60, "maxSeconds": { "default": 2.5, "cymbals": 5.0 }, "fadeOutMs": 30 },
  "normalize": { "reference": "snare.center", "referenceVelocity": 127, "targetPeakDbfs": -6 },
  "articulations": [
    {
      "id": "hihat.half", "group": "hihat", "chokeGroup": "hihat",
      "chokedBy": ["hihat.closed", "hihat.pedal", "hihat.shank"],
      "glob": "hh/mid_hh_half_vl{layer}_rr{rr}.flac",     // {layer} and {rr} captured as integers
      "gainDb": 0
    },
    { "id": "kick", "group": "kick", "glob": "kick/mid_kick_vl{layer}.flac" }
  ],
  "hihat": { "openness": ["hihat.closed", "hihat.half", "hihat.threeQuarter", "hihat.open"], "pedal": "hihat.pedal", "splash": "hihat.splash" }
}
```

## 4. Steps (`build`)

1. **Validate recipe** (Zod). Fail with a readable error.
2. **Discover files** for each articulation glob; capture `layer` and `rr`. Sort numerically. If a source has more velocity layers than `budget.maxVelocityLayers`, pick evenly spaced layers (always keep the lowest and highest). If more round robins than `maxRoundRobins`, keep the first N.
3. **Derive velocity ranges**: split 1–127 evenly across the kept layers (e.g. 4 layers → 1–32, 33–64, 65–96, 97–127). Sources that define their own ranges (SFZ `lovel/hivel`) may override via an optional `ranges` array in the articulation.
4. **Convert** each file with ffmpeg: decode → downmix/upmix to `channels` → resample to `sampleRate` (soxr, high quality) → trim leading silence (`silenceremove` with `startThresholdDb`; cap leading trim so transients are never cut: detect first sample above threshold and back off 1 ms) → cut tail at `maxSeconds` or at the last sample above `endThresholdDb`, whichever first, applying `fadeOutMs` → dither to `bitDepth` → encode FLAC (`-compression_level 8`).
5. **Normalise**: measure the peak of the reference articulation's top layer; compute offset so it hits `targetPeakDbfs`; apply the same offset to every sample in the kit (kit-wide gain, preserves internal balance). Per-articulation `gainDb` is written into the manifest, not baked into audio.
6. **Write manifest** (`02-ARCHITECTURE.md` §3.2) with `totalBytes` and a `provenance` array (`{ output, source, sha256 }`) kept in `provenance.json` next to the manifest (not loaded by the app).
7. **Verify** (`kit:verify`): schema valid; every sample exists; every `chokedBy` id exists; layers cover 1–127 with no gap/overlap; total ≤ `maxBytes`; reference peak within ±1 dB of target; leading silence of every sample ≤ 2 ms; print a summary table.
8. **Index** (`kit:index`): rebuild `public/kits/index.json` sorted by a `order` field in recipes (starter kit first so it loads fastest by default).

## 5. Initial kits (Phase 2)

| Order | Kit id | Source (`KITS.md`) | Mic/mix | Target size | Notes |
|---|---|---|---|---|---|
| 1 | `avl-black-pearl` | AVL Black Pearl (CC-BY-SA 3.0) | already stereo-ready mono WAVs | ≤ 8 MB | Default kit: smallest, loads first. 5 layers, no RR. Hi-hat: closed, pedal, semi (→ `hihat.half`), swish (→ `hihat.open`). |
| 2 | `virtuosity-jazz` | Virtuosity Drums (CC0) | `Samples/mid` | ≤ 30 MB | 4 layers × 2 RR on hats; up to 4 layers on shells. Full hi-hat openness set. |
| 3 | `big-rusty-rock` | Big Rusty Drums (CC0) | `cl` + `oh` folders need a mix: use `oh` (overhead) as the stereo base and sum `cl` at −3 dB, or start with `oh` only | ≤ 30 MB | Map `cl`→closed, `ho`→half, `tc`→three-quarter, `open`→open; `chik`→pedal; `footspl`→splash; `_s` variants → `hihat.shank`. 4 layers × 2 RR. |
| 4 (optional) | `avl-red-zeppelin` | AVL (CC-BY-SA 3.0) | | ≤ 8 MB | Variety; trivial to add |

Mixing two mic folders is a pipeline feature: an articulation may list `mix: [{ glob, gainDb }]` instead of `glob`; files are aligned by `{layer}`/`{rr}` and summed with ffmpeg `amix` before the normal steps. Implement in Phase 2 only if Big Rusty with `oh` alone sounds thin; otherwise defer.

## 6. Licensing rules

- CC0: no requirement, but attribute anyway (manifest + About panel + README).
- CC-BY 4.0: attribution required in About panel and README with license link.
- CC-BY-SA 3.0 (AVL, Salamander): our trimmed/normalised samples are *modified samples*, so the derived kit folder must carry the same license. Put a `LICENSE.txt` inside `public/kits/<id>/` with the CC-BY-SA text and the source URL. The app code is MIT; the kit folders carry their own licenses. State this split in `README.md`.
- Never include libraries whose license is unverified (e.g. SM Drums until its license text is confirmed).

## 7. Tests for the pipeline

Unit tests under `scripts/kit-pipeline/__tests__/` run in the normal `pnpm test:unit` job using the tiny fixture library in `tests/fixtures/source-lib/` (generated WAVs):
- glob capture of `{layer}`/`{rr}`; layer subsampling keeps lowest and highest; range derivation covers 1–127 with no gaps.
- trim never removes the first sample above threshold (synthetic click at sample 100 stays within 1 ms of the start after trim).
- normalisation offset math.
- manifest produced validates against `src/kits/schema.ts` (shared schema, single source of truth).
- `verify` fails on: missing file, overlapping layers, over-budget size, unknown `chokedBy`.

ffmpeg is invoked for real in these tests (it is a dev dependency); keep fixtures tiny so the job stays under 10 s.

## 8. As built (Phase 2)

Deviations from the plan above, all reflected in code:

- **Normalise, then trim.** Trimming thresholds apply to the audio that ships. Trimming before the kit-wide gain made onsets drift by up to 40 ms in kits with negative gain.
- **Clip guard.** If any sample would exceed 0.98 after normalisation, the kit gain is lowered to fit. `verify` then reports the reference peak below target as a warning, not an error (Big Rusty: reference at −7.4 dBFS because its kick is very loud).
- **Peaks and onsets are measured in each file's native channel layout.** ffmpeg's mono→stereo upmix applies −3 dB, which skewed measurements.
- **Resampling** uses ffmpeg's built-in `aresample` with `filter_size=64:phase_shift=10:cutoff=0.97`; the pinned `ffmpeg-static` build has no soxr.
- **Per-articulation `maxVelocityLayers`** overrides the kit budget (e.g. 6 snare layers, 3 cymbal layers).
- **Velocity ranges** are `floor(i·127/n)+1 … floor((i+1)·127/n)`; 4 layers → 1–31, 32–63, 64–95, 96–127.
- **Multi-mic mixing** (`mix`) is implemented and used for Big Rusty (close mic 0 dB + overheads −4 dB, kick overheads −8 dB).
- **Extra hi-hat ids.** Big Rusty exposes six openings: `hihat.closed, hihat.loose, hihat.quarter, hihat.half, hihat.threeQuarter, hihat.open`. Ids outside the voice vocabulary are allowed in manifests and reachable through `hihat.cc` via `hihat.openness`.
- **Runtime balance offsets.** Virtuosity's room mic leaves kick and hats far below the snare; its recipe sets `gainDb` (+9 kick, +8 hats, +3 toms), applied at playback, not baked into audio.
- Sources live in `~/drumr-sources/<libraryId>/` (override with `DRUMR_SOURCES`); download and unzip the archives listed in `KITS.md` there.

| Kit | Samples | Size | Reference peak |
|---|---|---|---|
| avl-black-pearl | 113 (mono, 5 layers) | 5.8 MB | −6.0 dBFS |
| virtuosity-jazz | 96 (stereo, 4–6 layers × 2 RR) | 8.6 MB | −6.0 dBFS |
| big-rusty-rock | 168 (stereo, 3–5 layers × 2 RR) | 16.1 MB | −7.4 dBFS (clip guard) |
