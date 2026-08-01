import type { MatchState } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import type { MatchVisionSettings } from './match-vision-settings';
import { heroDisplayLevel, matchVisionPlayers, matchVisionSettings } from './match-selectors';

describe('Match Vision view selectors', () => {
    it('selects app-owned settings without reading recorder overlay settings', () => {
        const state = createState();
        state.application = { clientId: 'app', settings: { player: { mapBarEnabled: false } } };
        state.overlay = { settings: { mapBarEnabled: true }, misc: {} };

        expect(matchVisionSettings(state).mapBarEnabled).toBe(false);
    });

    it('derives privacy-safe display players without mutating SDK state', () => {
        const state = createState();
        state.match.mode = '4ffa';
        state.match.realm = 'W3Champions';
        state.players.push({ id: '1', name: 'Secret#123', race: 'orc', team: 2 });
        const original = structuredClone(state);

        const players = matchVisionPlayers(state, matchVisionSettings(state));

        expect(players[1]?.name).toBe('Player 3');
        expect(players[1]?.race).toBe('random');
        expect(state).toEqual(original);
    });

    it('preserves Match Vision hero-level progress while using the SDK hero model', () => {
        expect(heroDisplayLevel({ id: 'Hpal', name: 'Hpal', level: 2, experience: 300 })).toBe('2.3');
        expect(heroDisplayLevel({ id: 'Hpal', name: 'Hpal', level: 4 })).toBe('4');
    });
});

function createState(): MatchState<MatchVisionSettings> {
    return {
        capabilities: ['match', 'players'],
        match: { id: 'match', status: 'running', gameTime: 10, mode: '1v1', broadcasterPlayerId: '0' },
        players: [{ id: '0', name: 'Player#123', race: 'human', team: 0, colorId: 1 }]
    };
}
