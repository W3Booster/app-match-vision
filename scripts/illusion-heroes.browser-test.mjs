import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Optional snapshots can come from an isolated native recorder capture. Without
// them this remains an independent Match Vision browser regression using demo data.
const captured = process.env.ILLUSION_STATES
    ? JSON.parse(readFileSync(process.env.ILLUSION_STATES, 'utf8')) : null;
const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
});
try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.MV_TEST_URL || 'http://localhost:8082'}/?demo=1`);
    await page.locator('.hero-exp-bar').first().waitFor({ state: 'attached' });
    await page.evaluate(async () => {
        const service = window.ng.getComponent(document.querySelector('app-root')).connection;
        window.illusionService = service;
        window.illusionBase = service.connection();
        await service.stop();
    });
    for (const mode of ['self', 'observer', 'replay']) {
        const counts = [];
        for (const stage of ['before', 'during', 'after']) {
            await page.evaluate(({ input, stage, mode }) => {
                const base = window.illusionBase;
                const state = structuredClone(input || base.state);
                const settings = structuredClone(base.settings);
                state.match.isObserver = mode === 'observer';
                state.match.isReplay = mode === 'replay';
                for (const profile of [settings.player, settings.observer]) {
                    profile.heroExpProgressEnabled = true;
                    profile.heroAbilitiesEnabled = true;
                    profile.heroItemsEnabled = true;
                    profile.heroLevelEnabled = true;
                }
                if (!input) for (const player of state.players) {
                    for (const hero of Object.values(player.heroes || {})) hero.isIllusion = false;
                    const real = Object.values(player.heroes || {})[0];
                    if (real && stage === 'during') for (let i = 1; i <= 2; i++) {
                        const id = (100 + Number(player.id) * 10 + i).toString(16).padStart(16, '0');
                        player.heroes[id] = { ...real, id, isIllusion: true };
                    }
                }
                window.illusionService.connection.set({ ...base, state, settings });
            }, { input: captured?.[stage], stage, mode });
            await page.waitForTimeout(400);
            counts.push(await page.locator('.hero-exp-bar').count());
        }
        assert.ok(counts[0] > 0, `${mode}: originals must render`);
        assert.deepEqual(counts, [counts[0], counts[0], counts[0]], `${mode}: copies must never add hero panels`);
        console.log(`${mode}: hero panels before/during/after = ${counts.join('/')}`);
    }
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
}
