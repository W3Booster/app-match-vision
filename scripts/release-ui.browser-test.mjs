import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { once } from 'node:events';
import { launchTestBrowser } from './test-browser.mjs';
import { WebSocketServer } from 'ws';
import { createDemoState } from '@w3booster/sdk/testing';

// Exercise the unmodified production bundle through real SDK broker/host messages.
// Only the host and live match are fixtures. Catalogs and images are real exports.
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'tmp/release-ui', process.env.W3BOOSTER_UI_LABEL || 'electron15');
await mkdir(output, { recursive: true });
const definition = await readFile(resolve(root, 'src/app/core/w3booster-app.generated.ts'), 'utf8');
const clientId = definition.match(/clientId: "([^"]+)"/)[1];
const revision = definition.match(/revision: "([^"]+)"/)[1];
const defaults = JSON.parse(definition.match(/settingsDefaults: (\{[\s\S]*\})\n} as const/)[1]);
const demo = await readFile(resolve(root, 'src/app/core/match-vision-demo.ts'), 'utf8');
const gameDataId = process.env.W3BOOSTER_GAME_DATA_ID || demo.match(/gameDataId: '([^']+)'/)[1];
const catalogPath = '/assets/wc3/game-data/' + gameDataId + '/catalog.json';
const catalog = process.env.W3BOOSTER_STATIC_ROOT
    ? JSON.parse(await readFile(resolve(process.env.W3BOOSTER_STATIC_ROOT, '.' + catalogPath), 'utf8'))
    : await fetch('https://static.w3booster.com' + catalogPath).then(r => { assert.ok(r.ok); return r.json(); });
