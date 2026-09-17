// Sparse recorder values require SDK 4.4 interpolation in every release bundle.
// A packed local preview is not a deployable registry dependency.
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = manifest.dependencies['@w3booster/sdk'];
if (!/^4\.(?:[4-9]|[1-9]\d+)\.\d+$/.test(version)) {
  throw new Error('Release blocked: publish SDK 4.4 or newer 4.x, then pin that registry version in package.json and package-lock.json.');
}
