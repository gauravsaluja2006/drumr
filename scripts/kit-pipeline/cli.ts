/**
 * Kit pipeline CLI (docs/07-KIT-PIPELINE.md).
 *   pnpm kit:build <recipe.json|id>   pnpm kit:verify <id>   pnpm kit:index   pnpm kit:build-all
 * Sources: $DRUMR_SOURCES (default ~/drumr-sources/<libraryId>/...).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { recipeSchema, type Recipe } from './recipe';
import { buildKit } from './build';
import { verifyKit } from './verify';
import { kitManifestSchema } from '../../src/kits/schema';

const root = new URL('../..', import.meta.url).pathname;
const recipesDir = join(root, 'scripts/kit-pipeline/recipes');
const outRoot = join(root, 'public/kits');
const sourcesRoot = process.env.DRUMR_SOURCES ?? join(homedir(), 'drumr-sources');
const MAX_TOTAL = 120_000_000;

function loadRecipe(arg: string): Recipe {
  const file = existsSync(arg) ? arg : join(recipesDir, `${arg.replace(/\.json$/, '')}.json`);
  return recipeSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

const allRecipes = () =>
  readdirSync(recipesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => loadRecipe(join(recipesDir, f)))
    .sort((a, b) => a.order - b.order);

function build(r: Recipe) {
  const t0 = Date.now();
  const res = buildKit(r, { sourcesRoot, outRoot, log: console.log });
  console.log(
    `${r.id}: ${(res.manifest.totalBytes / 1e6).toFixed(2)} MB, kit gain ${res.kitGainDb.toFixed(1)} dB, reference peak ${res.referencePeakDbfs.toFixed(1)} dBFS (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
  return verify(r);
}

function verify(r: Recipe): boolean {
  const res = verifyKit(join(outRoot, r.id), {
    maxBytes: r.budget.maxBytes,
    reference: r.normalize.reference,
    targetPeakDbfs: r.normalize.targetPeakDbfs,
    startThresholdDb: r.trim.startThresholdDb,
  });
  console.table({
    kit: r.id,
    ok: res.ok,
    samples: res.sampleCount,
    MB: +(res.totalBytes / 1e6).toFixed(2),
    refPeak: res.referencePeakDbfs?.toFixed(2),
  });
  res.warnings.forEach((w) => console.warn(`  warn: ${w}`));
  res.errors.forEach((e) => console.error(`  error: ${e}`));
  return res.ok;
}

function index() {
  const recipes = allRecipes();
  const entries = recipes
    .filter((r) => existsSync(join(outRoot, r.id, 'manifest.json')))
    .map((r) => {
      const m = kitManifestSchema.parse(
        JSON.parse(readFileSync(join(outRoot, r.id, 'manifest.json'), 'utf8')),
      );
      return { id: m.id, name: m.name, description: m.description, totalBytes: m.totalBytes };
    });
  const total = entries.reduce((s, e) => s + e.totalBytes, 0);
  writeFileSync(join(outRoot, 'index.json'), JSON.stringify(entries, null, 2) + '\n');
  console.log(
    `index.json: ${entries.length} kits, ${(total / 1e6).toFixed(1)} MB total (budget ${MAX_TOTAL / 1e6} MB)`,
  );
  if (total > MAX_TOTAL) process.exitCode = 1;
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'build':
    if (!arg) throw new Error('usage: kit:build <recipe>');
    if (!build(loadRecipe(arg))) process.exitCode = 1;
    index();
    break;
  case 'build-all':
    for (const r of allRecipes()) if (!build(r)) process.exitCode = 1;
    index();
    break;
  case 'verify':
    if (!arg) throw new Error('usage: kit:verify <id>');
    if (!verify(loadRecipe(basename(arg)))) process.exitCode = 1;
    break;
  case 'index':
    index();
    break;
  default:
    console.error('commands: build <recipe> | build-all | verify <id> | index');
    process.exitCode = 1;
}
