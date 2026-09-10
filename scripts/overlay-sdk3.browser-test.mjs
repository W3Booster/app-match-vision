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
                profile.heroItemsEnabled = options.inventory !== false;
                profile.heroLevelEnabled = options.level !== false;
            }
            settings.player.constructionEnabled = options.playerConstruction !== false;
            settings.observer.constructionEnabled = options.observerConstruction !== false;
            settings.player.productionQueuesEnabled = options.playerQueues !== false;
            settings.observer.productionQueuesEnabled = options.observerQueues !== false;
            for (const player of state.players) {
                const hero = Object.values(player.heroes)[0];
                hero.abilities = (options.fourAbilities ? ['AHwe', 'AHbz', 'AHab', 'AHmt'] : ['AHwe']).map((name, index) => ({ id: 'ability-' + player.id + '-' + index, name, level: 1, lastActivation: 1000 }));
                hero.hitpoints = options.missingHp ? undefined : { current: options.hp ?? 60, max: 100 };
                hero.mana = options.missingMana ? undefined : { current: options.mana ?? 50, max: 100 };
                const id = `000000000000000${Number(player.id) + 1}`;
                player.buildings = options.unobserved ? undefined : { [id]: { id, typeId: 'hbar', production: {
                    queue: options.empty || (options.emptyLeft && player.id === '0') || (options.emptyRight && player.id === '1') ? [] : [
                        { position: 0, typeId: options.activeType ?? 'hfoo', progress: options.unknown ? null : options.blocked ? 0 : options.progress ?? 0.38, remainingSeconds: options.unknown || options.blocked ? null : options.remainingSeconds ?? 12.4, totalSeconds: options.unknown || options.blocked ? null : 20 },
                        ...(options.waitingTypes ?? ['hfoo', 'hrif']).map((typeId, index) => ({ position: index + 1, typeId, progress: 0, remainingSeconds: null, totalSeconds: null }))
                    ]
                } } };
            }
            if (options.construction) {
                for (const player of state.players) {
                    for (let i = 0; i < (options.constructionCount ?? 2); i++) {
                        const id = 'construction-' + player.id + '-' + i;
                        player.buildings[id] = { id, typeId: 'hhou', construction: {
                            progress: options.constructionUnknown ? null : options.constructionBlocked ? 0 : options.constructionProgress ?? 0.4,
                            remainingSeconds: options.constructionUnknown || options.constructionBlocked ? null : options.constructionRemaining ?? 12.1,
                            totalSeconds: options.constructionUnknown || options.constructionBlocked ? null : 20
                        } };
                    }
                }
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
    for (const reforged of [false, true]) {
        for (const view of [{}, { observer: true }, { replay: true }]) {
            for (const inventory of [true, false]) {
                for (const level of [true, false]) {
                    await render({ reforged, ...view, xp: false, abilities: false, inventory, level });
                    assert.equal(await page.locator('.hero-exp-bar, .hero-ability-area, .hero-hp-bar, .hero-mana-bar').count(), 0);
                    assert.equal(await page.locator('.hero-area.inventory').count(), inventory ? 2 : 0,
                        'Inventory follows its own setting with abilities and XP disabled');
                    assert.equal(await page.locator('.hero-level').count(), level ? 2 : 0,
                        'Hero level follows its own setting with abilities and XP disabled');
                }
            }
        }
    }
    for (const reforged of [false, true]) {
        for (const observer of [false, true]) {
            await render({ reforged, observer, threeHeroes: true, fourAbilities: true, inventory: true }, 500);
            const inventoryContent = await page.locator('.hero-area.inventory').evaluateAll(es => es.map(e => {
                const r = e.getBoundingClientRect();
                return { opponent: e.classList.contains('hero-area-opponent'),
                    top: r.top + 3, left: r.left + 3, right: r.right - 3 };
            }));
            await render({ reforged, observer, threeHeroes: true, fourAbilities: true, inventory: false }, 500);
            assert.equal(await page.locator('.hero-area.inventory').count(), 0);
            const abilities = await page.locator('.hero-ability-area').evaluateAll(es => es.map(e => {
                const r = e.querySelector('.ability-icon-wrapper').getBoundingClientRect();
                return { top: r.top, left: r.left, right: r.right };
            }));
            assert.equal(abilities.length, inventoryContent.length);
            for (let i = 0; i < abilities.length; i++) {
                const edge = inventoryContent[i].opponent ? 'right' : 'left';
                assert.ok(Math.abs(abilities[i][edge] - inventoryContent[i][edge]) < 1, 'Abilities occupy the inventory content edge when inventory is hidden');
                assert.ok(Math.abs(abilities[i].top - inventoryContent[i].top) < 1, 'Abilities occupy the inventory content top for each hero');
            }
        }
    }
    for (const reforged of [false, true]) {
        for (const view of [{}, { observer: true }, { replay: true }]) {
            const sides = view.observer || view.replay ? 2 : 1;
            await render({ reforged, ...view, construction: true });
            assert.equal(await page.locator('.construction-row').count(), sides);
            assert.equal(await page.locator('.construction-entry').count(), sides * 2);
            assert.equal(await page.locator('.construction-source img').first().getAttribute('src').then(s => s.includes('btnbasicstruct')), true);
            assert.equal((await page.locator('.construction-entry .production-cooldown').first().textContent()).trim(), '13');
            for (const group of await page.locator('.player-production').all()) {
                const layout = await group.evaluate(el => {
                    const row = el.querySelector('.construction-row').getBoundingClientRect();
                    const queue = el.querySelector('.building-queue').getBoundingClientRect();
                    const icons = [...el.querySelectorAll('.construction-entry')].map(e => e.getBoundingClientRect());
                    return { bottom: row.bottom, queueTop: queue.top, tops: icons.map(i => i.top) };
                });
                assert.ok(layout.bottom < layout.queueTop, 'Construction is the first row above unit chains');
                assert.equal(layout.tops[0], layout.tops[1], 'Buildings under construction share one horizontal row');
            }
            await render({ reforged, ...view, construction: true, playerQueues: false, observerQueues: false });
            assert.equal(await page.locator('.building-queue').count(), 0);
            assert.equal(await page.locator('.construction-row').count(), sides, 'Construction is independent of queue visibility');
            await render({ reforged, ...view, construction: true, playerConstruction: false, observerConstruction: false });
            assert.equal(await page.locator('.construction-row').count(), 0);
            assert.equal(await page.locator('.building-queue').count(), sides);
            await render({ reforged, ...view, construction: true, playerConstruction: false, observerConstruction: false, playerQueues: false, observerQueues: false });
            assert.equal(await page.locator('.production').count(), 0);
        }
    }
    await render({ construction: true, constructionUnknown: true });
    assert.equal(await page.locator('.construction-entry .progress-track').first().getAttribute('aria-valuenow'), null);
    assert.equal((await page.locator('.construction-entry .production-cooldown').first().textContent()).trim(), '?');
    await render({ construction: true, constructionBlocked: true });
    assert.equal(await page.locator('.construction-entry .production-pause').count(), 2);
    await render({ construction: true });
    await page.locator('.construction-entry').first().evaluate(el => { window.previousConstruction = el; });
    await render({ construction: true, constructionProgress: 0.6, constructionRemaining: 8 });
    assert.ok(await page.locator('.construction-entry').first().evaluate(el => el === window.previousConstruction));
    assert.equal((await page.locator('.construction-entry .production-cooldown').first().textContent()).trim(), '8');
    await render({ construction: true, constructionProgress: 1, constructionRemaining: 0 });
    assert.equal(await page.locator('.construction-row').count(), 0, 'Completed buildings leave the construction row');
    await render({ construction: true });
    await render({});
    assert.equal(await page.locator('.construction-row').count(), 0, 'Cancelled or no-longer-observed construction is removed');
    await render({ observer: true, construction: true, playerConstruction: false });
    assert.equal(await page.locator('.construction-row').count(), 2, 'Player toggle does not override observer construction setting');
    await render({ replay: true, selected: '1', unknown: true });
    assert.equal(await page.locator('.player-production').first().getAttribute('data-player-id'), '1');
    assert.equal(await page.locator('.progress-track').first().getAttribute('aria-valuenow'), null);
    assert.equal((await page.locator('.production-cooldown').first().textContent()).trim(), '?');
    await render({ observer: true, blocked: true });
    assert.equal(await page.locator('.production-pause').count(), 2, 'Blocked production shows a pause sign');
    assert.equal((await page.locator('.production-cooldown').first().textContent()).trim(), '', 'Blocked production has no question mark');
    await render({ observer: true, remainingSeconds: 12.4 });
    assert.equal((await page.locator('.production-cooldown').first().textContent()).trim(), '13');
    await page.locator('.production-cooldown').first().evaluate(e => { window.previousCountdown = e; });
    await render({ observer: true, remainingSeconds: 11.4 }, 25);
    assert.equal((await page.locator('.production-cooldown').first().textContent()).trim(), '12');
    assert.ok(await page.locator('.production-cooldown').first().evaluate(e => e === window.previousCountdown && e.getAnimations().length === 0), 'Countdown text updates immediately in the same element without animation');
    await render({ observer: true, remainingSeconds: 0 });
    assert.equal((await page.locator('.production-cooldown').first().textContent()).trim(), '0');
    await render({ observer: true, progress: 0, remainingSeconds: null, totalSeconds: null });
    assert.equal(await page.locator('.progress-track').first().getAttribute('aria-valuenow'), '0');
    await page.locator('.building-queue').first().evaluate(el => { window.previousQueue = el; });
    await render({ observer: true, progress: 0.5, remainingSeconds: null, totalSeconds: null });
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
    assert.equal(geometry.waiting[0].width, 19, 'Waiting icons fill the 42px image height with 1px outer margins and a 2px gap');
    assert.equal(new Set(geometry.waiting.map(r => r.y)).size, 2, 'Waiting icons occupy exactly two rows');
    assert.ok(geometry.waiting.slice(0, 3).every(r => r.top === geometry.waiting[0].top), 'First three waiting units fill the top row');
    assert.ok(geometry.waiting.slice(3).every(r => r.top === geometry.waiting[3].top), 'Next three waiting units fill the second row');
    assert.equal(geometry.waiting[3].left, geometry.waiting[0].left, 'Second row restarts at the first column');
    assert.equal(Math.min(...geometry.waiting.map(r => r.top)), geometry.active.top + 1, 'Waiting rows keep a 1px top margin');
    assert.equal(Math.max(...geometry.waiting.map(r => r.bottom)), geometry.active.bottom - 1, 'Waiting rows keep a 1px bottom margin');
    assert.equal(geometry.waiting[3].top - geometry.waiting[0].bottom, 2, 'Waiting rows have a 2px gap');
    assert.equal(geometry.waiting[1].left - geometry.waiting[0].right, 2, 'Waiting columns have a 2px gap');
    assert.equal(geometry.progress.top, geometry.active.bottom, 'Progress touches the image without a gap');
    assert.ok(geometry.badge.right < geometry.active.left, 'Small building icon precedes the active unit without overlap');
    assert.equal(geometry.badge.width, await page.locator('.upgrade-icon').first().evaluate(e => e.getBoundingClientRect().width), 'Building icon matches upgrade size');
    assert.equal(geometry.active.width, await page.locator('.ability-icon').first().evaluate(e => e.getBoundingClientRect().width), 'Active unit matches ability size');
    assert.equal(await page.locator('.building-queue .queue-arrow').first().textContent(), '›');
    const mirrored = await page.locator('.production-side.right .building-queue').first().evaluate(row => ({ building: row.querySelector('.building-icon').getBoundingClientRect().left, active: row.querySelector('.active').getBoundingClientRect().right }));
    assert.ok(mirrored.building > mirrored.active, 'Right-side queue mirrors the building and arrow arrangement');
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
    assert.ok(await page.locator('.building-queue').first().evaluate(row => row.getAnimations({ subtree: true }).some(a => a.playState === 'running')), 'Queue replacement animates');
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.active .unit-image img').first().getAttribute('alt'), 'hrif');
    assert.equal(await page.locator('.active > .unit-image').count(), 2, 'Outgoing icons are removed after transitions');
    await render({ observer: true, empty: true }, 25);
    assert.ok(await page.locator('.production').count(), 'Queue removal retains its exit transition');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.production').count(), 0, 'Queue removal completes without stale rows');
    // A growing/collapsing row must not leak its full-height contents into the
    // panel's scroll area before the animation has finished.
    await render({ observer: true });
    for (const secondBuilding of [true, false]) {
        await page.evaluate(() => {
            window.rowOverflowSamples = [];
            const until = performance.now() + 350;
            const sample = () => {
                for (const panel of document.querySelectorAll('.production-side')) {
                    window.rowOverflowSamples.push({ side: panel.dataset.side,
                        horizontal: panel.scrollWidth - panel.clientWidth,
                        vertical: panel.scrollHeight - panel.clientHeight });
                }
                if (performance.now() < until) requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
        await render({ observer: true, secondBuilding }, 380);
        const samples = await page.evaluate(() => window.rowOverflowSamples);
        assert.ok(samples.length > 10, 'Observe multiple frames during row changes');
        assert.ok(samples.every(s => s.horizontal <= 1 && s.vertical <= 1),
            `Row ${secondBuilding ? 'entry' : 'removal'} must not create temporary scrollbars: ${JSON.stringify(samples.filter(s => s.horizontal > 1 || s.vertical > 1).slice(0, 3))}`);
    }
    // Observe actual interpolation without extrapolating beyond the delivered value.
    await render({ observer: true, progress: 0.2, remainingSeconds: null, totalSeconds: null });
    await page.waitForTimeout(250);
    await render({ observer: true, progress: 0.8, remainingSeconds: null, totalSeconds: null }, 40);
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
    for (const reforged of [false, true]) {
        await render({ reforged });
        for (const status of ['loading', 'ready', 'unavailable']) {
            await page.evaluate(status => {
                const current = window.testConnection.connection();
                const state = structuredClone(current.state);
                state.players.forEach((player, i) => {
                    player.stats = { status, records: status === 'ready' ? [{
                        provider: 'bnet', gameMode: '1v1', queue: 'individual', season: 9,
                        race: player.race, mmr: i ? 2639 : 2880, wins: i ? 214 : 0,
                        losses: i ? 232 : 4, winRate: i ? 100 * 214 / 446 : 0,
                        ...(i ? { rank: 5294 } : {}), league: i ? 3 : 0
                    }] : [] };
                });
                window.testConnection.connection.set({ ...current, state });
            }, status);
            await page.waitForTimeout(80);
            assert.equal(await page.locator('.stats-loading').count(), status === 'loading' ? 2 : 0);
            assert.equal(await page.locator('.player-rank').count(), status === 'ready' ? 2 : 0);
            if (status === 'ready') {
                const meta = await page.locator('.player-rating-meta').evaluateAll(es => es.map(e => {
                    const rank = e.querySelector('.player-rank'), icon = e.querySelector('.player-league');
                    const style = getComputedStyle(rank.querySelector('small'));
                    return { text: rank.textContent.trim(), rank: rank.getBoundingClientRect().toJSON(),
                        icon: icon.getBoundingClientRect().toJSON(), font: [style.fontFamily, style.fontSize, style.color] };
                }));
                assert.equal(meta[0].text, 'UNRANKED');
                assert.match(meta[1].text, /RANK.*5294/);
                assert.deepEqual(meta[0].font, meta[1].font, 'Unranked uses the rank label style');
                assert.ok(meta[0].rank.right <= meta[0].icon.left, 'Left label precedes the league icon');
                assert.ok(meta[1].icon.right <= meta[1].rank.left, 'Right player mirrors the label/icon order');
                assert.match(await page.locator('.team-1 .player-stats').innerText(), /2639/);
            }
        }
    }
    assert.deepEqual(errors, []);
    console.log('Stats loading/ready/unavailable transitions and mirrored rank/unranked labels passed in classic and reforged.');
    console.log('Classic/reforged × player/observer × 1v1/team/FFA: legacy vitals policy/colors and production queues passed.');
    console.log('Queue toggles, fixed player sides, one building per row, compact two-row waiting icons, building badges, separate progress bars and transitions passed.');
    console.log('Replay ordering, missing/zero data, duplicate slots, unknown/changed progress, cancellation, lifecycle and viewport bounds passed.');
} finally {
    await browser.close();
}
