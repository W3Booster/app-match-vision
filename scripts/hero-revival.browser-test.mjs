import assert from 'node:assert/strict';
import { launchTestBrowser } from './test-browser.mjs';

const browser = await launchTestBrowser();
try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.MV_TEST_URL || 'http://localhost:8082'}/?demo=1`);
    await page.locator('.hero-exp-bar').first().waitFor({ state: 'attached' });
    await page.evaluate(async () => {
        window.revivalService = window.ng.getComponent(document.querySelector('app-root')).connection;
        window.revivalBase = window.revivalService.connection();
        await window.revivalService.stop();
    });
    async function update(options = {}) {
        await page.evaluate(options => {
            const base = window.revivalBase;
            const state = JSON.parse(JSON.stringify(base.state));
            const settings = JSON.parse(JSON.stringify(base.settings));
            state.match.isObserver = options.mode !== 'self';
            state.match.isReplay = options.mode === 'replay';
            state.match.isReforged = options.reforged === true;
            state.application.surface = options.surface || 'ingameOverlay';
            for (const profile of [settings.player, settings.observer]) {
                profile.heroExpProgressEnabled = options.details !== false;
                profile.heroAbilitiesEnabled = options.details !== false;
                profile.productionQueuesEnabled = false;
            }
            for (const player of state.players) {
                const hero = Object.values(player.heroes || {})[0];
                if (!hero) continue;
                player.heroes = { [hero.id]: { ...hero, hitpoints: { current: options.alive ? 50 : 0, max: 500 } } };
                player.buildings = { altar: { id: 'altar', typeId: 'halt', production: { queue: options.cancel ? [] : [{
                    position: 0, typeId: hero.typeId, buildType: 'reviving', progress: options.progress === undefined ? .4 : options.progress,
                    totalSeconds: 50, remainingSeconds: options.remaining === undefined ? 29.2 : options.remaining
                }] } } };
            }
            window.revivalService.connection.set({ ...base, state, settings });
        }, options);
        await page.waitForTimeout(250);
    }
    for (const mode of ['self', 'observer', 'replay']) for (const reforged of [false, true]) for (const surface of ['ingameOverlay', 'streamOverlay']) {
        await update({ mode, reforged, surface, details: false });
        const bars = page.locator('.hero-revival-wrapper');
        assert.ok(await bars.count() > 0, `${mode}/${reforged}/${surface}: bar visible independently of hero detail and production settings`);
        for (const bar of await bars.all()) {
            assert.equal(await bar.locator('.hero-revival-countdown').innerText(), '30s');
            const geometry = await bar.evaluate(element => {
                const track = element.querySelector('[role=progressbar]').getBoundingClientRect();
                const fill = element.querySelector('.hero-revival-fill').getBoundingClientRect();
                return { width: track.width, fill: fill.width, left: fill.left, trackLeft: track.left };
            });
            assert.ok(geometry.width >= 65 && geometry.width <= 75);
            assert.ok(Math.abs(geometry.left - geometry.trackLeft - 2) < 1, 'fill grows from physical left on both sides');
            assert.equal(await bar.locator('[role=progressbar]').getAttribute('aria-valuenow'), '40');
            const countdown = await bar.locator('.hero-revival-countdown').boundingBox();
            for (const level of await page.locator('.hero-level').all()) {
                const badge = await level.boundingBox();
                if (!badge) continue;
                const overlaps = countdown.x < badge.x + badge.width && countdown.x + countdown.width > badge.x
                    && countdown.y < badge.y + badge.height && countdown.y + countdown.height > badge.y;
                assert.equal(overlaps, false, 'revival countdown must not overlap a hero level badge');
            }
        }
    }
    await update({ progress: null, remaining: null });
    assert.equal(await page.locator('.hero-revival-countdown').first().innerText(), '—');
    assert.equal(await page.locator('[aria-label="Hero revival"]').first().getAttribute('aria-valuenow'), null);
    for (const options of [{ cancel: true }, { alive: true }, { progress: 1, remaining: 0 }]) {
        await update(options);
        assert.equal(await page.locator('.hero-revival-wrapper').count(), 0, 'stale revival is removed');
    }
    assert.deepEqual(errors, []);
    console.log('Hero revival: both surfaces, sides and artwork families; self/observer/replay; settings, timers and lifecycle passed.');
} finally {
    await browser.close();
}
