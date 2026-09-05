import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomaticScoreController, parseStoredScore, parseScoreCommit } from './automatic-score.controller';

const controllers: AutomaticScoreController[] = [];
afterEach(() => { controllers.forEach(controller => controller.disconnect()); controllers.length = 0; vi.restoreAllMocks(); });
function fixture() {
    let stored = { revision: 0, data: {} as Record<string, any> };
    let loseAcknowledgement = false;
    const host = { command: vi.fn(async (name: string, payload: any) => {
        if (name === 'application.storage.get') return structuredClone(stored);
        if (payload.expectedRevision !== stored.revision) return { committed: false };
        stored = { revision: stored.revision + 1, data: structuredClone(payload.data) };
        if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('Connection closed after commit'); }
        return { committed: true };
    }) };
    const state = { subscribe: (listener: any) => {
        listener({ capabilities: ['match', 'players'], match: {
            id: 'game-1', status: 'finished', mode: '1v1', gameTime: 800, realm: 'W3Champions',
            isReplay: false, isObserver: false, realBroadcasterPlayerId: '0',
            endedAt: new Date().toISOString(), result: { playerId: '0', outcome: 'won' }
        }, players: [{ id: '0', team: 0, isAI: false }, { id: '1', team: 1, isAI: false }] });
        return () => {};
    } };
    const connect = () => {
        const controller = new AutomaticScoreController(); controllers.push(controller);
        controller.connect(host as any, state as any); return controller;
    };
    return { connect, stored: () => stored, loseAcknowledgement: () => { loseAcknowledgement = true; } };
}

describe('automatic score persistence through generic SDK host commands', () => {
    it('two concurrent surfaces count one result once', async () => {
        const test = fixture(); const first = test.connect(); const second = test.connect();
        await Promise.all([first.run(), second.run()]);
        expect(test.stored().data['matchScore'].wins).toBe(1);
        expect(test.stored().data['automaticScore'].processedResults).toEqual(['game-1']);
    });
    it('a lost acknowledgement cannot duplicate the automatic increment on retry', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const test = fixture(); test.loseAcknowledgement(); const controller = test.connect();
        await controller.run();
        expect(test.stored().data['matchScore'].wins).toBe(1);
        await controller.run();
        expect(test.stored().data['matchScore'].wins).toBe(1);
    });
    it('reset and reopening retain the consumed result IDs', async () => {
        const test = fixture(); const controller = test.connect();
        await controller.run({ reset: true }); controller.disconnect();
        await test.connect().run();
        expect(test.stored().data['matchScore'].wins).toBe(0);
    });
});

describe('score host response validation', () => {
    it('accepts empty storage and explicit commit conflicts', () => {
        expect(parseStoredScore({ revision: 0, data: {} })).toEqual({ revision: 0, data: {} });
        expect(parseScoreCommit({ committed: false })).toEqual({ committed: false });
    });
    it('rejects malformed acknowledgements and corrupt score documents', () => {
        for (const value of [null, {}, { revision: '1', data: {} }, { revision: 1, data: [] },
            { revision: 1, data: { matchScore: { wins: '4', losses: 0, lastUpdate: 0 } } },
            { revision: 1, data: { automaticScore: { enabled: true, processedResults: [4] } } }]) {
            expect(() => parseStoredScore(value)).toThrow();
        }
        for (const value of [null, {}, { committed: 'true' }]) expect(() => parseScoreCommit(value)).toThrow();
    });
});
