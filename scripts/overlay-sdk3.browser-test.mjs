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
    async function render(options = {}, settleMs = 260) {
        await page.evaluate(options => {
            const base = window.testSnapshot;
            const state = structuredClone(base.state);
            const settings = structuredClone(base.settings);
            Object.assign(state.match, { mode: options.mode || '1v1', isObserver: !!options.observer,
                isReplay: !!options.replay, gameTime: 5, isReforged: !!options.reforged, status: options.status || 'running' });
            for (const profile of [settings.player, settings.observer]) {
                profile.heroExpProgressEnabled = options.xp !== false;
                profile.heroAbilitiesEnabled = options.abilities !== false;
            }
            settings.player.productionQueuesEnabled = options.playerQueues !== false;
            settings.observer.productionQueuesEnabled = options.observerQueues !== false;
            if (options.bottomMatchup) settings.player.additionalCSSClasses.MATCHUP_BAR = 'MatchupBarIsBottomCenter';
            for (const player of state.players) {
                const hero = Object.values(player.heroes)[0];
                hero.abilities = [{ id: 'ability-' + player.id, name: 'AHwe', level: 1, lastActivation: 1000 }];
                hero.hitpoints = options.missingHp ? undefined : { current: options.hp ?? 60, max: 100 };
                hero.mana = options.missingMana ? undefined : { current: options.mana ?? 50, max: 100 };
                const id = `000000000000000${Number(player.id) + 1}`;
                player.buildings = options.unobserved ? undefined : { [id]: { id, typeId: 'hbar', production: {
                    queue: options.empty || (options.emptyLeft && player.id === '0') || (options.emptyRight && player.id === '1') ? [] : [
                        { position: 0, typeId: options.activeType ?? 'hfoo', progress: options.unknown ? null : options.progress ?? 0.38, remainingSeconds: options.unknown ? null : options.remainingSeconds ?? 12.4, totalSeconds: options.unknown ? null : 20 },
                        ...(options.waitingTypes ?? ['hfoo', 'hrif']).map((typeId, index) => ({ position: index + 1, typeId, progress: 0 }))
                    ]
                } } };
            }
            if (options.threeHeroes) {
                for (const player of state.players) {
                    const hero = Object.values(player.heroes)[0];
                    for (let i = 1; i < 3; i++) {
                        const id = hero.id + '-' + i;
                        player.heroes[id] = { ...structuredClone(hero), id };
                    }
                }
            }
            if (options.secondBuilding) {
                const buildings = state.players[0].buildings;
                buildings['0000000000000003'] = { ...structuredClone(buildings['0000000000000001']), id: '0000000000000003' };
            }
            if (options.selected !== undefined) state.match.broadcasterPlayerId = options.selected;
            window.testConnection.connection.set({ ...base, state, settings });
        }, options);
        await page.waitForTimeout(settleMs);
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
    assert.equal(await page.locator('.production-cooldown').first().textContent(), '?');
    await render({ observer: true, remainingSeconds: 12.4 });
    assert.equal(await page.locator('.production-cooldown').first().textContent(), '13');
    await render({ observer: true, remainingSeconds: 0 });
    assert.equal(await page.locator('.production-cooldown').first().textContent(), '0');
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
    await render({ replay: true, selected: '1', emptyRight: true });
    assert.equal(await page.locator('.production-side').getAttribute('data-side'), 'right', 'Other player queue remains visible when selected replay player is idle');
    assert.equal(await page.locator('.player-production').getAttribute('data-player-id'), '0');
    await render({ observer: true, secondBuilding: true });
    assert.equal(await page.locator('.production .player-name').count(), 0);
    const rows = await page.locator('.production-side:not(.right) .building-queue').evaluateAll(es => es.map(e => {
        const r=e.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left };
    }));
    assert.equal(rows.length, 2);
    assert.ok(rows[1].top > rows[0].bottom && rows[1].left === rows[0].left, 'Each building occupies its own row');
    assert.ok(Math.abs(rows[0].top - (1080 * 0.2155 + 89 + 2 + 8)) <= 1, 'First row reserves the full third hero and an 8px gap');
    const fonts = await page.evaluate(() => ['.ability-icon .cooldown', '.production-cooldown'].map(selector => {
        const s=getComputedStyle(document.querySelector(selector)); return { family:s.fontFamily, size:s.fontSize, weight:s.fontWeight };
    }));
    assert.deepEqual(fonts[0], fonts[1], 'Remaining seconds match the ability cooldown font');
    await render({ observer: true, waitingTypes: ['hfoo', 'hrif', 'hkni', 'hfoo', 'hrif', 'hkni'] });
    const geometry = await page.locator('.building-queue').first().evaluate(row => {
        const rect = selector => row.querySelector(selector).getBoundingClientRect().toJSON();
        return { active: rect('.active'), progress: rect('.progress-track'), badge: rect('.building-icon'),
            waiting: [...row.querySelectorAll('.waiting')].map(e => e.getBoundingClientRect().toJSON()),
            border: getComputedStyle(row).borderTopWidth, background: getComputedStyle(row).backgroundColor };
    });
    assert.equal(geometry.active.width / geometry.waiting[0].width, 3, 'Waiting icons are one-third size');
    assert.equal(new Set(geometry.waiting.map(r => r.y)).size, 2, 'Waiting icons occupy exactly two rows');
    assert.equal(geometry.waiting[0].x, geometry.waiting[1].x, 'Queue fills top to bottom, then the next column');
    assert.equal(geometry.progress.top, geometry.active.bottom, 'Progress touches the image without a gap');
    assert.ok(geometry.badge.left > geometry.active.right, 'Building badge sits beside the image without covering the face');
    assert.equal(geometry.badge.bottom, geometry.progress.bottom, 'Building badge aligns with the bar bottom');
    assert.equal(geometry.border, '0px');
    assert.equal(geometry.background, 'rgba(0, 0, 0, 0)', 'Building row has no surrounding box');
    const decoration = await page.locator('.building-queue').first().evaluate(row => {
        const style = selector => getComputedStyle(row.querySelector(selector));
        const backdrop = row.querySelector('.production-backdrop');
        return { borders: [...row.querySelectorAll('.queue-slot, .building-icon')].map(e => getComputedStyle(e).borderWidth),
            shadow: style('.building-icon').boxShadow, clipped: style('.building-icon').overflow,
            backdrop: style('.production-backdrop').backgroundColor,
            height: backdrop.getBoundingClientRect().height / row.querySelector('.active').getBoundingClientRect().height,
            barBorder: style('.progress-track').borderTopWidth, barColor: style('.progress-track').borderTopColor,
            barShade: getComputedStyle(row.querySelector('.progress-track'), '::after').backgroundImage,
            badgeAboveBackdrop: Number(style('.building-icon').zIndex) > Number(style('.production-backdrop').zIndex) };
    });
    assert.ok(decoration.borders.every(width => width === '0px'), 'Artwork has no extra CSS borders');
    assert.equal(decoration.barBorder, '2px');
    assert.equal(decoration.barColor, 'rgb(0, 0, 0)');
    assert.equal(decoration.barShade, await page.locator('.hero-bar-gradient').first().evaluate(e => getComputedStyle(e).backgroundImage), 'Production uses the health-bar shading');
    assert.equal(decoration.shadow, 'none');
    assert.equal(decoration.clipped, 'hidden', 'Building artwork frame is cropped');
    assert.equal(decoration.backdrop, await page.locator('.ability-icon .cooldown-animation').first().evaluate(e => getComputedStyle(e).backgroundColor), 'Production shares the ability cooldown backdrop');
    assert.ok(Math.abs(decoration.height - 0.62) < 0.01, 'Backdrop shows remaining fraction');
    assert.ok(decoration.badgeAboveBackdrop, 'Building badge stays above the dimming layer');
    await render({ observer: true, activeType: 'hrif', remainingSeconds: 8 }, 25);
    assert.ok(await page.locator('.building-queue').first().evaluate(row => row.getAnimations({ subtree: true }).some(a => a.playState === 'running')), 'Queue replacement and countdown animate');
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.active .unit-image img').first().getAttribute('alt'), 'hrif');
    assert.equal(await page.locator('.active > .unit-image').count(), 2, 'Outgoing icons are removed after transitions');
    await render({ observer: true, empty: true }, 25);
    assert.ok(await page.locator('.production').count(), 'Queue removal retains its exit transition');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.production').count(), 0, 'Queue removal completes without stale rows');
    // Observe actual interpolation without extrapolating beyond the delivered value.
    await render({ observer: true, progress: 0.2 });
    await page.waitForTimeout(250);
    await render({ observer: true, progress: 0.8 }, 40);
    const fraction = () => page.locator('.progress-fill').first().evaluate(e => e.getBoundingClientRect().width / e.parentElement.clientWidth);
    const intermediate = await fraction();
    assert.ok(intermediate > 0.2 && intermediate < 0.8, 'Progress animates between snapshots');
    await page.waitForTimeout(250);
    assert.ok(Math.abs(await fraction() - 0.8) < 0.01, 'Animation stops at the delivered value');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.progress-fill').first().evaluate(e=>getComputedStyle(e).transitionDuration), '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 800, height: 450 }]) {
        await page.setViewportSize(viewport);
        await render({ observer: true, threeHeroes: true });
        const thirdInventoryBottom = await page.locator('.hero-area.inventory:nth-child(3)').evaluateAll(es => Math.max(...es.map(e => e.getBoundingClientRect().bottom)));
        for (const panel of await page.locator('.production-side').all()) {
            const bounds = await panel.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
            assert.ok(bounds.y >= thirdInventoryBottom + 1 && bounds.y + bounds.height <= viewport.height, 'Production never overlaps the third hero at any viewport scale');
        }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await render({ observer: true });
    if (process.env.MV_SCREENSHOT) await page.screenshot({ path: process.env.MV_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log('Classic/reforged × player/observer × 1v1/team/FFA: legacy vitals policy/colors and production queues passed.');
    console.log('Queue toggles, fixed player sides, one building per row, compact two-row waiting icons, building badges, separate progress bars and transitions passed.');
    console.log('Replay ordering, missing/zero data, duplicate slots, unknown/changed progress, cancellation, lifecycle and viewport bounds passed.');
} finally {
    await browser.close();
}
