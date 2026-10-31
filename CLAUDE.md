# CLAUDE.md — Operating rules for implementing Drumr

You are implementing a specified project. The specification lives in `docs/` and is the source of truth. Read `docs/00-OVERVIEW.md` first, then the docs it points to for your phase.

## Workflow for every task

1. **Find your phase** in `docs/04-ROADMAP.md`. Work on exactly one phase at a time, in order. Do not pull tasks from later phases.
2. **Branch**: `phase-N-<slug>` from `main`.
3. **Tests first** for anything under `src/engine`, `src/midi`, `src/mapping`, `src/kits`, `scripts/kit-pipeline`. Write the failing test with the exact title from the phase's "Required tests", then implement until it passes.
4. **Run the full suite before claiming done**:
   ```
   pnpm lint && pnpm typecheck && pnpm test:unit --coverage && pnpm build && pnpm size-limit && pnpm test:e2e && pnpm check:required-tests
   ```
   All previous phases' tests must still pass. If a previous test breaks, fix the regression; never delete, skip, or loosen a test to get green. If a test is genuinely wrong, change it in the same PR and explain why in the PR description and in `docs/04-ROADMAP.md`.
5. **Metrics**: copy the numbers CI prints into `docs/METRICS-LOG.md` for this phase.
6. **Changelog**: add an entry under "Unreleased" in `CHANGELOG.md`.
7. **Docs**: if you had to deviate from `docs/01`–`07`, edit the doc in the same PR and add a row to the Decision Log in `docs/02-ARCHITECTURE.md`.
8. **Definition of Done** checklist in `docs/04-ROADMAP.md` must be fully ticked in the PR description.

## Hard rules

- `src/engine`, `src/midi`, `src/mapping`, `src/kits` never import React, and only touch Web Audio/Web MIDI through the injectable interfaces (`src/engine/audioContext.ts`, `src/midi/MidiManager.ts` constructor argument). This keeps them unit-testable with fakes.
- MIDI → engine trigger path is synchronous. No `await`, no React state update, no store subscription on that path. UI updates go through `requestAnimationFrame`.
- No new runtime dependencies without a Decision Log entry. Current allowed runtime deps: `react`, `react-dom`, `zustand`, `zod`. Everything else is dev-only.
- Audio samples are FLAC produced by `scripts/kit-pipeline` only. Never hand-edit `public/kits/**`.
- Licenses: only kits listed in `KITS.md` Tier 1 or 2 with a verified license. Attribution must appear in the manifest and the About panel.
- Visual design follows `docs/03-DESIGN.md` tokens and states. Do not invent colours or animations.
- TypeScript `strict` with `noUncheckedIndexedAccess`; no `any`, no `@ts-ignore` (use `@ts-expect-error` with a reason if unavoidable).
- Test titles must match the required-test manifest exactly (copy-paste).
- Keep PRs scoped to the phase. If you discover necessary work outside the phase, add it to the Backlog in `docs/04-ROADMAP.md` instead of doing it.

## Commands (after Phase 0)

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server with test kit (`VITE_KITS_BASE_URL=/kits/`) |
| `pnpm build` / `pnpm preview` | Production build / serve it |
| `pnpm test:unit` | Vitest (add `--coverage` for thresholds) |
| `pnpm test:e2e` | Playwright, 3 browsers; `--project=chromium` for speed while iterating |
| `pnpm test:e2e --ui` | Playwright UI mode for debugging |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Quality |
| `pnpm size-limit` | Bundle budgets |
| `pnpm check:required-tests` | Verify every required test title for completed phases exists |
| `pnpm kit:build <recipe>` / `kit:verify <id>` / `kit:index` | Kit pipeline (needs sources, see `docs/07-KIT-PIPELINE.md`) |

## Reference material

- `logic.js`: the original Logic Pro Scripter mapping. The velocity curve (`scaleVelocity`), pad table (`PAD_ALIASES`), and hi-hat bands (`updateHiHat`) must be reproduced exactly; tests assert on it.
- `KITS.md`: verified sample libraries, formats, hi-hat articulation names, and download links.

## When stuck

Prefer the simplest implementation that passes the tests and matches the docs. If the docs are ambiguous, choose the option that keeps the MIDI→audio path simplest and fastest, note the choice in the Decision Log, and move on.