const iconHash = (kind, typeId, graphics, level = 1) => catalog.images[catalog[kind][typeId].artwork.icon[graphics][level - 1]];
let state = createDemoState({ clientId, settings: defaults });
Object.assign(state.match, { gameDataId, gameVersion: gameDataId.split('-')[0], gameTime: 5, isReforged: false });
const hero = Object.values(state.players[0].heroes)[0];
Object.assign(hero, { typeId: 'Npal', level: 10, abilities: ['AHcr', 'ANcp', 'AHpa', 'AHcl'].map((typeId, i) => ({ id: 'skill-' + i, typeId, level: 1, lastActivation: 1000 })) });
Object.assign(hero, { inventory: ['spre', 'stel', 'stel', '', '', ''], inventoryCooldowns: [{ progress: 0.5, remainingSeconds: 15, totalSeconds: 30 }, null, { progress: 0.25, remainingSeconds: 45, totalSeconds: 60 }, null, null, null] });
state.players[0].controlgroups = { 0: { frontunit: 'Npal', size: 24 }, 1: { frontunit: 'hfoo', size: 13 } };
state.players[0].buildings = {
    '0000000000000001': { id: '0000000000000001', typeId: 'hbar', isIllusion: false, production: { queue: [
        { position: 0, typeId: 'hfoo', progress: 0.4, remainingSeconds: 12, totalSeconds: 20 },
        { position: 1, typeId: 'hrif', progress: 0, remainingSeconds: null, totalSeconds: null }
    ] } },
    '0000000000000002': { id: '0000000000000002', typeId: 'hhou', isIllusion: false, construction: { progress: 0.5, remainingSeconds: 10, totalSeconds: 20 } }
};
for (const [index, typeId, target, seconds] of [[3, 'htow', 'hkee', 140], [4, 'uzig', 'uzg1', 35], [5, 'hwtw', 'hgtw', 50]]) {
    const id = index.toString(16).padStart(16, '0');
    state.players[0].buildings[id] = { id, typeId, isIllusion: false, upgrade: { typeId: target, progress: 0.5, remainingSeconds: seconds / 2, totalSeconds: seconds } };
}
state.players[0].upgrades.active = [{ typeId: 'Rhme', level: 1, gametime: 1 }];
state.players[0].apm = 0;
state.players[1].apm = 178;
// These SDK observations are available to other apps, but Match Vision does not display them.
for (const player of state.players) for (const hero of Object.values(player.heroes || {})) {
    hero.combat = { damageDealt: 1000, selfDamage: 28, damageReceived: 98, healingDealt: 250 };
}
const original = structuredClone(state);
let storage = { revision: 0, data: { matchScore: { wins: 0, losses: 0, lastUpdate: 0 }, automaticScore: { enabled: false, processedResults: [] } } };
const commands = [];
let sequence = 0;
const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        if (url.pathname === '/host-command') {
            let body = ''; for await (const chunk of req) body += chunk;
            const message = JSON.parse(body); commands.push(message);
            let value = {};
            if (message.command === 'host.capabilities.get') value = { capabilities: ['command', 'window:open', 'resize:report', 'settings:write'] };
            else if (message.command === 'application.storage.get') value = storage;
            else if (message.command === 'application.storage.commit') {
                const committed = message.payload.expectedRevision === storage.revision;
                if (committed) { storage = { revision: storage.revision + 1, data: message.payload.data }; state.application.data = storage.data; broadcast(); }
                value = { committed, revision: storage.revision };
            } else if (message.command === 'application.settings.set') {
                const [section, key] = message.payload.path.split('.');
                state.application.settings[section][key] = message.payload.value;
                value = { settings: state.application.settings }; broadcast();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); return;
        }
        if (url.pathname === '/host') {
            const view = url.searchParams.get('view') || 'overlay';
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<body style="margin:0"><iframe id="app" style="border:0;width:100%;height:100vh" src="/?view=${view}&w3surface=application#w3session=${'a'.repeat(64)}"></iframe><script>addEventListener('message',async e=>{const m=e.data;if(m?.source!=='w3booster-sdk'||!m.requestId)return;const value=await fetch('/host-command',{method:'POST',body:JSON.stringify(m)}).then(r=>r.json());e.source.postMessage({source:'w3booster-host',type:'host.response',clientId:m.clientId,requestId:m.requestId,ok:true,value},e.origin);});</script>`); return;
        }
        const base = resolve(process.env.W3BOOSTER_UI_ROOT || resolve(root, 'dist/match-vision/browser'));
        const file = resolve(base, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        assert.ok(file.startsWith(base + '/'));
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' })[extname(file)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const sockets = new WebSocketServer({ server, path: '/socket' });
function broadcast() { for (const socket of sockets.clients) if (socket.readyState === 1) socket.send(JSON.stringify({ version: '4.0', sequence: ++sequence, type: 'state.snapshot', data: state })); }
sockets.on('connection', () => broadcast());
const tick = setInterval(broadcast, 250);
let browser, page;
const errors = [], imageFailures = [], checks = [], requests = []; 
try {
    browser = await launchTestBrowser();
    const context = browser.context();
    await context.route('**/stream/v1/stream-tickets', route => route.fulfill({ json: { protocolVersion: '4.0', applicationRevision: revision, websocketUrl: origin.replace('http:', 'ws:') + '/socket' } }));
    if (process.env.W3BOOSTER_STATIC_ROOT) await context.route('**/assets/wc3/**', async route => {
        const base = resolve(process.env.W3BOOSTER_STATIC_ROOT);
        const file = resolve(base, '.' + new URL(route.request().url()).pathname);
        assert.ok(file.startsWith(base + '/'));
        await route.fulfill({ body: await readFile(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/json', headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.on('request', r => requests.push(r.url().split('#')[0]));
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !m.text().startsWith('%cElectron Security Warning') && !errors.includes(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (!r.ok()) imageFailures.push(r.status() + ' ' + r.url()); });
    const frame = () => page.frames().find(f => f.url().startsWith(origin + '/?'));
    async function open(view) { await page.goto(origin + '/host?view=' + view); await page.frameLocator('#app').locator('app-root').waitFor({ state: 'attached' }); }
    async function wait(expression) { await frame().waitForFunction(expression, null, { timeout: 15000 }); }
    async function waitHost(predicate, label) {
        const deadline = Date.now() + 15000;
        while (!predicate()) { assert.ok(Date.now() < deadline, label); await new Promise(resolve => setTimeout(resolve, 20)); }
    }
    async function update(change) { change(state); broadcast(); }
    async function images(label, selectors) {
        for (const selector of selectors) await wait(`!!document.querySelector(${JSON.stringify(selector)}) && [...document.querySelectorAll(${JSON.stringify(selector)})].every(e=>e.tagName==='IMG'?e.complete&&e.naturalWidth>0:getComputedStyle(e).backgroundImage.includes('/wc3/images/'))`);
        const loaded = await frame().evaluate(async () => {
            const urls = [...new Set([...document.querySelectorAll('*')].flatMap(e => [e.tagName === 'IMG' ? e.src : '', getComputedStyle(e).backgroundImage]).filter(s => s.includes('/wc3/images/')).map(s => s.startsWith('url(') ? s.slice(5, -2) : s))];
            await Promise.all(urls.map(src => new Promise((resolve, reject) => {
                const image = new Image();
                const timer = setTimeout(() => reject(Error('Image load timed out: ' + src)), 15000);
                image.onload = () => {
                    clearTimeout(timer);
                    if (image.naturalWidth === 64 && image.naturalHeight === 64) resolve();
                    else reject(Error('Wrong image dimensions: ' + src));
                };
                image.onerror = () => { clearTimeout(timer); reject(Error('Image failed: ' + src)); };
                image.src = src;
            })));
            return urls.length;
        });
        assert.ok(loaded >= 5, label + ': missing image coverage'); checks.push({ feature: label, decodedImages: loaded });
    }
    await open('overlay');
    await wait("document.querySelector('.ctrlgroup-icon')");
    assert.equal(await frame().evaluate(() => typeof AbortSignal.prototype.throwIfAborted), 'undefined', 'Run the actual oldest supported desktop browser');
    assert.equal(await frame().evaluate(() => typeof window.ng), 'undefined', 'Smoke must use the production build');
    await update(s => {
        const enemy = s.players[1];
        Object.assign(Object.values(enemy.heroes)[0], { inventory: ['ratc','rde4','bspd','cnob','spre','stel'], inventoryCooldowns: [null,null,null,null,{progress:.5,remainingSeconds:15,totalSeconds:30},null] });
        enemy.units = { '0000000000009001': { id:'0000000000009001',typeId:'hfoo',isIllusion:false } };
        enemy.upgrades.active = [{typeId:'Rhme',level:1,gametime:1}];
        enemy.buildings = {'0000000000009002': {id:'0000000000009002',typeId:'hbar',isIllusion:false,production:{queue:[{position:0,typeId:'hfoo',progress:.5,remainingSeconds:10,totalSeconds:20}]}}};
    });
    // Deliberately supply enemy data in self-play: visibility must follow the mode,
    // not infer spectator access from which fields happen to be populated.
    for (const reforged of [false, true]) {
        const graphics = reforged ? 'reforged' : 'classic';
        for (const [label,isObserver,isReplay] of [['self-play',false,false],['observer',true,false],['replay',false,true],['back to self-play',false,false]]) {
            await update(s => Object.assign(s.match,{isReforged:reforged,isObserver,isReplay}));
            const spectator=isObserver||isReplay;
            await wait(`!!document.querySelector('mv-observer-bar') === ${spectator} && !!document.querySelector('mv-match-bar') === ${!spectator}`);
            if(spectator) {
                await images(label+' portraits '+graphics,['.hero-area-streamer .hero-avatar:not(.hero-avatar-cover)','.hero-area-opponent .hero-avatar']);
                assert.equal(await frame().locator('.hero-area-opponent.inventory').count(),Object.keys(state.players[1].heroes).length);
                await wait("document.querySelector('.upgrade-box[data-player-id=\"1\"]') && document.querySelector('.production-side[data-side=right]')");
            } else {
                await wait("!document.querySelector('.hero-area-opponent') && !document.querySelector('.hero-avatar') && !document.querySelector('.production-side[data-side=right]')");
                assert.equal(await frame().locator('.upgrade-box[data-player-id="1"]').count(),0,'No enemy army or research panel during self-play');
                assert.equal(await frame().locator('.production-side[data-side="right"]').count(),0,'No enemy production/construction during self-play');
                await images(label+' local gameplay '+graphics,['.hero-area-streamer .item-icon','.hero-area-streamer .ability-icon']);
            }
        }
    }
    assert.equal(await frame().locator('.player-apm, .self-play-apm, mv-self-play-bar, mv-hero-combat, .hero-combat').count(), 0,
        'The withdrawn self-play panel, APM and hero combat totals remain undisplayed');
    state=structuredClone(original);broadcast();
    checks.push({feature:'Self-play excludes enemy portraits, abilities, vitals, inventory, army, researches and production despite populated input; observer/replay shows both sides; mode transitions clear stale panels'});
    for (const reforged of [false, true]) {
        const graphics = reforged ? 'reforged' : 'classic';
        await update(s => { s.match.isReforged = reforged; });
        await wait(`document.querySelector('.ctrlgroup-icon')?.style.backgroundImage.includes(${JSON.stringify(iconHash('units', 'Npal', graphics))})`);
        await images(reforged ? 'reforged artwork' : 'classic artwork', ['.ctrlgroup-icon', '.ability-icon', '.item-icon', '.upgrade-icon', '.queue-slot img']);
        assert.deepEqual(await frame().locator('.ctrlgroup-text').allTextContents().then(a => a.map(s => s.trim())), ['24', '13']);
        assert.equal(await frame().locator('.hero-area-streamer.hero-ability-area .ability-icon').count(), 4);
        assert.ok(await frame().locator('.ability-icon .cooldown').count(), 'Observed spell activation displays cooldown');
        for (const selector of ['.hero-hp-bar', '.hero-mana-bar', '.hero-exp-bar', '.building-queue', '.construction-row']) assert.ok(await frame().locator(selector).count(), selector);
        await wait("document.querySelectorAll('.upgrade-badge').length === 3 && document.querySelectorAll('.item-cooldown').length === 2");
        assert.deepEqual(await frame().locator('.item-cooldown').evaluateAll(elements => elements.map(e => e.getAttribute('data-slot'))), ['0', '2']);
        assert.equal(await frame().locator('.building-queue').count(), 1, 'Upgrading buildings do not create production queues');
        for (const target of ['hkee', 'uzg1', 'hgtw']) await wait(`[...document.querySelectorAll('.building-upgrade img')].some(e=>e.src.includes(${JSON.stringify(iconHash('units', target, graphics))}))`);
        for (const level of [1, 2, 3]) {
            await update(s => { s.players[0].upgrades.active[0].level = level; });
            await wait(`[...document.querySelectorAll('.upgrade-icon .filled')].length === ${level}`);
            await wait(`document.querySelector('.upgrade-icon')?.style.backgroundImage.includes(${JSON.stringify(iconHash('upgrades', 'Rhme', graphics, level))})`);
            await images('upgrade level ' + level, ['.upgrade-icon']);
        }
        await update(s => { s.players[0].upgrades.active[0].level = 1; s.players[0].buildings['0000000000000001'].production.queue[0].typeId = 'Rhme'; });
        await wait(`document.querySelector('.building-queue .active img')?.src.includes(${JSON.stringify(iconHash('upgrades', 'Rhme', graphics, 2))})`);
        await images('queued research uses next-level artwork', ['.building-queue .active img']);
        await update(s => { s.players[0].buildings['0000000000000001'].production.queue[0].typeId = 'hfoo'; });
    }
    checks.push({ feature: '13/24 control groups, four new hero skills, pools, XP, inventory, production, construction, upgrade levels' });
    await page.screenshot({ path: resolve(output, 'overlay.png') });
    await update(s => {
        const h = Object.values(s.players[0].heroes)[0];
        h.inventoryCooldowns = [null, h.inventoryCooldowns[2], null, null, null, null];
        delete s.players[0].buildings['0000000000000003'].upgrade; // Cancel.
        s.players[0].buildings['0000000000000004'].typeId = 'uzg1';
        delete s.players[0].buildings['0000000000000004'].upgrade; // Complete.
    });
    await wait("document.querySelectorAll('.upgrade-badge').length === 1 && document.querySelectorAll('.item-cooldown').length === 1 && document.querySelector('.item-cooldown').dataset.slot === '1'");
    await update(s => { Object.values(s.players[0].heroes)[0].inventoryCooldowns = Array(6).fill(null); });
    await wait("!document.querySelector('.item-cooldown')");
    checks.push({ feature: 'Building upgrade destinations and badges, completion/cancellation, duplicate item cooldowns, moved slot and expiry' });
    const beforeUpgradeWaiting = structuredClone(state);
    const orcUpgradeSelector = '.building-upgrade[data-building-id="0000000000000006"]';
    await update(s => {
        s.players[0].buildings['0000000000000006'] = {
            id: '0000000000000006', typeId: 'ostr', isIllusion: false,
            upgrade: { typeId: 'ofrt', progress: 0, remainingSeconds: null, totalSeconds: null }
        };
        Object.assign(s.players[0].buildings['0000000000000001'].production.queue[0], { progress: 0, remainingSeconds: null, totalSeconds: null });
        Object.assign(s.players[0].buildings['0000000000000002'].construction, { progress: 0, remainingSeconds: null, totalSeconds: null });
    });
    await wait(`document.querySelector(${JSON.stringify(orcUpgradeSelector)})`);
    assert.equal(await frame().locator(orcUpgradeSelector + ' .production-pause').count(), 0, 'An Orc T2 to T3 upgrade with missing timing must not display a pause icon');
    assert.equal((await frame().locator(orcUpgradeSelector + ' .production-cooldown').textContent()).trim(), '?');
    assert.equal(await frame().locator('.building-queue .production-pause').count(), 1, 'Unstarted production still displays its waiting indicator');
    assert.equal(await frame().locator('.construction-entry:not(.building-upgrade) .production-pause').count(), 1, 'Unstarted construction still displays its waiting indicator');
    await update(s => { s.players[0].buildings['0000000000000006'].upgrade.progress = null; });
    await wait(`document.querySelector(${JSON.stringify(orcUpgradeSelector + ' .progress-track.unknown')})`);
    assert.equal((await frame().locator(orcUpgradeSelector + ' .production-cooldown').textContent()).trim(), '?');
    await update(s => { Object.assign(s.players[0].buildings['0000000000000006'].upgrade, { progress: 0.25, remainingSeconds: 105, totalSeconds: 140 }); });
    await wait(`document.querySelector(${JSON.stringify(orcUpgradeSelector + ' .production-cooldown')})?.textContent.trim() === '105'`);
    assert.equal(await frame().locator(orcUpgradeSelector + ' .progress-track').getAttribute('aria-valuenow'), '25');
    await update(s => {
        s.players[0].buildings['0000000000000006'].typeId = 'ofrt';
        delete s.players[0].buildings['0000000000000006'].upgrade;
    });
    await wait(`!document.querySelector(${JSON.stringify(orcUpgradeSelector)})`);
    checks.push({ feature: 'Orc Stronghold to Fortress missing timing stays unknown, recovers to a countdown and clears on completion; waiting production and construction remain distinct' });
    state = beforeUpgradeWaiting; broadcast();
    const beforeBadges = structuredClone(state);
    await update(s => { s.match.isReplay = true; });
    const badgeItems = ['rat6', 'rat9', 'ratc', 'rde2', 'rde4', 'ratf'];
    const expectedBonuses = badgeItems.map(id => catalog.items[id].name.match(/\+\d+$/)[0]);
    await update(s => {
        for (const player of s.players) {
            for (const h of Object.values(player.heroes)) {
                h.inventory = Array(6).fill('');
                h.inventoryCooldowns = Array(6).fill(null);
            }
            Object.values(player.heroes)[0].inventory = [...badgeItems];
        }
    });
    for (const reforged of [false, true]) {
        const graphics = reforged ? 'reforged' : 'classic';
        await update(s => { s.match.isReforged = reforged; });
        await wait(`document.querySelector('.inventory .item-icon')?.style.backgroundImage.includes(${JSON.stringify(iconHash('items', 'rat6', graphics))})`);
        await wait("document.querySelectorAll('.item-bonus').length === 12");
        // Wait for actual entry/slide animations, including parents, before measuring or capturing.
        await wait("document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished' || a.playState === 'idle')");
        for (const side of ['streamer', 'opponent']) {
            assert.deepEqual(await frame().locator(`.hero-area-${side}.inventory .item-bonus`).allTextContents(), expectedBonuses);
        }
        assert.ok(await frame().locator('.item-bonus').evaluateAll(elements => elements.every(e => {
            const badge = e.getBoundingClientRect(), icon = e.parentElement.getBoundingClientRect();
            return badge.width > 0 && badge.left >= icon.left && badge.right <= icon.right + 0.5 && badge.top >= icon.top && badge.bottom <= icon.bottom + 0.5;
        })), 'Bonus badges stay inside their icons on both sides');
        assert.ok(await frame().locator('.item-bonus').evaluateAll(elements => elements.every(e => {
            const style = getComputedStyle(e);
            return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.color === 'rgb(255, 255, 255)' && style.fontFamily === getComputedStyle(e.parentElement).fontFamily
                && style.opacity === '1' && style.fontWeight === '700' && style.right === '1px' && style.bottom === '0px'
                && style.textShadow === 'rgb(0, 0, 0) 1px 1px 4px'
                && getComputedStyle(e.parentElement, '::before').backgroundImage.includes('radial-gradient');
        })), 'Item bonuses use the C3 corner count and gradient');
        await images('item bonus badges ' + graphics, ['.inventory .item-icon']);
        await page.screenshot({ path: resolve(output, `item-bonuses-${graphics}.png`) });
        const inventoryBox = await frame().locator('.hero-area-streamer.inventory').first().locator('.item-icon').evaluateAll(elements => {
            const boxes = elements.map(e => e.getBoundingClientRect());
            const x = Math.floor(Math.min(...boxes.map(b => b.left))) - 6;
            const y = Math.floor(Math.min(...boxes.map(b => b.top))) - 6;
            return { x, y, width: Math.ceil(Math.max(...boxes.map(b => b.right))) - x + 6, height: Math.ceil(Math.max(...boxes.map(b => b.bottom))) - y + 6 };
        });
        await page.screenshot({ path: resolve(output, `item-bonuses-${graphics}-detail.png`), clip: inventoryBox });
    }
    await update(s => {
        for (const player of s.players) Object.values(player.heroes)[0].inventory = ['rde4', 'rat6', 'rat6', 'belv', 'spre', ''];
    });
    await wait("document.querySelectorAll('.item-bonus').length === 6");
    for (const side of ['streamer', 'opponent']) assert.deepEqual(await frame().locator(`.hero-area-${side}.inventory .item-bonus`).allTextContents(), [expectedBonuses[4], expectedBonuses[0], expectedBonuses[0]]);
    await update(s => { delete s.match.gameDataId; });
    await wait("!document.querySelector('.item-bonus')");
    state = beforeBadges; broadcast();
    await images('restore after item badges', ['.inventory .item-icon']);
    checks.push({ feature: 'Catalog item bonus badges, both sides and artwork families, duplicates, slot replacement, unrelated +stat item excluded, missing catalog clears badges' });
    const beforeMixed = structuredClone(state);
    await update(s => { s.match.isReplay = true; });
    await update(s => {
        for (const player of s.players) Object.assign(Object.values(player.heroes)[0], {
            inventory: ['ratc', 'rde4', 'bspd', 'cnob', 'spre', 'stel'],
            inventoryCooldowns: [null, null, null, null,
                { progress: 0.5, remainingSeconds: 15, totalSeconds: 30 },
                { progress: 0.25, remainingSeconds: 45, totalSeconds: 60 }]
        });
    });
    for (const reforged of [false, true]) {
        const graphics = reforged ? 'reforged' : 'classic';
        await update(s => { s.match.isReforged = reforged; });
        await wait(`document.querySelector('.inventory .item-icon')?.style.backgroundImage.includes(${JSON.stringify(iconHash('items', 'ratc', graphics))})`);
        await wait("document.querySelectorAll('.item-bonus').length === 4 && document.querySelectorAll('.item-cooldown').length === 4");
        for (const side of ['streamer', 'opponent']) {
            const inventory = frame().locator(`.hero-area-${side}.inventory`).first();
            assert.deepEqual(await inventory.locator('.item-bonus').allTextContents(), ['+12', '+5']);
            assert.deepEqual(await inventory.locator('.item-cooldown .cooldown').allTextContents(), ['15', '45']);
            assert.ok(await inventory.locator('.item-icon').evaluateAll(elements => elements.every((e, slot) => {
                const hasGradient = getComputedStyle(e, '::before').backgroundImage.includes('radial-gradient');
                return hasGradient === (slot < 2) && !!e.querySelector('.item-cooldown') === (slot >= 4);
            })), 'Only bonus items get corner shading; regular items and cooldowns retain their own presentation');
        }
        await images('mixed inventory ' + graphics, ['.item-icon']);
        await wait("document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished' || a.playState === 'idle')");
        await page.screenshot({ path: resolve(output, `mixed-inventory-${graphics}.png`) });
    }
    state = beforeMixed; broadcast();
    await wait("document.querySelectorAll('.item-cooldown').length === 0");
    checks.push({ feature: 'C3 bonus items mixed with ordinary items and two cooldowns on both sides and artwork families' });
    await update(s => { s.match.isObserver = false; s.match.isReplay = false; });
    const beforeMana = structuredClone(state);
    const manaCost = catalog.abilities.AHtb.levels[0].manaCost;
    await update(s => {
        s.match.isReplay = true;
        for (const player of s.players) Object.assign(Object.values(player.heroes)[0], {
            abilities: [{ id: 'mana-test', typeId: 'AHtb', level: 1, lastActivation: 1000 }],
            mana: { current: manaCost - 30, max: 300, regenerationPerSecond: 2 }
        });
    });
    for (const reforged of [false, true]) {
        await update(s => { s.match.isReforged = reforged; });
        await wait("document.querySelectorAll('.ability-icon.insufficient-mana').length === 2");
        assert.deepEqual(await frame().locator('.ability-mana-track').evaluateAll(es => es.map(e=>Number(e.getAttribute('aria-valuenow')))), Array(2).fill((manaCost-30)/manaCost*100));
        assert.equal(await frame().locator('.mana-requirement, .mana-missing, .mana-recovery').count(), 0);
        assert.ok(await frame().locator('.insufficient-mana').evaluateAll(es => es.every(e => getComputedStyle(e, '::before').filter === 'grayscale(1) brightness(0.5)' && getComputedStyle(e).filter === 'none')));
        await images('mana requirements ' + reforged, ['.ability-icon']);
        await wait("document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished' || a.playState === 'idle')");
        assert.ok(await frame().locator('.ability-icon').evaluateAll(es => es.every(e => e.getBoundingClientRect().width === 42 && e.getBoundingClientRect().height === 42)));
        for (const side of ['streamer', 'opponent']) {
            const fills = await frame().locator(`.hero-area-${side} .ability-mana-fill`).evaluateAll(elements => elements.map(fill => {
                const bar = fill.parentElement.getBoundingClientRect(), rect = fill.getBoundingClientRect();
                return { left: rect.left, start: bar.left, width: rect.width, trackWidth: bar.width };
            }));
            assert.equal(fills.length, 1);
            assert.ok(fills.every(fill => Math.abs(fill.left - fill.start) < .1 && fill.width > 0 && fill.width < fill.trackWidth),
                `${reforged ? 'Reforged' : 'Classic'} ${side}: a partial mana fill starts at the physical left edge`);
        }
        await page.screenshot({ path: resolve(output, `ability-mana-${reforged ? 'reforged' : 'classic'}.png`) });
    }
    const beforeManaLayout = structuredClone(state);
    // Three native hero anchors, four skills each: mana bars must stay within their artwork.
    for (const reforged of [false, true]) for (const inventory of [true, false]) {
        await update(s => {
            s.match.isReforged = reforged;
            s.application.settings.observer.heroItemsEnabled = inventory;
            for (const [side, p] of s.players.entries()) {
                const base = Object.values(p.heroes)[0];
                p.heroes = Object.fromEntries(Array.from({length:3}, (_, i) => {
                    const id = (9000 + side * 10 + i).toString(16).padStart(16,'0');
                    return [id, {...structuredClone(base), id, heroOrder:i+1,
                        abilities: Array.from({length:4}, (_,j)=>({...base.abilities[0], typeId:j===3?'AHmt':base.abilities[0].typeId, id:'mana-layout-'+j}))}];
                }));
            }
        });
        await wait("document.querySelectorAll('.ability-mana-track').length === 24");
        await wait("document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished' || a.playState === 'idle')");
        assert.ok(await frame().locator('.ability-mana-track').evaluateAll(bars => {
            const rect = e => e.getBoundingClientRect();
            const overlaps = (a,b) => a.left < b.right-.1 && a.right > b.left+.1 && a.top < b.bottom-.1 && a.bottom > b.top+.1;
            return bars.every(bar => {
                const b = rect(bar), icon = rect(bar.parentElement);
                const obstacles = [...document.querySelectorAll('.ability-icon, .army-icon, .item-icon, .hero-avatar, .queue-slot, .level-indicator')]
                    .filter(e=>e!==bar.parentElement).map(rect);
                return Math.abs(b.right - (icon.right-1))<.1 && Math.abs(b.width-40)<.1 && b.left >= icon.left && b.top >= icon.top && b.bottom <= icon.bottom &&
                    !obstacles.some(r=>overlaps(b,r));
            });
        }), 'Mana bars remain inside their own artwork, clear of level pips and neighbouring panels');
        assert.ok(await frame().locator('.hero-ability-area').evaluateAll(areas => areas.every(area => {
            const icons = [...area.querySelectorAll('.ability-icon')].map(e=>e.getBoundingClientRect());
            return Math.abs(icons[0].top-icons[2].top)<.1 && Math.abs(icons[1].top-icons[3].top)<.1 &&
                Math.abs(Math.abs(icons[2].left-icons[0].left)-53)<.1;
        })), 'Three and four skills retain two aligned, compact columns');
        assert.ok(await frame().locator('.hero-ability-area .level-indicator').evaluateAll(markers => {
            const rect=e=>e.getBoundingClientRect();
            const overlap=(a,b)=>a.left<b.right-.1 && a.right>b.left+.1 && a.top<b.bottom-.1 && a.bottom>b.top+.1;
            const others=[...document.querySelectorAll('.ability-icon, .army-icon, .item-icon, .hero-avatar, .queue-slot')].map(rect);
            return markers.every(marker=>{
                const b=rect(marker),icon=rect(marker.parentElement.querySelector('.ability-icon'));
                return Math.abs(b.left-icon.right)<.1 && Math.abs(b.top-icon.top)<.1 && Math.abs(b.height-icon.height)<.1 &&
                    !others.some(other=>overlap(b,other));
            });
        }), 'Level markers sit outside the right edge of every ability, without touching adjacent artwork or panels');
        assert.ok(await frame().locator('.ability-mana-track').evaluateAll(es=>es.every(e=>getComputedStyle(e,'::after').content==='none')),'Mana fills have no segment decoration');
        await page.screenshot({path:resolve(output,`ability-mana-four-skills-${reforged?'reforged':'classic'}-${inventory?'inventory':'no-inventory'}.png`)});
        const positions = await frame().locator('.ability-icon-wrapper').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
        await update(s=>{for(const p of s.players)for(const h of Object.values(p.heroes)) h.mana.current=300;});
        await wait("!document.querySelector('.insufficient-mana')");
        assert.deepEqual(await frame().locator('.ability-icon-wrapper').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})),positions,'Mana availability never shifts the grid');
        state=structuredClone(beforeManaLayout); broadcast();
    }
    // The bar follows observations in both directions; it never extrapolates regeneration.
    for (const fraction of [0, .8, .2, .999]) {
        await update(s=>{for(const p of s.players) Object.assign(Object.values(p.heroes)[0].mana,{current:manaCost*fraction,regenerationPerSecond:0});});
        await wait(`document.querySelectorAll('.ability-mana-track').length === 2 && [...document.querySelectorAll('.ability-mana-track')].every(e=>Number(e.getAttribute('aria-valuenow')) === ${fraction*100})`);
        assert.deepEqual(await frame().locator('.ability-mana-fill').evaluateAll(es=>es.map(e=>e.style.width)),Array(2).fill(`${fraction*100}%`));
    }
    for (const current of [manaCost, manaCost+1]) {
        await update(s => { for (const p of s.players) Object.values(p.heroes)[0].mana.current = current; });
        await wait("!document.querySelector('.insufficient-mana, .ability-mana-track')");
        assert.ok(await frame().locator('.ability-icon .cooldown').count()>0,'Enough mana does not remove independent cooldowns');
    }
    await page.screenshot({path:resolve(output,'ability-mana-sufficient.png')});
    await update(s => { for (const p of s.players) Object.values(p.heroes)[0].mana.current = manaCost-1; });
    await wait("document.querySelectorAll('.insufficient-mana .ability-mana-track').length === 2");
    state = beforeMana; broadcast();
    checks.push({ feature: 'Mana bars fill toward casting cost from observed mana, hide at and above cost and reappear after mana spending, preserve cooldowns, full-size artwork and three-hero four-ability geometry on both sides and graphics' });
    const beforeArmy = structuredClone(state);
    assert.equal(defaults.player.armyCompositionEnabled, true);
    assert.equal(defaults.observer.armyCompositionEnabled, true);
    await update(s => { s.match.isReplay = true; });
    const armyTypes = [['hfoo', 12], ['hkni', 2], ['hpea', 4], ['hmtm', 1]];
    const expectedArmy = [...armyTypes].sort((a, b) => catalog.units[a[0]].cost.gold - catalog.units[b[0]].cost.gold || a[0].localeCompare(b[0]));
    const leftPanel = `.upgrade-box[data-player-id="${state.players[0].id}"]`;
    const rightPanel = `.upgrade-box[data-player-id="${state.players[1].id}"]`;
    await update(s => {
        s.application.settings.observer.researchesEnabled = false;
        s.players[1].upgrades.active = [];
        for (const [index, player] of s.players.entries()) {
            Object.assign(Object.values(player.heroes)[0], { inventory: [...badgeItems], inventoryCooldowns: Array(6).fill(null) });
            let next = 1000 + index * 100;
            const units = armyTypes.flatMap(([typeId, count]) => Array.from({ length: count }, () => {
                const id = String(next++).padStart(16, '0'); return { id, typeId, isIllusion: false };
            }));
            units.push({ id: String(next++).padStart(16, '0'), typeId: 'hfoo', isIllusion: true });
            units.push({ id: String(next++).padStart(16, '0'), typeId: 'hfoo', isIllusion: false, hitpoints: { current: 0, max: 420 } });
            player.units = Object.fromEntries(units.map(u => [u.id, u]));
        }
    });
    for (const reforged of [false, true]) {
        const graphics = reforged ? 'reforged' : 'classic';
        await update(s => { s.match.isReforged = reforged; });
        await wait("document.querySelectorAll('.army-icon').length === 8");
        await wait(`document.querySelector('.army-icon')?.style.backgroundImage.includes(${JSON.stringify(iconHash('units', expectedArmy[0][0], graphics))})`);
        for (const selector of [leftPanel, rightPanel]) {
            assert.deepEqual(await frame().locator(selector + ' .army-icon').evaluateAll(elements => elements.map(e => [e.dataset.typeId, Number(e.textContent.trim())])), expectedArmy);
            const visualOrder = await frame().locator(selector + ' .army-icon').evaluateAll(elements => elements
                .map(e => ({ typeId: e.dataset.typeId, count: Number(e.textContent.trim()), rect: e.getBoundingClientRect() }))
                .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
                .map(e => [e.typeId, e.count]));
            assert.deepEqual(visualOrder, expectedArmy, `${graphics} ${selector}: unit cost increases visually left to right on both sides`);
        }
        await images('army composition ' + graphics, ['.army-icon']);
        await wait("document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished' || a.playState === 'idle')");
        await page.screenshot({ path: resolve(output, `army-${graphics}.png`) });
    }
    const armyBox = await frame().locator(leftPanel + ' .army-row').boundingBox();
    await update(s => { s.application.settings.observer.researchesEnabled = true; });
    await wait(`document.querySelector(${JSON.stringify(leftPanel)})?.dataset.panel === 'army-and-upgrades'`);
    const stackedResearch = await frame().locator(leftPanel + ' .research-row').boundingBox();
    assert.ok(stackedResearch.y >= armyBox.y + armyBox.height, 'Upgrades sit below the army');
    assert.equal(await frame().locator(rightPanel).getAttribute('data-panel'), 'army', 'Empty upgrades leave army visible');
    await update(s => { const id = '0000000000009999'; s.players[0].units[id] = { id, typeId: 'hfoo', isIllusion: false }; });
    await wait(`document.querySelector(${JSON.stringify(leftPanel + ' [data-type-id="hfoo"]')})?.textContent.trim() === '13'`);
    await page.waitForTimeout(10_250);
    assert.equal(await frame().locator(leftPanel).getAttribute('data-panel'), 'army-and-upgrades', 'Both panels stay visible beyond the former rotation period');
    await page.screenshot({ path: resolve(output, 'stacked-army-upgrades.png') });
    await update(s => { s.application.settings.observer.armyCompositionEnabled = false; });
    await wait("!document.querySelector('.army-icon')");
    assert.equal(await frame().locator(leftPanel).getAttribute('data-panel'), 'upgrades');
    const researchBox = await frame().locator(leftPanel + ' .research-row').boundingBox();
    assert.equal(researchBox.y, armyBox.y, 'Upgrades move to the top when army is disabled');
    assert.equal(await frame().locator(rightPanel).count(), 0, 'Disabled army plus empty upgrades hides the slot');
    await update(s => { s.application.settings.observer.armyCompositionEnabled = true; s.players[0].units = {}; });
    await wait(`document.querySelector(${JSON.stringify(rightPanel)})?.dataset.panel === 'army'`);
    assert.equal(await frame().locator(leftPanel).getAttribute('data-panel'), 'upgrades', 'Empty army leaves upgrades visible');
    await update(s => { s.application.settings.observer.researchesEnabled = false; });
    await wait(`!document.querySelector(${JSON.stringify(leftPanel)})`);
    await update(s => { s.match.isObserver = true; s.match.isReplay = true; s.application.settings.observer.armyCompositionEnabled = false; });
    await wait("!document.querySelector('.army-icon')");
    await update(s => { s.application.settings.observer.armyCompositionEnabled = true; s.application.settings.observer.researchesEnabled = false; });
    await wait("document.querySelectorAll('.army-icon').length === 4");
    await update(s => { s.match.status = 'finished'; });
    await wait("!document.querySelector('mv-army-research-panel')");
    state = beforeArmy; broadcast();
    await images('restore after stacked army panels', ['.upgrade-icon']);
    checks.push({ feature: 'Army counts, gold-per-unit ascending sort visually left to right on both sides and graphics, illusions/deaths, persistent stacked rows beyond 10 seconds, live counts, upgrades move to top, disabled/empty fallbacks, player/observer settings, match cleanup' });
    await update(s => { s.gameContext.chatbarOpen = true; });
    await wait("!document.querySelector('.ctrlgroup-wrapper')");
    await update(s => { s.gameContext.chatbarOpen = false; s.application.settings.player.heroAbilitiesEnabled = false; s.application.settings.player.heroItemsEnabled = false; s.application.settings.player.productionQueuesEnabled = false; });
    await wait("!document.querySelector('.ability-icon') && !document.querySelector('.item-icon') && !document.querySelector('.building-queue')");
    state = structuredClone(original); broadcast();
    await images('settings restore', ['.ability-icon', '.item-icon', '.queue-slot img']);
    for (const mode of ['1v1', '2v2', 'FFA']) {
        await update(s => { s.match.mode = mode; s.match.isObserver = true; s.match.isReplay = true; if (mode !== '1v1') s.players = [...original.players, ...original.players.map(p => ({ ...structuredClone(p), id: 'extra-' + p.id, heroes: Object.fromEntries(Object.entries(p.heroes).map(([id,h])=>['1'+id.slice(1),{...structuredClone(h),id:'1'+id.slice(1)}])), buildings: {}, team: mode === 'FFA' ? Number(p.id) + 2 : p.team, name: 'Extra ' + p.name }))]; });
        await wait("!document.querySelector('.ctrlgroup-wrapper')");
        await images('observer ' + mode, [mode === '2v2' ? '.hero-chip-icon' : '.hero-avatar:not(.hero-avatar-cover)']);
    }
    state = structuredClone(original); broadcast();
    await update(s => { delete s.match.gameDataId; });
    await wait("[...document.querySelectorAll('.ctrlgroup-icon')].every(e=>getComputedStyle(e).backgroundImage==='none')");
    assert.ok(await frame().locator('.hero-hp-bar').count(), 'Live health survives missing catalog');
    await update(s => { s.match.gameDataId = gameDataId; });
    await images('catalog reload', ['.ctrlgroup-icon', '.ability-icon']);
    await update(s => { s.match.status = 'finished'; });
    await wait("!document.querySelector('.App')");
    state = structuredClone(original); broadcast();
    await images('next match', ['.ctrlgroup-icon']);
    checks.push({ feature: 'delivered settings, chat, observer/replay modes, catalog replacement, match end/start' });
    await open('dashboard');
    const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    assert.equal(await frame().locator('.app-version').innerText(), 'v' + version);
    await frame().getByRole('heading', { name: 'Match dashboard' }).waitFor();
    await wait("document.querySelector('.current-match').textContent.includes('Northwind') && document.querySelector('.current-match').textContent.includes('Ironclaw')");
    await frame().locator('.score-side.win button').last().click();
    await wait("document.querySelector('.score-side.win strong').textContent==='1'");
    await frame().locator('.score-side.loss button').last().click();
    await wait("document.querySelector('.score-side.loss strong').textContent==='1'");
    await frame().getByRole('button', { name: 'Reset', exact: true }).click();
    await wait("document.querySelector('.score-side.win strong').textContent==='0' && document.querySelector('.score-side.loss strong').textContent==='0'");
    await frame().getByRole('button', { name: 'Open compact window' }).click();
    await waitHost(() => commands.some(m => m.type === 'host.open-window'), 'Compact launch reaches the host');
    await frame().getByRole('button', { name: 'How automatic score updates work' }).click();
    await frame().getByRole('dialog', { name: 'Automatic wins and losses' }).waitFor();
    await frame().getByRole('button', { name: 'Close explanation' }).click();
    await frame().getByRole('checkbox', { name: 'Update wins and losses automatically' }).check();
    await waitHost(() => storage.data.automaticScore.enabled, 'Automatic score setting persists');
    await update(s => { s.players.forEach(p => { p.isAI = false; }); s.match.status = 'finished'; s.match.result = { playerId: '0', outcome: 'won' }; });
    await wait("document.querySelector('.score-side.win strong').textContent==='1'");
    await frame().getByRole('checkbox', { name: 'Update wins and losses automatically' }).uncheck();
    await frame().getByRole('button', { name: 'Reset', exact: true }).click();
    await wait("document.querySelector('.score-side.win strong').textContent==='0'");
    await update(s => { s.match.status = 'running'; s.match.id = 'second-smoke-match'; delete s.match.result; });
    await update(s => { s.match.isReplay = true; });
    await frame().getByRole('button', { name: 'Reverse players' }).click();
    await waitHost(() => state.application.settings.observer.reversePlayerOrderMatchId === state.match.id, 'Reverse-player setting reaches the host');
    await page.screenshot({ path: resolve(output, 'dashboard.png') });
    await frame().getByRole('combobox', { name: 'Filter match history' }).selectOption('Replay');
    await frame().getByRole('combobox', { name: 'Filter match history' }).selectOption('All');
    const oldSocketCount = requests.filter(url => url.endsWith('/stream/v1/stream-tickets')).length;
    for (const socket of sockets.clients) socket.close();
    await wait("!document.querySelector('.sync-notice')");
    // Wait for a newly delivered snapshot, not merely the preserved pre-disconnect UI.
    await update(s => { s.match.map = 'Reconnected smoke match'; });
    await wait("document.querySelector('.current-match').textContent.includes('Reconnected smoke match')");
    assert.ok(requests.filter(url => url.endsWith('/stream/v1/stream-tickets')).length > oldSocketCount);
    await open('compact');
    await frame().getByRole('button', { name: 'Add win', exact: true }).click();
    await wait("document.querySelector('.score-section').textContent.includes('1')");
    assert.equal(storage.data.matchScore.wins, 1);
    await frame().getByRole('button', { name: 'Increase text size' }).click();
    await frame().getByRole('button', { name: 'Decrease text size' }).click();
    await page.screenshot({ path: resolve(output, 'compact.png') });
    const readsBefore = commands.filter(m => m.command === 'application.storage.get').length;
    await open('background');
    await waitHost(() => commands.filter(m => m.command === 'application.storage.get').length > readsBefore, 'Background must connect and initialize its score service');
    await wait("document.querySelector('app-root') && !document.querySelector('main') && !document.querySelector('.App')");
    checks.push({ feature: 'dashboard score persistence, automatic result, explanation dialog, reset, compact launch, reverse players, history filters, broker reconnect, compact controls, hidden background' });
    assert.deepEqual(imageFailures, []); assert.deepEqual(errors, []);
    await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, gameDataId, engine: await browser.version(), checks }, null, 2));
    console.log(JSON.stringify({ passed: true, gameDataId, checks }));
} catch (error) {
    if (page) { await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); await writeFile(resolve(output,'failure.json'),JSON.stringify({failure:String(error),errors,imageFailures,requests,commands,checks},null,2)); console.error('Browser errors:', errors.slice(0,3)); }
    throw error;
} finally {
    clearInterval(tick); await browser?.close();
    for (const socket of sockets.clients) socket.terminate();
    await new Promise(resolve => sockets.close(resolve)); await new Promise(resolve => server.close(resolve));
}
