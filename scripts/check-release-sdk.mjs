// SDK 3 is a coordinated breaking release. A green packed preview is not a
// deployable registry artifact. Keep this check on release/published CI lanes.
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = manifest.dependencies['@w3booster/sdk'];
if (!/^[~^]?3\./.test(version)) {
  throw new Error('Release blocked: publish SDK 3, then update the registry dependency and package-lock.json to 3.x. Use the packed SDK lane to review this prerelease branch.');
}
