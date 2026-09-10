import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Exercise Angular's real hero panels using the published SDK dependency.
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
        window.orderService = window.ng.getComponent(document.querySelector('app-root')).connection;
        window.orderBase = window.orderService.connection();
        await window.orderService.stop();
    });
    for (const mode of ['self', 'observer', 'replay']) for (const nativeOrder of [false, true]) {
        let expected;
        for (const permutation of [[0, 1, 2], [0, 2, 1], [2, 1, 0]]) {
            await page.evaluate(({ mode, permutation, nativeOrder }) => {
                const base = window.orderBase;
                const state = structuredClone(base.state);
                const settings = structuredClone(base.settings);
                state.match.isObserver = mode === 'observer';
                state.match.isReplay = mode === 'replay';
                for (const profile of [settings.player, settings.observer]) {
                    profile.heroExpProgressEnabled = true;
                    profile.heroAbilitiesEnabled = true;
                    profile.heroItemsEnabled = true;
                    profile.heroLevelEnabled = true;
                }
                state.players.forEach((player, playerIndex) => {
                    const original = Object.values(player.heroes || {})[0];
                    if (!original) return;
                    const heroes = [0, 1, 2].map(index => ({
                        ...original,
                        id: `0020000${playerIndex}0000000${index}`,
                        isIllusion: false,
                        heroOrder: nativeOrder ? [3, 1, 2][index] : undefined,
                        hitpoints: { current: index === 1 && permutation[1] !== 1 ? 0 : 450, max: 450 },
                        experience: index === 1 && permutation[1] !== 1 ? 9000 : original.experience
                    }));
                    player.heroes = Object.fromEntries(permutation.map(index => [heroes[index].id, heroes[index]]));
                });
                window.orderService.connection.set({ ...base, state, settings });
            }, { mode, permutation, nativeOrder });
            await page.waitForTimeout(100);
            const panels = await page.locator('.hero-area[id]').evaluateAll(elements => elements.map(element => ({
                id: element.id,
                top: Math.round(element.getBoundingClientRect().top)
            })));
            assert.ok(panels.length > 0, `${mode}: hero panels must render`);
            const avatars = panels.filter(panel => /^ID_HEROEXP_[0-9a-f]{16}$/.test(panel.id));
            assert.ok(avatars.length >= 3);
            for (let i = 0; i < avatars.length; i += 3) {
                assert.deepEqual(avatars.slice(i, i + 3).map(panel => Number(panel.id.slice(-1))),
                    nativeOrder ? [1, 2, 0] : [0, 1, 2], `${mode}: native order must take precedence over IDs`);
            }
            if (!expected) expected = panels;
            else assert.deepEqual(panels, expected, `${mode}: hero portraits, XP, vitals, levels, inventory and abilities must keep their slots`);
        }
        console.log(`${mode}, native order=${nativeOrder}: all hero panels retain identity and vertical position across three snapshot permutations`);
    }
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
}
