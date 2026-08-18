import type { MatchState } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import type { MatchVisionSettings } from './match-vision-settings';
import { matchVisionPlayers, matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch } from './match-selectors';

describe('Match Vision view selectors', () => {
    it('selects app-owned settings without reading recorder overlay settings', () => {
        const state = createState();
        state.application = { clientId: 'app', settings: { player: { mapBarEnabled: false } } };
        state.overlay = { runtime: { teamColors: true } };

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
        expect(Object.isFrozen(players)).toBe(true);
        expect(Object.isFrozen(players[1])).toBe(true);
        expect(state).toEqual(original);
    });

    it('preserves derived player identity when unrelated state branches change', () => {
        const state = createState();
        const settings = matchVisionSettings(state);
        const first = matchVisionPlayers(state, settings);
        state.match.gameTime += 1;
        const second = matchVisionPlayers(state, settings);

        expect(second).toBe(first);
        expect(second[0]).toBe(first[0]);
    });

    it('orders observer teams by map position and applies the reverse-order setting', () => {
        const state = createState();
        state.match.isObserver = true;
        state.players = [
            { id: 'left', team: 0, startPosition: { x: -10, y: 0 } },
            { id: 'right', team: 1, startPosition: { x: 10, y: 0 } }
        ];
        state.application = {
            clientId: 'match-vision',
            settings: { observer: { reversePlayerOrderMatchId: 'match' } }
        };

        expect(matchVisionTeams(state).map(team => team.players[0]?.id)).toEqual(['right', 'left']);
    });

    it('uses the broadcaster-first team order consistently for team observers', () => {
        const state = createState();
        state.match.isObserver = true;
        state.match.mode = '2v2';
        state.match.broadcasterPlayerId = 'me';
        state.players = [
            { id: 'opponent', team: 1 },
            { id: 'me', team: 0 },
            { id: 'ally', team: 0 },
            { id: 'opponent-ally', team: 1 }
        ];

        expect(matchVisionTeams(state).map(team => team.players.map(player => player.id))).toEqual([
            ['me', 'ally'],
            ['opponent', 'opponent-ally']
        ]);
        expect(matchVisionTeams(state, true).map(team => team.id)).toEqual([1, 0]);
    });

    it('keeps an unassigned team distinct from protocol team zero', () => {
        const state = createState();
        state.players = [
            { id: 'assigned', team: 0 },
            { id: 'unassigned' }
        ];

        expect(matchVisionTeams(state).map(team => team.id)).toEqual([0, null]);
    });

    it('resets reverse order for a new match and preserves it across restarts of the same match', () => {
        const state = createState();
        const settings = { reversePlayerOrderMatchId: 'match' };

        expect(reversePlayerOrderForMatch(state.match, settings)).toBe(true);
        state.match.id = 'next-match';
        expect(reversePlayerOrderForMatch(state.match, settings)).toBe(false);
    });

});

function createState(): MatchState<MatchVisionSettings> {
    return {
        capabilities: ['match', 'players'],
        match: { id: 'match', status: 'running', gameTime: 10, mode: '1v1', broadcasterPlayerId: '0' },
        players: [{ id: '0', name: 'Player#123', race: 'human', team: 0, colorId: 1 }]
    };
}
