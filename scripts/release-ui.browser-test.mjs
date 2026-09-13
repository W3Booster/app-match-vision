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
state.players[0].controlgroups = { 0: { frontunit: 'Npal', size: 24 }, 1: { frontunit: 'hfoo', size: 13 } };
state.players[0].buildings = {
    '0000000000000001': { id: '0000000000000001', typeId: 'hbar', isIllusion: false, production: { queue: [
        { position: 0, typeId: 'hfoo', progress: 0.4, remainingSeconds: 12, totalSeconds: 20 },
        { position: 1, typeId: 'hrif', progress: 0, remainingSeconds: null, totalSeconds: null }
    ] } },
    '0000000000000002': { id: '0000000000000002', typeId: 'hhou', isIllusion: false, construction: { progress: 0.5, remainingSeconds: 10, totalSeconds: 20 } }
};
state.players[0].upgrades.active = [{ typeId: 'Rhme', level: 1, gametime: 1 }];
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
    for (const reforged of [false, true]) {
        const graphics = reforged ? 'reforged' : 'classic';
        await update(s => { s.match.isReforged = reforged; });
        await wait(`document.querySelector('.ctrlgroup-icon')?.style.backgroundImage.includes(${JSON.stringify(iconHash('units', 'Npal', graphics))})`);
        await images(reforged ? 'reforged artwork' : 'classic artwork', ['.ctrlgroup-icon', '.ability-icon', '.item-icon', '.upgrade-icon', '.queue-slot img']);
        assert.deepEqual(await frame().locator('.ctrlgroup-text').allTextContents().then(a => a.map(s => s.trim())), ['24', '13']);
        assert.equal(await frame().locator('.hero-area-streamer.hero-ability-area .ability-icon').count(), 4);
        assert.ok(await frame().locator('.ability-icon .cooldown').count(), 'Observed spell activation displays cooldown');
        for (const selector of ['.hero-hp-bar', '.hero-mana-bar', '.hero-exp-bar', '.building-queue', '.construction-row']) assert.ok(await frame().locator(selector).count(), selector);
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
