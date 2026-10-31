/**
 * Kit pipeline CLI (docs/07-KIT-PIPELINE.md).
 *   pnpm kit:build <recipe.json|id>   pnpm kit:verify <id>   pnpm kit:index   pnpm kit:build-all
 * Sources: $DRUMR_SOURCES (default ~/drumr-sources/<libraryId>/...).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { recipeSchema, type Recipe } from './recipe';
import { buildKit } from './build';
import { verifyKit } from './verify';
import { kitManifestSchema } from '../../src/kits/schema';

const root = new URL('../..', import.meta.url).pathname;
const recipesDir = join(root, 'scripts/kit-pipeline/recipes');
/** Recipes for content that must never reach git (e.g. commercial libraries you own). Gitignored. */
const privateRecipesDir = join(root, 'scripts/kit-pipeline/recipes-private');
const outRoot = join(root, 'public/kits');
/** Local-only kits (gitignored), listed in their own index the app merges in when present. */
const localRoot = join(root, 'public/kits-local');
const outFor = (r: Recipe) => (r.local ? localRoot : outRoot);
const sourcesRoot = process.env.DRUMR_SOURCES ?? join(homedir(), 'drumr-sources');
const MAX_TOTAL = 120_000_000;

function loadRecipe(arg: string): Recipe {
  const name = `${arg.replace(/\.json$/, '')}.json`;
  const file = existsSync(arg) ? arg : existsSync(join(privateRecipesDir, name)) ? join(privateRecipesDir, name) : join(recipesDir, name);
  return recipeSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

const allRecipes = () =>
  [recipesDir, privateRecipesDir]
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => loadRecipe(join(dir, f))))
    .sort((a, b) => a.order - b.order);

function build(r: Recipe) {
  const t0 = Date.now();
  mkdirSync(outFor(r), { recursive: true });
  const res = buildKit(r, { sourcesRoot, outRoot: outFor(r), log: console.log });
  console.log(
    `${r.id}: ${(res.manifest.totalBytes / 1e6).toFixed(2)} MB, kit gain ${res.kitGainDb.toFixed(1)} dB, reference peak ${res.referencePeakDbfs.toFixed(1)} dBFS (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
  return verify(r);
}

function verify(r: Recipe): boolean {
  const res = verifyKit(join(outFor(r), r.id), {
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
  for (const local of [false, true]) {
    const dir = local ? localRoot : outRoot;
    const entries = allRecipes()
      .filter((r) => r.local === local && existsSync(join(dir, r.id, 'manifest.json')))
      .map((r) => {
        const m = kitManifestSchema.parse(JSON.parse(readFileSync(join(dir, r.id, 'manifest.json'), 'utf8')));
        return { id: m.id, name: m.name, description: m.description, totalBytes: m.totalBytes };
      });
    if (local && entries.length === 0) continue;
    const total = entries.reduce((s, e) => s + e.totalBytes, 0);
    writeFileSync(join(dir, 'index.json'), JSON.stringify(entries, null, 2) + '\n');
    const note = local ? ' (local only, not committed)' : ` (budget ${MAX_TOTAL / 1e6} MB)`;
    console.log(
      `${local ? 'kits-local' : 'kits'}/index.json: ${entries.length} kits, ${(total / 1e6).toFixed(1)} MB${note}`,
    );
    if (!local && total > MAX_TOTAL) process.exitCode = 1;
  }
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'build':
    if (!arg) throw new Error('usage: kit:build <recipe>');
    if (!build(loadRecipe(arg))) process.exitCode = 1;
    index();
    break;
  case 'build-all':
    for (const r of allRecipes().filter((r) => !r.local)) if (!build(r)) process.exitCode = 1;
    index();
    break;
  case 'build-local':
    for (const r of allRecipes().filter((r) => r.local && (!arg || r.id === arg)))
      if (!build(r)) process.exitCode = 1;
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
    console.error('commands: build <recipe> | build-all | build-local [id] | verify <id> | index');
    process.exitCode = 1;
}
