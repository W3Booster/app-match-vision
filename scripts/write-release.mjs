import { readFile, writeFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Match Vision releases require a stable semantic version.');
await writeFile(new URL('../dist/match-vision/browser/release.json', import.meta.url), JSON.stringify({ name: 'Match Vision', version }) + '\n');
