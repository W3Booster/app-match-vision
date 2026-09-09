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
            settings.player.productionQueuesEnabled = options.playerQueues !== false;
            settings.observer.productionQueuesEnabled = options.observerQueues !== false;
            if (options.bottomMatchup) settings.player.additionalCSSClasses.MATCHUP_BAR = 'MatchupBarIsBottomCenter';
            for (const player of state.players) {
                const hero = Object.values(player.heroes)[0];
                hero.hitpoints = options.missingHp ? undefined : { current: options.hp ?? 60, max: 100 };
                hero.mana = options.missingMana ? undefined : { current: options.mana ?? 50, max: 100 };
                const id = `000000000000000${Number(player.id) + 1}`;
                player.buildings = options.unobserved ? undefined : { [id]: { id, typeId: 'hbar', production: {
                    queue: options.empty || (options.emptyLeft && player.id === '0') ? [] : [
                        { position: 0, typeId: 'hfoo', progress: options.unknown ? null : options.progress ?? 0.375 },
                        { position: 1, typeId: 'hfoo', progress: 0 },
                        { position: 2, typeId: 'hrif', progress: 0 }
                    ]
                } } };
            }
            if (options.secondBuilding) {
                const buildings = state.players[0].buildings;
                buildings['0000000000000003'] = { ...structuredClone(buildings['0000000000000001']), id: '0000000000000003' };
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
    await render({ playerQueues: false });
    assert.equal(await page.locator('.production').count(), 0);
    await render({ observer: true, playerQueues: false });
    assert.equal(await page.locator('.building-queue').count(), 2, 'Player toggle does not change observer settings');
    await render({ replay: true, observerQueues: false });
    assert.equal(await page.locator('.production').count(), 0);
    await render({ observer: true, emptyLeft: true });
    assert.equal(await page.locator('.production-side').getAttribute('data-side'), 'right', 'An idle left player does not move the right queue');
    await render({ observer: true, secondBuilding: true });
    assert.equal(await page.locator('.production .player-name').count(), 0);
    const rows = await page.locator('.production-side:not(.right) .building-queue').evaluateAll(es => es.map(e => {
        const r=e.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left };
    }));
    assert.equal(rows.length, 2);
    assert.ok(rows[1].top > rows[0].bottom && rows[1].left === rows[0].left, 'Each building occupies its own row');
    assert.ok(Math.abs((rows[0].top + rows[0].bottom) / 2 - 540) <= 1, 'First row starts at vertical center');
    const fonts = await page.evaluate(() => ['.hero-level', '.progress-label'].map(selector => {
        const s=getComputedStyle(document.querySelector(selector)); return { family:s.fontFamily, size:s.fontSize, weight:s.fontWeight };
    }));
    assert.deepEqual(fonts[0], fonts[1], 'Percentages match the hero level font');
    // Observe actual interpolation without extrapolating beyond the delivered value.
    await render({ observer: true, progress: 0.2 });
    await page.waitForTimeout(250);
    await render({ observer: true, progress: 0.8 });
    const fraction = () => page.locator('.progress-fill').first().evaluate(e => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width);
    const intermediate = await fraction();
    assert.ok(intermediate > 0.2 && intermediate < 0.8, 'Progress animates between snapshots');
    await page.waitForTimeout(250);
    assert.ok(Math.abs(await fraction() - 0.8) < 0.01, 'Animation stops at the delivered value');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.progress-fill').first().evaluate(e=>getComputedStyle(e).transitionDuration), '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 800, height: 450 }]) {
        await page.setViewportSize(viewport);
        await render({ observer: true });
        for (const panel of await page.locator('.production-side').all()) {
            const bounds = await panel.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
            assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
        }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await render({ observer: true });
    if (process.env.MV_SCREENSHOT) await page.screenshot({ path: process.env.MV_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log('Classic/reforged × player/observer × 1v1/team/FFA: legacy vitals policy/colors and production queues passed.');
    console.log('Queue toggles, fixed player sides, one building per row, level font and animated progress passed.');
    console.log('Replay ordering, missing/zero data, duplicate slots, unknown/changed progress, cancellation, lifecycle and viewport bounds passed.');
} finally {
    await browser.close();
}
