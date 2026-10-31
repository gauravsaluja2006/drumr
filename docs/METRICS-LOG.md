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
