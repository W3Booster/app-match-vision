// Real development UI, synthetic aliases. Requires the canonical checkout on 8082.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const output = resolve(process.env.MV_CAPTURE_DIR || '.release-captures');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const view of ['overlay', 'player', 'dashboard', 'compact']) {
    const page = await browser.newPage({ viewport: view === 'compact' ? { width: 780, height: 430 } : { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.MV_CAPTURE_URL || 'http://localhost:8082'}/?demo=1&backend=local&assetBaseUrl=http://localhost:8083/assets&view=${view === 'player' ? 'overlay' : view}`);
    await page.waitForFunction(() => window.ng?.getComponent(document.querySelector('app-root'))?.connection.connection()?.state.players.length === 2);
    await page.evaluate(async view => {
      const service = window.ng.getComponent(document.querySelector('app-root')).connection;
      const base = service.connection(); await service.stop();
      const state = structuredClone(base.state), settings = structuredClone(base.settings);
      Object.assign(state.match, { id: 'release-preview', realm: 'Reforged', mode: '1v1', gameTime: 754,
        isObserver: view === 'overlay', isReplay: false, isReforged: false, map: 'Autumn Leaves', broadcasterPlayerId: '0', realBroadcasterPlayerId: '0' });
      for (const profile of [settings.player, settings.observer]) Object.assign(profile, {
        heroExpProgressEnabled: true, heroAbilitiesEnabled: true, heroItemsEnabled: true,
        heroLevelEnabled: true, productionQueuesEnabled: true, constructionEnabled: true,
      });
      state.players.forEach((player, i) => {
        player.name = ['Northwind#1001', 'Ironclaw#1002'][i]; player.mainAccount = undefined;
        player.race = ['human', 'orc'][i]; player.team = i;
        player.stats = { status: 'ready', records: [{ provider: 'bnet', gameMode: '1v1', queue: 'individual', race: player.race,
          season: 9, mmr: [3214, 3386][i], rank: [842, 617][i], wins: [87, 112][i], losses: [64, 79][i],
          winRate: i ? 112 / 191 * 100 : 87 / 151 * 100, league: 4, isPlaced: true }] };
        const source = Object.values(player.heroes)[0];
        const types = i ? ['Obla', 'Oshd', 'Otch'] : ['Hamg', 'Hmkg', 'Hpal'];
        player.heroes = Object.fromEntries(types.map((typeId, n) => {
          const id = `preview-hero-${i}-${n}`;
          return [id, { ...structuredClone(source), id, typeId, level: 5 - n, experience: [1400, 900, 500][n],
            hitpoints: { current: [612, 490, 730][n], max: [850, 1000, 800][n] }, mana: { current: [280, 110, 200][n], max: 400 },
            abilities: (i ? ['AOwk', 'AOcr', 'AOmi'] : ['AHwe', 'AHbz', 'AHab']).map((name, a) => ({ id: id + '-' + a, name, level: 1, lastActivation: 750000 })) }];
        }));
        const timer = (progress, totalSeconds) => ({ progress, totalSeconds, remainingSeconds: (1-progress)*totalSeconds });
        player.units = {}; player.buildings = {};
        for (let n = 0; n < 2; n++) {
          const id = `preview-building-${i}-${n}`;
          player.buildings[id] = { id, typeId: i ? ['obar', 'obea'][n] : ['hbar', 'hars'][n], production: { queue: [
            { position: 0, typeId: i ? ['ogru', 'orai'][n] : ['hrif', 'hmpr'][n], ...timer(n ? .67 : .38, 30) },
            ...Array.from({ length: n ? 2 : 5 }, (_, slot) => ({ position: slot + 1, typeId: i ? 'ogru' : 'hfoo', progress: 0, totalSeconds: null, remainingSeconds: null }))
          ] } };
        }
        const id = `preview-construction-${i}`;
        player.buildings[id] = { id, typeId: i ? 'otto' : 'hhou', construction: timer(.42, 50) };
      });
      service.connection.set({ ...base, state, settings });
      document.body.style.background = '#141a21';
      const caption = document.createElement('div'); caption.textContent = 'UPCOMING MATCH VISION · DEMO DATA';
      caption.style.cssText = 'position:fixed;bottom:12px;left:0;right:0;text-align:center;color:#b2c2d1;font:11px system-ui;letter-spacing:1.4px;z-index:9999;pointer-events:none';
      document.body.append(caption);
    }, view);
    await page.waitForTimeout(1200);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    const broken = await page.locator('img').evaluateAll(images => images.filter(i => i.getBoundingClientRect().width && !i.naturalWidth).map(i => i.getAttribute('src')));
    if (errors.length || broken.length) throw new Error(JSON.stringify({ errors, broken }));
    if (view === 'player') await page.locator('.match-box').screenshot({ path: resolve(output, 'match-vision-player.png') });
    else await page.screenshot({ path: resolve(output, `match-vision-${view}.png`) });
    if (view === 'overlay') await page.screenshot({ path: resolve(output, 'match-vision-production.png'), clip: { x: 0, y: 35, width: 465, height: 480 } });
    console.log(`Captured ${view}`); await page.close();
  }
} finally { await browser.close(); }
