import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { testElectron } from './install-test-electron.mjs';

const root = resolve(import.meta.dirname, '..');
const steps = [];
const started = Date.now();
await mkdir(resolve(root, 'tmp/release-ui'), { recursive: true });
await writeFile(resolve(root, 'tmp/release-ui/suite.json'), JSON.stringify({ passed: false, steps }, null, 2));
async function run(command, args, env = {}) {
    const started = Date.now();
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
    const [code] = await once(child, 'exit');
    steps.push({ command, args, engine: 'Electron 15.0.0', passed: code === 0, seconds: (Date.now() - started) / 1000 });
    await mkdir(resolve(root, 'tmp/release-ui'), { recursive: true });
    await writeFile(resolve(root, 'tmp/release-ui/suite.json'), JSON.stringify({ passed: false, steps }, null, 2));
    if (code !== 0) throw Error(`${command} ${args.join(' ')} failed (${code})`);
}
const electron = await testElectron();
await run('xvfb-run', ['-a', process.execPath, 'scripts/release-ui.browser-test.mjs'], { ELECTRON_BIN: electron });

// Keep the deeper geometry/order/illusion matrix in addition to the production gate.
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const server = spawn(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'serve', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
try {
    const url = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 60000;
    while (!(await fetch(url).then(r => r.ok).catch(() => false))) {
        if (server.exitCode !== null || Date.now() > deadline) throw Error('Owned Angular test server failed to become ready');
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    for (const script of ['overlay-sdk3.browser-test.mjs', 'hero-order.browser-test.mjs', 'illusion-heroes.browser-test.mjs']) {
        await run('xvfb-run', ['-a', process.execPath, 'scripts/' + script], { MV_TEST_URL: url, ELECTRON_BIN: electron });
    }
} finally {
    if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
}

await writeFile(resolve(root, 'tmp/release-ui/suite.json'), JSON.stringify({ passed: true, seconds: (Date.now() - started) / 1000, steps }, null, 2));
