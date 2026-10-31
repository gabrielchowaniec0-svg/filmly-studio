// Generates every background in src/assets/scenes/*.json, then refreshes the asset manifest.
//   node scripts/scenes/index.mjs            (all scenes)
//   node scripts/scenes/index.mjs kitchen    (just one)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as interiors1 from './interiors1.mjs';
import * as interiors2 from './interiors2.mjs';
import * as interiors3 from './interiors3.mjs';
import * as exteriors1 from './exteriors1.mjs';
import * as exteriors2 from './exteriors2.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'src/assets/scenes');
// every snake_case export is a scene builder; camelCase exports are shared helpers
export const builders = Object.fromEntries(
  Object.entries({ ...interiors1, ...interiors2, ...interiors3, ...exteriors1, ...exteriors2 }).filter(([k]) => /^[a-z0-9_]+$/.test(k)),
);

/** Scene object -> JSON text (one shape per line keeps diffs readable). */
export function serialize(sc) {
  const body = ['{', `  "id": ${JSON.stringify(sc.id)},`, `  "name": ${JSON.stringify(sc.name)},`, `  "type": ${JSON.stringify(sc.type)},`, `  "floorY": ${sc.floorY},`];
  body.push('  "layers": [', sc.layers.map((s) => '    ' + JSON.stringify(s)).join(',\n'), sc.front ? '  ],' : '  ]');
  if (sc.front) body.push('  "front": [', sc.front.map((s) => '    ' + JSON.stringify(s)).join(',\n'), '  ]');
  body.push('}');
  return body.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const only = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  let count = 0;
  for (const [id, make] of Object.entries(builders)) {
    if (only.length && !only.includes(id)) continue;
    const sc = make();
    if (sc.id !== id) throw new Error(`builder ${id} produced id ${sc.id}`);
    writeFileSync(join(out, `${id}.json`), serialize(sc));
    console.log(`${id.padEnd(24)} ${String(sc.layers.length + (sc.front?.length || 0)).padStart(4)} shapes`);
    count++;
  }
  execFileSync(process.execPath, [join(root, 'scripts/build-manifest.mjs')], { stdio: 'inherit' });
  console.log(`wrote ${count} scene(s)`);
}
