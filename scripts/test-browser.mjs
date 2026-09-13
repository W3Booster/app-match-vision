import { _electron } from 'playwright';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { testElectron } from './install-test-electron.mjs';

// Every UI test uses the oldest supported desktop runtime, including geometry tests.
export async function launchTestBrowser() {
    const directory = await mkdtemp(resolve(tmpdir(), 'w3-mv-ui-'));
    let app;
    try { app = await _electron.launch({
        executablePath: await testElectron(),
        args: ['--no-sandbox', '--user-data-dir=' + directory, resolve(import.meta.dirname, 'electron-shell.cjs')]
    }); } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
    const close = async () => { try { await app.close(); } finally { await rm(directory, { recursive: true, force: true }); } };
    if (await app.evaluate(() => process.versions.electron) !== '15.0.0') { await close(); throw Error('UI acceptance requires Electron 15.0.0'); }
    return {
        app,
        context: () => app.context(),
        async newPage({ viewport = { width: 1920, height: 1080 } } = {}) {
            const page = await app.firstWindow();
            const window = await app.browserWindow(page);
            const setViewport = page.setViewportSize.bind(page);
            page.setViewportSize = async size => {
                await window.evaluate((nativeWindow, size) => nativeWindow.setContentSize(size.width, size.height), size);
                await setViewport(size);
            };
            await page.setViewportSize(viewport);
            return page;
        },
        version: () => app.evaluate(() => process.versions.electron),
        close
    };
}
