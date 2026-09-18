// Menu observations on the local replay/observer relay require SDK 4.5.
// A packed local preview is not a deployable registry dependency.
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = manifest.dependencies['@w3booster/sdk'];
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const installed = lock.packages?.['node_modules/@w3booster/sdk'];
if (!/^4\.(?:[5-9]|[1-9]\d+)\.\d+$/.test(version) ||
    lock.packages?.['']?.dependencies?.['@w3booster/sdk'] !== version ||
    installed?.version !== version ||
    !installed?.resolved?.startsWith('https://registry.npmjs.org/@w3booster/sdk/-/')) {
  throw new Error('Release blocked: publish SDK 4.5, then pin that registry version in package.json and package-lock.json. Packed previews and SDK versions below 4.5 remain compatibility-test lanes only.');
}
