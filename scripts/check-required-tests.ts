/**
 * Fails if any required test title (docs/04-ROADMAP.md manifest) for a completed phase is missing.
 * The current phase is `drumr.phase` in package.json; phases 0..phase are checked.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const roadmap = readFileSync(join(root, 'docs/04-ROADMAP.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { drumr?: { phase?: number } };
const currentPhase = pkg.drumr?.phase ?? 0;

const block = /```required-tests\n([\s\S]*?)```/.exec(roadmap)?.[1];
if (!block) {
  console.error('No ```required-tests block found in docs/04-ROADMAP.md');
  process.exit(1);
}

const required: { phase: number; title: string }[] = [];
let phase = -1;
for (const raw of block.split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  const m = /^phase:\s*(\d+)$/.exec(line);
  if (m) phase = Number(m[1]);
  else if (phase <= currentPhase) required.push({ phase, title: line });
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules') return [];
    return statSync(p).isDirectory() ? files(p) : /\.(test|spec)\.tsx?$/.test(name) ? [p] : [];
  });
}

const sources = [...files(join(root, 'tests')), ...files(join(root, 'scripts'))]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const missing = required.filter(({ title }) => !sources.includes(title));
console.log(
  `Phase ${currentPhase}: ${required.length - missing.length}/${required.length} required tests present.`,
);
if (missing.length) {
  for (const m of missing) console.error(`  missing (phase ${m.phase}): ${m.title}`);
  process.exit(1);
}
