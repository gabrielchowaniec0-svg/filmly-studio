// Kept for compatibility: the generator lives in ./humanoid/ (one module per area). Run either file.
export { default } from './humanoid/index.mjs';
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.argv[1] = fileURLToPath(new URL('./humanoid/index.mjs', import.meta.url));
  await import('./humanoid/index.mjs');
}
