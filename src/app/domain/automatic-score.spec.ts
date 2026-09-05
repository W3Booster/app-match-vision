import { describe, expect, it } from 'vitest';
import { recordedResultFromState, resultScoreSide, updateScore, type ScoreContext, type RecordedResult } from './automatic-score';

const now = 1800000000000;
const result = (id = 'game', overrides: Partial<RecordedResult['match']> = {}): RecordedResult => ({
    id, recordedAt: now, match: { isWon: true, isReplay: false, isObserver: false, realm: 'W3Champions',
        gameTime: 800, players: { 0: { team: 0, isAI: false }, 1: { team: 1, isAI: false } }, ...overrides }
});
const context = (): ScoreContext => ({ document: { revision: 2, wins: 3, losses: 1, lastUpdate: now - 1000,
    automatic: true, processedResults: [] }, results: [] });

describe('Match Vision automatic scoring policy', () => {
    it('waits for a known SDK outcome and hydrated player eligibility', () => {
        const state: any = { capabilities: [], match: { id: 'game', status: 'finished', gameTime: 800,
            realm: 'Battle.net', isReplay: false, isObserver: false, realBroadcasterPlayerId: '0' }, players: [] };
        expect(recordedResultFromState(state)).toBeUndefined();
        state.match.result = { playerId: '0', outcome: 'won' };
        expect(recordedResultFromState(state)).toBeUndefined();
        state.players = [{ id: '0', team: 0, isAI: false }];
        expect(recordedResultFromState(state)?.match.isWon).toBe(true);
        state.match.result.playerId = '1';
        expect(recordedResultFromState(state)).toBeUndefined();
    });

    it('counts our human-player wins and losses once, including after rehydration', () => {
        const input = context();
        input.results = [result('win'), result('loss', { isWon: false }), result('win')];
        const next = updateScore(input, now);
        expect(next).toMatchObject({ wins: 4, losses: 2, processedResults: ['win', 'loss'] });
        expect(updateScore({ ...input, document: JSON.parse(JSON.stringify(next)) }, now)).toEqual(next);
        expect(input.document.wins).toBe(3);
    });

    it.each([
        { isReplay: true }, { isObserver: true }, { isWon: undefined }, { isReplay: undefined },
        { players: {} }, { gameTime: undefined }, { players: { 0: { team: 0, isAI: true } } },
        { players: { 0: { team: 0 } } }, { isWon: false, gameTime: 120 }
    ])('does not count ineligible or incomplete results: %j', overrides => {
        expect(resultScoreSide(result('game', overrides).match)).toBeUndefined();
    });

    it('preserves the precise W3Champions loss exception without excluding short wins or other realms', () => {
        expect(resultScoreSide(result('game', { gameTime: 120 }).match)).toBe('wins');
        expect(resultScoreSide(result('game', { isWon: false, gameTime: 121 }).match)).toBe('losses');
        expect(resultScoreSide(result('game', { isWon: false, gameTime: 20, realm: 'Battle.net' }).match)).toBe('losses');
    });

    it('ignores observer slots when checking for AI participants', () => {
        expect(resultScoreSide(result('game', { players: { 0: { team: 0, isAI: false }, 1: { team: 24, isAI: true } } }).match)).toBe('wins');
    });

    it('consumes results while disabled and never counts them later when enabled', () => {
        const input = context(); input.document.automatic = false; input.results = [result()];
        const disabled = updateScore(input, now);
        const enabled = updateScore({ ...input, document: disabled }, now, { automatic: true });
        expect(enabled).toMatchObject({ automatic: true, wins: 3, losses: 1, processedResults: ['game'] });
    });

    it('resets after five idle hours and counts a new game in the new session', () => {
        const input = context(); input.document.lastUpdate = now - 5 * 60 * 60 * 1000 - 1;
        expect(updateScore(input, now)).toMatchObject({ wins: 0, losses: 0, lastUpdate: now });
        input.results = [result()];
        expect(updateScore(input, now)).toMatchObject({ wins: 1, losses: 0 });
    });

    it('manual changes/reset preserve deduplication and clamp at zero', () => {
        const input = context(); input.document.losses = 0; input.results = [result()];
        const reset = updateScore(input, now, { reset: true });
        expect(updateScore({ ...input, document: reset }, now, { side: 'losses', delta: -1 })).toMatchObject({
            wins: 0, losses: 0, processedResults: ['game']
        });
    });
});
