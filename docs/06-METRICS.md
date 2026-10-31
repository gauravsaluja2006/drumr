# 06 — Metrics and Performance Budgets

Owner: Tech lead. Status: Approved.

Each metric has a target, a measurement method, and a gate (where it is enforced). Record measured values in `docs/METRICS-LOG.md` at the end of every phase (table: date, phase, commit, metric, value). The log is the "before/after" evidence for the portfolio.

## 1. Latency

| Metric | Target | Measure | Gate |
|---|---|---|---|
| L1 Event-to-schedule | median ≤ 2 ms, p95 ≤ 5 ms | In `MidiManager` handler: `performance.now()` at entry; in `AudioEngine.trigger`: `performance.now()` just before `source.start()`. Difference stored in a 256-entry ring buffer; debug panel shows median/p95. E2E test fires 200 fake note-ons and reads `window.__drumr.engine.stats().latency` | E2E assertion (Chromium) |
| L2 Audio pipeline | `baseLatency + outputLatency` ≤ 15 ms on macOS Chrome | `AudioContext.baseLatency`, `outputLatency` shown in debug panel | Manual, logged |
| L3 End-to-end (pad hit to sound) | ≤ 20 ms perceived | L1 + L2 + controller USB (~1–3 ms). Optional loopback measurement: record output with a mic while tapping, measure in Audacity | Manual, logged per release |

## 2. Reliability under load

| Metric | Target | Measure | Gate |
|---|---|---|---|
| R1 Dropped notes | 0 | E2E: 500 note-ons at 10 ms intervals across 8 pads; `stats().triggers === 500` | E2E |
| R2 Polyphony | 64 simultaneous voices without errors; stealing works beyond | Unit test on voice pool with fake context | Unit |
| R3 Choke timing | gain target set within the same JS task; audible fade ≤ 40 ms | Unit: `setTargetAtTime(0, t, 0.012)` recorded at trigger time | Unit |
| R4 Kit switch | No uncaught errors; old kit voices allowed to ring out | E2E switching kits while sending notes | E2E |

## 3. Load and size

| Metric | Target | Measure | Gate |
|---|---|---|---|
| S1 JS bundle (gzip) | ≤ 180 KB initial | `size-limit` on `dist/assets/*.js` | CI |
| S2 CSS (gzip) | ≤ 30 KB | `size-limit` | CI |
| S3 Kit payload | ≤ 30 MB per kit; ≤ 120 MB all kits | `scripts/kit-pipeline` prints totals; `index.json.totalBytes` summed in a unit test | Unit + pipeline |
| S4 Time to first playable (cold, 50 Mbps) | ≤ 3 s with the default kit (starter kit ≤ 8 MB loads first) | Playwright with `page.route` throttling (CDP `Network.emulateNetworkConditions` 50 Mbps) measuring until `stats().ready === true` | E2E (Chromium) |
| S5 Kit switch time (cached) | ≤ 1 s | Same hook | E2E |

## 4. Rendering

| Metric | Target | Measure | Gate |
|---|---|---|---|
| F1 Frame rate while playing | ≥ 55 fps average during 200 hits over 5 s | Playwright: CDP `Performance` domain or `requestAnimationFrame` counter injected in page | E2E (Chromium) |
| F2 Hit-to-pixel | ≤ 1 frame (16.7 ms) | Visual: pad `data-hit` attribute set within the same task as trigger (unit test on the store/rAF bridge) | Unit |

## 5. Quality

| Metric | Target | Measure | Gate |
|---|---|---|---|
| Q1 Lighthouse Performance | ≥ 95 | `lhci autorun` on deployed URL, desktop preset | CI (main) |
| Q2 Lighthouse Accessibility | ≥ 95 | same | CI (main) |
| Q3 Lighthouse Best Practices | ≥ 95 | same | CI (main) |
| Q4 Unit coverage | engine/midi/mapping/kits ≥ 90 % lines; project ≥ 80 % | Vitest `--coverage` thresholds | CI |
| Q5 Type errors / lint errors | 0 | `tsc --noEmit`, `eslint` | CI |
| Q6 axe violations | 0 serious/critical | `@axe-core/playwright` on main screen, editor open, about open | E2E |

## 6. Audio quality (manual, logged)

- A1 No clipping: limiter never engages above −0.1 dBFS during a 16-pad mash at velocity 127 (check debug panel "limiter reduction").
- A2 No clicks on choke or voice steal (listen; also assert fade curves exist in unit tests).
- A3 Loudness consistency between kits: pipeline normalises each kit so that a velocity-127 snare center peaks at −6 dBFS ± 1 dB (asserted by the pipeline's verification step).

## 7. Reporting

- `docs/METRICS-LOG.md` is updated at the end of each phase by the implementer (CI prints the numbers; copy them).
- The README shows the latest L1, S1, S4, Q1–Q3 as badges or a small table.
