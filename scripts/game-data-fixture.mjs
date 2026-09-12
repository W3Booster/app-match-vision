import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Generated object excerpt from 2.0.4.23745; only a geometry-test fixture.
// Real-image validation belongs to the platform patch catalog-browser test.
export async function installGameDataFixture(page) {
    const bytes = await readFile(new URL('./fixtures/catalog.json', import.meta.url));
    const catalog = JSON.parse(bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const id = `${catalog.gameVersion}-${digest.slice(0, 16)}`;
    const manifest = { schemaVersion: 1, id, gameVersion: catalog.gameVersion, ruleset: catalog.ruleset,
        files: { 'catalog.json': { sha256: digest }, 'unit-gameplay.json': { sha256: '0'.repeat(64) } } };
    await page.route('**/wc3/game-data/**', route => route.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: route.request().url().endsWith('manifest.json') ? JSON.stringify(manifest) : bytes }));
    await page.route('**/wc3/images/**', route => route.fulfill({ status: 204 }));
    return { id, image: (kind, typeId, graphics, level = 1) => catalog.images[catalog[kind][typeId].artwork.icon[graphics][level - 1]] };
}
