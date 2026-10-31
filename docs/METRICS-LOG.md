# Metrics log

One row per metric per phase. Values come from CI output or the manual checks described in docs/06-METRICS.md.

| Date | Phase | Commit | Metric | Value | Target | Pass |
|---|---|---|---|---|---|---|
| 2026-10-31 | 0 | phase-0-scaffold | S1 JS bundle (gzip) | 68.9 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 0 | phase-0-scaffold | S2 CSS (gzip) | 6.7 KB | ≤ 30 KB | ✅ |
| 2026-10-31 | 0 | phase-0-scaffold | Q5 type/lint errors | 0 | 0 | ✅ |
| 2026-10-31 | 0 | phase-0-scaffold | Q6 axe serious/critical (initial screen, 3 browsers) | 0 | 0 | ✅ |
| 2026-10-31 | 0 | phase-0-scaffold | E2E tests | 6/6 pass (Chromium, Firefox, WebKit) | all pass | ✅ |
| 2026-10-31 | 0 | main@192b863 | Q1–Q3 Lighthouse (desktop, deployed) | gate passed, all ≥ 95 | ≥ 95 | ✅ |
| 2026-10-31 | 1 | phase-1-audio-engine | S1 JS bundle (gzip) | 99.3 KB (+30 KB, mostly zod) | ≤ 180 KB | ✅ |
| 2026-10-31 | 1 | phase-1-audio-engine | S2 CSS (gzip) | 7.7 KB | ≤ 30 KB | ✅ |
| 2026-10-31 | 1 | phase-1-audio-engine | Q4 coverage (all / engine / kits) | 99.2 % / 98.6 % / 100 % lines | ≥ 80 / 90 / 90 % | ✅ |
| 2026-10-31 | 1 | phase-1-audio-engine | R2 64-voice cap with stealing | 200 triggers, 136 steals, 64 active | cap holds | ✅ |
| 2026-10-31 | 1 | phase-1-audio-engine | Tests | 50 unit, 15 e2e (3 browsers) | all pass | ✅ |
| 2026-10-31 | 2 | phase-2-kits | S1 JS bundle (gzip) | 101.3 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 2 | phase-2-kits | S2 CSS (gzip) | 8.1 KB | ≤ 30 KB | ✅ |
| 2026-10-31 | 2 | phase-2-kits | S3 kit payload (per kit / total) | 5.8, 8.6, 16.1 MB / 30.5 MB | ≤ 30 / ≤ 120 MB | ✅ |
| 2026-10-31 | 2 | phase-2-kits | S4 first playable, 50 Mbps (test kit, e2e) | 373 ms | ≤ 3 s | ✅ |
| 2026-10-31 | 2 | phase-2-kits | S4 first playable, 50 Mbps (Black Pearl, manual) | 1245 ms | ≤ 3 s | ✅ |
| 2026-10-31 | 2 | phase-2-kits | S5 kit switch, downloaded (Big Rusty 16 MB, local) | 181 ms | ≤ 1 s | ✅ |
| 2026-10-31 | 2 | phase-2-kits | A3 loudness: reference peak | −6.0 / −6.0 / −7.4 dBFS | −6 ± 1 dB | ⚠️ Big Rusty clip-guarded |
| 2026-10-31 | 2 | phase-2-kits | Tests | 62 unit, 22 e2e | all pass | ✅ |
| 2026-10-31 | 3 | phase-3-midi | L1 event-to-schedule (200 note-ons, Chromium) | median 0.0 ms, p95 0.1 ms | ≤ 2 / ≤ 5 ms | ✅ |
| 2026-10-31 | 3 | phase-3-midi | R1 dropped notes (500 at 10 ms) | 0 | 0 | ✅ |
| 2026-10-31 | 3 | phase-3-midi | S1 JS bundle (gzip) | 105.6 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 3 | phase-3-midi | Q4 coverage (all / midi / mapping) | 98.5 / 98.6 / 100 % lines | ≥ 80 / 90 / 90 % | ✅ |
| 2026-10-31 | 3 | phase-3-midi | Tests | 84 unit, 39 e2e (+6 Chromium-only skips) | all pass | ✅ |
| 2026-10-31 | 4 | phase-4-hihat | R3 choke timing | fade scheduled in the trigger task, τ = 12 ms, stop at 80 ms | ≤ 40 ms audible | ✅ |
| 2026-10-31 | 4 | phase-4-hihat | S1 JS bundle (gzip) | 106.9 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 4 | phase-4-hihat | Q4 coverage (all / engine) | 98.7 / 98.8 % lines | ≥ 80 / 90 % | ✅ |
| 2026-10-31 | 4 | phase-4-hihat | Tests | 96 unit, 48 e2e (+6 Chromium-only skips) | all pass | ✅ |
| 2026-10-31 | 5 | phase-5-mapping-editor | Q6 axe serious/critical (editor open, 3 browsers) | 0 | 0 | ✅ |
| 2026-10-31 | 5 | phase-5-mapping-editor | S1 JS bundle (gzip) | 109.4 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 5 | phase-5-mapping-editor | Q4 coverage (all) | 98.4 % lines | ≥ 80 % | ✅ |
| 2026-10-31 | 5 | phase-5-mapping-editor | Tests | 105 unit, 57 e2e (+6 Chromium-only skips) | all pass | ✅ |
| 2026-10-31 | 6 | phase-6-mixer | S1 JS bundle (gzip) | 110.1 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 6 | phase-6-mixer | Tests | 110 unit, 60 e2e (+6 Chromium-only skips) | all pass | ✅ |
| 2026-10-31 | 7 | phase-7-polish | F1 frame rate during 200 hits / 5 s (Chromium) | 60.1 fps | ≥ 55 fps | ✅ |
| 2026-10-31 | 7 | phase-7-polish | S1 JS initial (gzip) | 109.4 KB | ≤ 180 KB | ✅ |
| 2026-10-31 | 7 | phase-7-polish | S1 JS all chunks (gzip) | 114.6 KB | ≤ 200 KB | ✅ |
| 2026-10-31 | 7 | phase-7-polish | S2 CSS (gzip) | 9.1 KB | ≤ 30 KB | ✅ |
| 2026-10-31 | 7 | phase-7-polish | PWA precache | 20 files, 584 KB uncompressed | — | ✅ |
| 2026-10-31 | 7 | phase-7-polish | Q4 coverage (all) | 98.1 % lines | ≥ 80 % | ✅ |
| 2026-10-31 | 7 | phase-7-polish | Tests | 116 unit, 69 e2e (+18 browser-specific skips) | all pass | ✅ |
| 2026-10-31 | 7 | phase-7-polish | F1 on GitHub runners (informational) | 47.2–54.1 fps playing vs 58.7–60.8 idle | recorded only | ℹ️ |
