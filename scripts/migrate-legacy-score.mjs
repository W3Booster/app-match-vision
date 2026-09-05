/**
 * One-time deployment helper, executed in the desktop host's storage context.
 * Keep legacy knowledge in the application repository, never in platform runtime.
 * Pass the authenticated user's ID and saved UPDATE_MATCH_SCORE_AUTOMATICALLY value.
 * The legacy unscoped score key cannot identify its owner: the caller must select
 * the correct desktop profile/user before running this migration.
 */
export function migrateLegacyScore(storage, userId, automatic = true) {
  if (typeof userId !== 'string' || !userId || typeof automatic !== 'boolean') throw new TypeError('A user ID and boolean preference are required.');
  const key = `w3booster:application-data:${userId}:app_7bd7c42015297f608f1e5436`;
  if (storage.getItem(key)) return false;
  const legacy = JSON.parse(storage.getItem('MATCH_SCORE') || '{"wins":0,"losses":0,"lastUpdate":0}');
  for (const field of ['wins', 'losses', 'lastUpdate']) {
    if (!Number.isSafeInteger(legacy[field]) || legacy[field] < 0) throw new TypeError(`Invalid legacy ${field}`);
  }
  storage.setItem(key, JSON.stringify({ revision: 0, data: {
    matchScore: { wins: legacy.wins, losses: legacy.losses, lastUpdate: legacy.lastUpdate },
    automaticScore: { enabled: automatic, processedResults: [] }
  } }));
  return true;
}
