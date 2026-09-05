import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyScore } from './migrate-legacy-score.mjs';
test('migration preserves score and disabled preference, retains the source, and never overwrites app data', () => {
  const entries = new Map([['MATCH_SCORE', JSON.stringify({ wins: 8, losses: 3, lastUpdate: 123 })]]);
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  assert.equal(migrateLegacyScore(storage, 'user', false), true);
  const migrated = JSON.parse(entries.get('w3booster:application-data:user:app_7bd7c42015297f608f1e5436'));
  assert.deepEqual(migrated.data.matchScore, { wins: 8, losses: 3, lastUpdate: 123 });
  assert.equal(migrated.data.automaticScore.enabled, false);
  assert.ok(entries.has('MATCH_SCORE'));
  assert.equal(migrateLegacyScore(storage, 'user', true), false);
});
