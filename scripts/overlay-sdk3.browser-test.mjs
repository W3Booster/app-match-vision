import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against an Angular development server; Angular's debug API is the test seam.
// No production test hooks, backend requests, or live account writes are needed.
const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox']
});
try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.MV_TEST_URL || 'http://localhost:8082'}/?demo=1`);
    await page.locator('.hero-exp-bar').first().waitFor({ state: 'attached' });
    await page.evaluate(async () => {
        const service = window.ng.getComponent(document.querySelector('app-root')).connection;
        window.testConnection = service;
        window.testSnapshot = service.connection();
        await service.stop();
    });
    async function render(options = {}) {
        await page.evaluate(options => {
            const base = window.testSnapshot;
            const state = structuredClone(base.state);
            const settings = structuredClone(base.settings);
            Object.assign(state.match, { mode: options.mode || '1v1', isObserver: !!options.observer,
                isReplay: !!options.replay, isReforged: !!options.reforged, status: options.status || 'running' });
            for (const profile of [settings.player, settings.observer]) {
                profile.heroExpProgressEnabled = options.xp !== false;
                profile.heroAbilitiesEnabled = options.abilities !== false;
            }
            if (options.bottomMatchup) settings.player.additionalCSSClasses.MATCHUP_BAR = 'MatchupBarIsBottomCenter';
            for (const player of state.players) {
                const hero = Object.values(player.heroes)[0];
                hero.hitpoints = options.missingHp ? undefined : { current: options.hp ?? 60, max: 100 };
                hero.mana = options.missingMana ? undefined : { current: options.mana ?? 50, max: 100 };
                const id = `000000000000000${Number(player.id) + 1}`;
                player.buildings = options.unobserved ? undefined : { [id]: { id, typeId: 'hbar', production: {
                    queue: options.empty ? [] : [
                        { position: 0, typeId: 'hfoo', progress: options.unknown ? null : options.progress ?? 0.375 },
                        { position: 1, typeId: 'hfoo', progress: 0 },
                        { position: 2, typeId: 'hrif', progress: 0 }
                    ]
                } } };
            }
            if (options.selected !== undefined) state.match.broadcasterPlayerId = options.selected;
            window.testConnection.connection.set({ ...base, state, settings });
        }, options);
        await page.waitForTimeout(80);
    }
    for (const reforged of [false, true]) {
        for (const mode of ['1v1', '2v2', 'FFA']) {
            for (const observer of [false, true]) {
                await render({ reforged, mode, observer });
                const teamObserver = observer && mode === '2v2';
                assert.equal(await page.locator('.hero-hp-bar').count(), teamObserver ? 0 : 2);
                assert.equal(await page.locator('.hero-mana-bar').count(), teamObserver ? 0 : 2);
                assert.equal(await page.locator('.hero-exp-bar').count(), teamObserver ? 0 : 2);
                if (!teamObserver) {
                    assert.equal(await page.locator('.hero-hp-bar').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 0)');
                    assert.equal(await page.locator('.hero-mana-bar').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 170, 253)');
                }
                assert.equal(await page.locator('.building-queue').count(), observer ? 2 : 1);
                assert.equal(await page.locator('.queue-slot').count(), observer ? 6 : 3);
            }
        }
        for (const [hp, color] of [[100, 'rgb(0, 255, 0)'], [60, 'rgb(255, 255, 0)'], [30, 'rgb(255, 128, 0)']]) {
            await render({ reforged, hp });
            assert.equal(await page.locator('.hero-hp-bar').first().evaluate(el => getComputedStyle(el).backgroundColor), color);
        }
        for (const missing of [{ hp: 0 }, { missingHp: true }]) {
            await render({ reforged, ...missing });
            assert.equal(await page.locator('.hero-hp-bar, .hero-mana-bar').count(), 0);
        }
        await render({ reforged, missingMana: true });
        assert.equal(await page.locator('.hero-hp-bar').count(), 2);
        assert.equal(await page.locator('.hero-mana-bar').count(), 0);
        await render({ reforged, mana: 0 });
        assert.equal(await page.locator('.hero-mana-bar').first().evaluate(el => el.style.width), '0%');
        await render({ reforged, xp: false });
        assert.equal(await page.locator('.hero-exp-bar').count(), 0);
        assert.equal(await page.locator('.hero-hp-bar').count(), 2, 'Abilities alone retain the legacy bars');
        await render({ reforged, xp: false, abilities: false });
        assert.equal(await page.locator('.hero-hp-bar, .hero-mana-bar').count(), 0);
        await render({ reforged, abilities: false });
        assert.equal(await page.locator('.hero-hp-bar').count(), 2, 'XP alone retains the bars');
    }
    await render({ replay: true, selected: '1', unknown: true });
    assert.equal(await page.locator('.player-production').first().getAttribute('data-player-id'), '1');
    assert.equal(await page.locator('.progress-track').first().getAttribute('aria-valuenow'), null);
    assert.equal(await page.locator('.progress-label').first().textContent(), '?');
    await render({ observer: true, progress: 0 });
    assert.equal(await page.locator('.progress-track').first().getAttribute('aria-valuenow'), '0');
    await page.locator('.building-queue').first().evaluate(el => { window.previousQueue = el; });
    await render({ observer: true, progress: 0.5 });
    assert.equal(await page.locator('.progress-track').first().getAttribute('aria-valuenow'), '50');
    assert.ok(await page.locator('.building-queue').first().evaluate(el => el === window.previousQueue), 'Progress updates reuse building DOM');
    for (const option of [{ empty: true }, { unobserved: true }, { status: 'finished' }]) {
        await render(option);
        assert.equal(await page.locator('.production').count(), 0);
    }
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 800, height: 450 }]) {
        await page.setViewportSize(viewport);
        await render({ observer: true });
        const bounds = await page.locator('.production').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await render({ observer: true });
    if (process.env.MV_SCREENSHOT) await page.screenshot({ path: process.env.MV_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log('Classic/reforged × player/observer × 1v1/team/FFA: legacy vitals policy/colors and production queues passed.');
    console.log('Replay ordering, missing/zero data, duplicate slots, unknown/changed progress, cancellation, lifecycle and viewport bounds passed.');
} finally {
    await browser.close();
}
