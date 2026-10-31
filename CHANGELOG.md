# Changelog

## Unreleased

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
