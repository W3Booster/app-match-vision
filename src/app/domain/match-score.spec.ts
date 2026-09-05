import { describe, expect, it } from 'vitest';
import { matchVisionScore } from './match-score';

const base = () => ({ capabilities: [], match: { id: '', status: 'none' as const, gameTime: 0, mode: '' }, players: [] });
describe('app-owned score', () => {
    it('uses modern game context without an overlay scope and keeps score separate', () => {
        const state = { ...base(), gameContext: { hudScale: 0.75, chatbarOpen: false, teamColors: false },
            application: { clientId: 'test', settings: {}, data: { matchScore: { wins: 8, losses: 3 } } },
            overlay: { runtime: { hudScale: 1, teamColors: true, matchScore: { wins: 99, losses: 99 } } } };
        expect(matchVisionScore(state)).toEqual({ wins: 8, losses: 3 });
    });
    it('does not read a score from legacy overlay state', () => {
        const state = { ...base(), overlay: { runtime: { hudScale: 0.8, teamColors: true, matchScore: { wins: 2, losses: 1 } } } };
        expect(matchVisionScore(state)).toBeUndefined();
    });
    it('keeps a missing application score unavailable', () => {
        const state = { ...base(), application: { clientId: 'test', settings: {}, data: {} },
            overlay: { runtime: { matchScore: { wins: 99, losses: 99 } } } };
        expect(matchVisionScore(state)).toBeUndefined();
    });
});
