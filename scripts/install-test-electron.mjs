import { mkdir, readFile, writeFile, chmod, access, mkdtemp, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Match the oldest launcher in production. Upgrade only with a reviewed support decision.
export async function testElectron() {
    if (process.env.ELECTRON_BIN) return process.env.ELECTRON_BIN;
    if (process.platform !== 'linux' || process.arch !== 'x64') throw Error('Set ELECTRON_BIN to Electron 15.0.0 on this platform.');
    const root = resolve(homedir(), '.cache/w3booster/electron-15.0.0');
    const archive = resolve(root, 'electron-v15.0.0-linux-x64.zip');
    const digest = '4f0c95f27402b1b39a7ef0d540940b99b5e3088624569607d6aa56276b43fcad';
    await mkdir(root, { recursive: true });
    let bytes = await readFile(archive).catch(() => null);
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== digest) {
        const response = await fetch('https://github.com/electron/electron/releases/download/v15.0.0/electron-v15.0.0-linux-x64.zip');
        assertResponse(response);
        bytes = Buffer.from(await response.arrayBuffer());
        if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('Electron archive checksum mismatch');
        await writeFile(archive, bytes);
    }
    const binary = resolve(root, 'dist/electron');
    if (await access(binary).then(() => true, () => false)) return binary;
    const candidate = await mkdtemp(resolve(root, 'extract-'));
    try {
        const result = spawnSync('unzip', ['-qo', archive, '-d', candidate], { stdio: 'inherit' });
        if (result.status !== 0) throw Error('Electron extraction failed');
        await chmod(resolve(candidate, 'electron'), 0o755);
        try { await rename(candidate, resolve(root, 'dist')); }
        catch (error) {
            if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
            await access(binary);
        }
    } finally { await rm(candidate, { recursive: true, force: true }); }
    return binary;
}
function assertResponse(response) { if (!response.ok) throw Error('Electron download failed: HTTP ' + response.status); }
if (process.argv[1] === new URL(import.meta.url).pathname) console.log(await testElectron());
