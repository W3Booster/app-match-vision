import { access, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.W3BOOSTER_SDK_PATH,
  path.resolve(projectRoot, '..', 'w3booster-sdk'),
  path.resolve(projectRoot, '..', '..', 'w3booster-sdk')
].filter(Boolean);
let sdkRoot;
for (const candidate of candidates) {
  try {
    await access(path.join(candidate, 'package.json'));
    sdkRoot = candidate;
    break;
  } catch { /* Try the next conventional workspace location. */ }
}
if (!sdkRoot) throw new Error('Could not find a sibling w3booster-sdk checkout. Set W3BOOSTER_SDK_PATH to override discovery.');

const manifest = JSON.parse(await readFile(path.join(sdkRoot, 'package.json'), 'utf8'));
if (manifest.name !== '@w3booster/sdk') throw new Error(`${sdkRoot} is not the @w3booster/sdk package.`);
const settingsBin = typeof manifest.bin === 'object' && manifest.bin?.['w3booster-settings'];
if (typeof settingsBin !== 'string') throw new Error(`${sdkRoot} does not expose the w3booster-settings CLI.`);

const target = path.join(projectRoot, 'node_modules', '@w3booster', 'sdk');
await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await symlink(sdkRoot, target, process.platform === 'win32' ? 'junction' : 'dir');

const cliTarget = path.join(projectRoot, 'node_modules', '.bin', 'w3booster-settings');
await rm(cliTarget, { force: true });
await mkdir(path.dirname(cliTarget), { recursive: true });
await symlink(path.join(sdkRoot, settingsBin), cliTarget, 'file');
console.log(`Linked @w3booster/sdk ${manifest.version} and its settings CLI from ${sdkRoot}.`);
