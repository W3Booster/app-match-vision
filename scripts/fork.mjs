import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateSettingsBinding } from '@w3booster/sdk/settings';

export async function forkApplication({ clientId, root = process.cwd(), request = fetch, log = console.log }) {
  if (!/^app_[a-f0-9]{24}$/.test(clientId || '')) throw new Error('Usage: npm run app:fork -- YOUR_NEW_CLIENT_ID');
  const packagePath = resolve(root, 'package.json');
  const beforePackage = await readFile(packagePath, 'utf8');
  const pkg = JSON.parse(beforePackage);
  if (pkg.w3booster?.clientId === clientId) throw new Error('That is the existing app ID. Register a new app you own before forking.');
  const output = pkg.w3booster?.settingsOutput || 'src/w3booster.generated.ts';
  if (output.includes('..') || output.startsWith('/') || !output.endsWith('.ts')) throw new Error('Expected a project-relative TypeScript binding.');
  const bindingPath = resolve(root, output);
  const beforeBinding = await readFile(bindingPath, 'utf8');
  // Preflight the new public definition before replacing any local identity.
  const response = await request('https://api.w3booster.com/stream/v1/app-definitions/' + clientId, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Could not load the new app definition. Nothing changed; check your new client ID and connection.');
  const definition = await response.json();
  if (definition.clientId !== clientId || !/^[a-f0-9]{64}$/.test(definition.revision || '')) throw new Error('Unexpected app definition. Nothing changed.');
  const binding = generateSettingsBinding(definition);
  pkg.w3booster = { clientId, settingsOutput: output, endpoint: 'https://api.w3booster.com' };
  pkg.scripts ||= {};
  pkg.scripts['w3booster:sync'] = 'w3booster-settings';
  pkg.scripts['w3booster:check'] = 'w3booster-settings --check';
  try {
    await writeFile(bindingPath, binding);
    await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  } catch (error) {
    await writeFile(bindingPath, beforeBinding);
    await writeFile(packagePath, beforePackage);
    throw error;
  }
  log('Bound to your new public client ID. No platform record, grants, or production deployment was changed.\nNext: npm run check; adapt settings/scopes if needed; change app branding and deployment URLs; commit the binding and package.json.\nUse Test locally in W3Booster. The public ID alone does not authorize live data.');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) { console.error('Usage: npm run app:fork -- YOUR_NEW_CLIENT_ID'); process.exitCode = 1; }
  else forkApplication({ clientId: process.argv[2] }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
