// Render release views from a captured real match. No fixture match is published.
// Capture WC3's client area with its live overlay separately; use that exact frame
// as the background when composing feature callouts in the release artwork.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const snapshotPath = process.env.MV_CAPTURE_SNAPSHOT;
if (!snapshotPath) throw new Error('Set MV_CAPTURE_SNAPSHOT to a real recorder snapshot containing state and settings.');
const snapshotBytes = await readFile(snapshotPath);
const snapshot = JSON.parse(snapshotBytes);
const replayUrl = process.env.MV_CAPTURE_REPLAY_URL;
const replayId = /^https:\/\/warcraft3\.info\/replays\/(\d+)\/?$/.exec(replayUrl ?? '')?.[1];
if (!replayId) throw new Error('Set MV_CAPTURE_REPLAY_URL to the selected warcraft3.info replay.');
const response = await fetch(`https://warcraft3.info/api/v1/replays/${replayId}`);
if (!response.ok) throw new Error(`Replay metadata unavailable: ${response.status}`);
const replay = await response.json();
if (!replay.is_highlight) throw new Error('Choose a highlighted Top Replay from warcraft3.info.');
if (!replay.players?.length || replay.players.some(player => /razzorman/i.test(player.player + ' ' + player.stats_player?.name))) {
  throw new Error('Excluded participant or missing replay provenance.');
}
const expected = replay.players.map(player => player.player.toLowerCase()).sort();
const observed = (snapshot.state?.players ?? []).map(player => player.name.toLowerCase()).sort();
if (JSON.stringify(expected) !== JSON.stringify(observed)) throw new Error('Snapshot players do not match the selected public replay.');

if (!snapshot.state?.match?.id || !snapshot.state.match.isReplay || snapshot.state.match.gameTime <= 0 || !snapshot.state.players?.length) {
  throw new Error('Release screenshots require an actual replay observation after the match starts.');
}
if (snapshot.state.players.some(player => /Northwind|Ironclaw|preview-|razzorman/i.test(player.name))) throw new Error('Fixture aliases are not release evidence.');
const output = resolve(process.env.MV_CAPTURE_DIR || '.release-captures');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const view of ['dashboard', 'compact', 'overlay']) {
    const page = await browser.newPage({ viewport: view === 'overlay' ? { width: 1920, height: 1080 } : view === 'compact' ? { width: 780, height: 430 } : { width: 1200, height: 820 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // The standalone demo transport mounts the application without account access.
    // Stop it and replace ALL match data/settings before taking any screenshot.
    // Capture only the current-match section; fixture history is never included.
    await page.goto(`${process.env.MV_CAPTURE_URL || 'http://localhost:8082'}/?demo=1&backend=local&assetBaseUrl=http://localhost:8083/assets&view=${view}`);
    await page.waitForFunction(() => window.ng?.getComponent(document.querySelector('app-root'))?.connection.client());
    await page.evaluate(async ({ snapshot, view }) => {
      const service = window.ng.getComponent(document.querySelector('app-root')).connection;
      const base = service.connection(); await service.stop();
      const state = structuredClone(snapshot.state);
      const settings = structuredClone(snapshot.settings);
      if (view === 'overlay') {
        // Explicitly requested screenshot presentation; keep real replay data.
        const local = state.players.find(player => player.race === 'human') ?? state.players[0];
        Object.assign(state.match, { isReplay: false, isObserver: false, broadcasterPlayerId: local.id, realBroadcasterPlayerId: local.id });
        Object.assign(settings.player, { username: '', nationality: '', topBarEnabled: true, topBarStatisticsOfMeEnabled: true, topBarStatisticsOfOpponentEnabled: true });
      }
      service.connection.set({ ...base, state, settings });
    }, { snapshot, view });
    await page.waitForTimeout(1200);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
    const selector = view === 'overlay' ? 'mv-match-bar .match-box' : view === 'compact' ? 'mv-compact-dashboard-surface .current-match' : 'mv-dashboard-surface .current-match';
    const panel = page.locator(selector);
    const text = await panel.innerText();
    for (const player of snapshot.state.players) if (view !== 'overlay' && !text.includes(player.name)) throw new Error('Captured player does not match source observation.');
    if (/Northwind|Ironclaw/.test(text) || errors.length) throw new Error(JSON.stringify({ errors, text }));
    await panel.screenshot({ omitBackground: true, path: resolve(output, `match-vision-${view}-panel.png`) });
    await page.close();
  }
  await writeFile(resolve(output, 'capture-source.json'), JSON.stringify({
    replayUrl,
    matchId: snapshot.state.match.id, gameTime: snapshot.state.match.gameTime,
    realm: snapshot.state.match.realm, map: snapshot.state.match.map,
    players: snapshot.state.players.map(player => player.name),
    snapshotSha256: createHash('sha256').update(snapshotBytes).digest('hex'),
    method: 'Real replay data in current-match panels and a self-play match bar (only presentation flags changed); no fixture history captured.',
  }, null, 2) + '\n');
} finally { await browser.close(); }
