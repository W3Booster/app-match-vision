import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forkApplication } from './fork.mjs';
const oldId = 'app_' + 'a'.repeat(24), newId = 'app_' + 'b'.repeat(24);
test('fork preflights new identity, preserves failed projects, and binds a distinct app', async () => {
  const root = await mkdtemp(join(tmpdir(), 'w3booster-fork-test-'));
  const original = JSON.stringify({ name: 'test', w3booster: { clientId: oldId, settingsOutput: 'src/binding.ts' } });
  try {
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'package.json'), original);
    await writeFile(join(root, 'src/binding.ts'), 'original');
    const offline = async () => { throw new Error('offline'); };
    await assert.rejects(forkApplication({ root, clientId: oldId, request: offline }), /existing app ID/);
    await assert.rejects(forkApplication({ root, clientId: newId, request: offline }), /offline/);
    await assert.rejects(forkApplication({ root, clientId: newId, request: async () => ({ ok: true, json: async () => ({ clientId: oldId }) }) }), /Unexpected/);
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), original);
    assert.equal(await readFile(join(root, 'src/binding.ts'), 'utf8'), 'original');
    await forkApplication({ root, clientId: newId, log() {}, request: async (url, options) => {
      assert.ok(url.endsWith(newId)); assert.equal(options.headers, undefined);
      return { ok: true, json: async () => ({ clientId: newId, revision: 'c'.repeat(64), scopes: ['match:read'], settingsSchema: { version: 1, sections: [] } }) };
    } });
    assert.equal(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).w3booster.clientId, newId);
    assert.match(await readFile(join(root, 'src/binding.ts'), 'utf8'), new RegExp(newId));
  } finally { await rm(root, { recursive: true, force: true }); }
});
