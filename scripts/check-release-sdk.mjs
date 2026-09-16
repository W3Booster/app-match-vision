// Resource invalidation and recovery require the additive SDK 4.3 release.
// A packed local preview is not a deployable registry dependency.
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = manifest.dependencies['@w3booster/sdk'];
if (!/^4\.(?:[3-9]|[1-9]\d+)\.\d+$/.test(version)) {
  throw new Error('Release blocked: publish SDK 4.3 or newer 4.x, then pin that registry version in package.json and package-lock.json.');
}
