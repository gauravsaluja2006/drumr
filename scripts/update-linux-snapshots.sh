#!/usr/bin/env bash
# Regenerates Linux visual baselines (used by CI) inside the official Playwright image.
# Requires Docker. macOS baselines: pnpm test:e2e tests/e2e/P7-visual.spec.ts --project=chromium --update-snapshots
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('@playwright/test/package.json').version")
docker run --rm -v "$PWD":/src -w /work "mcr.microsoft.com/playwright:v${VERSION}-noble" bash -lc '
  set -e
  tar -C /src --exclude=node_modules --exclude=dist --exclude=.git --exclude=test-results --exclude=playwright-report -cf - . | tar -xf -
  corepack enable >/dev/null 2>&1
  CI=1 pnpm install --frozen-lockfile >/tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
  rm -f tests/e2e/P7-visual.spec.ts-snapshots/*linux*
  pnpm exec playwright test tests/e2e/P7-visual.spec.ts --project=chromium --update-snapshots | tail -5
  cp tests/e2e/P7-visual.spec.ts-snapshots/*linux* /src/tests/e2e/P7-visual.spec.ts-snapshots/
'
ls tests/e2e/P7-visual.spec.ts-snapshots/
