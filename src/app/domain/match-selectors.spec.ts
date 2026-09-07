import type { MatchState } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import { w3boosterApp, type W3BoosterAppDeliveredSettings } from '../core/w3booster-app.generated';
import type { MatchVisionSettings } from './match-vision-settings';
import { matchVisionPlayers, matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch } from './match-selectors';

describe('Match Vision view selectors', () => {
    it('selects app-owned settings without reading recorder overlay settings', () => {
        const state = createState();
        state.overlay = { runtime: { teamColors: true } };
        const settings = resolvedSettings({ player: { mapBarEnabled: false } });

        expect(matchVisionSettings(state.match, settings).mapBarEnabled).toBe(false);
    });

    it('formats server-redacted display players without mutating SDK state', () => {
        const state = createState();
        state.players.push({ id: '1', name: 'Player 3', race: 'random', team: 2 });
        const original = structuredClone(state);

        const players = matchVisionPlayers(state, matchVisionSettings(state.match, resolvedSettings()));

        expect(players[1]?.name).toBe('Player 3');
        expect(players[1]?.race).toBe('random');
        expect(Object.isFrozen(players)).toBe(true);
        expect(Object.isFrozen(players[1])).toBe(true);
        expect(state).toEqual(original);
    });

    it('keeps authoritative player fields separate from Match Vision presentation overrides', () => {
        const state = createState();
        state.players[0] = {
            ...state.players[0]!,
            name: 'InGame#123',
            mainAccount: { name: 'AuthoritativeAccount', country: 'se' }
        };
        state.players.push({ id: 'opponent', name: 'Opponent', team: 1 });
        const settings = {
            ...matchVisionSettings(state.match, resolvedSettings()),
            username: 'Broadcast Name',
            nationality: 'de'
        };

        const player = matchVisionPlayers(state, settings)[0]!;

        expect(player.name).toBe('InGame#123');
        expect(player.mainAccount).toEqual({ name: 'AuthoritativeAccount', country: 'se' });
        expect(player.displayIdentity.primaryName).toBe('Broadcast Name');
        expect(player.displayIdentity.inGameName).toBe('InGame');
        expect(player.displayCountry).toBe('de');
    });

    it('applies broadcaster presentation overrides by surface rather than visible player count', () => {
        const state = createState();
        state.match.mode = '2v2';
        state.players = [
            { id: 'opponent', name: 'Opponent', team: 1 },
            { id: '0', name: 'Broadcaster', team: 0 },
            { id: 'ally', name: 'Ally', team: 0 },
            { id: 'opponent-ally', name: 'Opponent Ally', team: 1 }
        ];
        const settings = {
            ...matchVisionSettings(state.match, resolvedSettings()),
            username: 'Broadcast Name',
            nationality: 'de'
        };

        const players = matchVisionPlayers(state, settings);
        const broadcaster = players.find(player => player.id === '0');

        expect(broadcaster?.displayIdentity.primaryName).toBe('Broadcast Name');
        expect(broadcaster?.displayCountry).toBe('de');
        expect(players.find(player => player.id === 'opponent')?.displayIdentity.primaryName).toBe('Opponent');
    });

    it('uses the SDK display identity for both account and in-game BattleTag discriminators', () => {
        const state = createState();
        state.players = [{
            id: 'player', name: 'InGame#1234', mainAccount: { name: 'Account#5678' }
        }];
        const [player] = matchVisionPlayers(state, matchVisionSettings(state.match, resolvedSettings()));

        expect(player?.displayIdentity).toEqual({
            primaryName: 'Account',
            inGameName: 'InGame',
            accountName: 'Account',
            hasAlias: true
        });
    });

    it('does not apply broadcaster settings when broadcaster identity is unavailable', () => {
        const state = createState();
        state.match.broadcasterPlayerId = undefined;
        state.players.push({ id: 'opponent', name: 'Opponent', team: 1 });
        const settings = {
            ...matchVisionSettings(state.match, resolvedSettings()),
            username: 'Broadcast Name',
            nationality: 'de'
        };

        const players = matchVisionPlayers(state, settings);

        expect(players[0]?.displayIdentity.primaryName).toBe('Player');
        expect(players[0]?.displayCountry).toBeUndefined();
    });

    it('preserves derived player identity when unrelated state branches change', () => {
        const state = createState();
        const settings = matchVisionSettings(state.match, resolvedSettings());
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
        const settings = resolvedSettings({ observer: { reversePlayerOrderMatchId: 'match' } });
        const reverse = reversePlayerOrderForMatch(
            state.match,
            matchVisionSettings(state.match, settings)
        );

        expect(matchVisionTeams(state, reverse).map(team => team.players[0]?.id)).toEqual(['right', 'left']);
    });

    it.each(['1v1', '2v2', '4ffa'])('pins the selected replay player first across dashboard layouts: %s', (mode) => {
        const state = createState();
        Object.assign(state.match, { mode, isReplay: true, isObserver: true, broadcasterPlayerId: 'selected' });
        state.players = [
            { id: 'other', team: 1, startPosition: { x: -10, y: 0 } },
            { id: 'selected', team: 0, startPosition: { x: 10, y: 0 } }
        ];
        if (mode !== '1v1') state.players.push({ id: 'ally', team: 0 }, { id: 'fourth', team: 1 });
        const original = structuredClone(state);
        for (const reverse of [false, true]) {
            expect(matchVisionTeams(state, reverse)[0]?.players[0]?.id).toBe('selected');
        }
        expect(state).toEqual(original);
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
        expect(matchVisionTeams(state, true).map(team => team.teamId)).toEqual([1, 0]);
    });

    it('keeps dashboard and overlay policy broadcaster-first for player and partial team state', () => {
        const state = createState();
        state.match.mode = '2v2';
        state.match.isObserver = true;
        state.match.broadcasterPlayerId = 'me';
        state.players = [
            { id: 'opponent', team: 1, startPosition: { x: -10, y: 0 } },
            { id: 'me', team: 0, startPosition: { x: 10, y: 0 } }
        ];

        expect(matchVisionTeams(state).map(team => team.players[0]?.id)).toEqual(['me', 'opponent']);
        state.match.isObserver = false;
        expect(matchVisionTeams(state).map(team => team.players[0]?.id)).toEqual(['me', 'opponent']);
    });

    it('keeps an unassigned team distinct from protocol team zero', () => {
        const state = createState();
        state.players = [
            { id: 'assigned', team: 0 },
            { id: 'unassigned' }
        ];

        expect(matchVisionTeams(state).map(team => team.teamId)).toEqual([0, null]);
    });

    it('keeps teamless free-for-all players as separate reversible sides', () => {
        const state = createState();
        state.match.mode = '4ffa';
        state.match.isObserver = true;
        state.players = [0, 1, 2, 3].map(index => ({ id: `ffa-${index}` }));

        expect(matchVisionTeams(state).map(team => team.players[0]?.id)).toEqual([
            'ffa-0', 'ffa-1', 'ffa-2', 'ffa-3'
        ]);
        expect(matchVisionTeams(state, true).map(team => team.players[0]?.id)).toEqual([
            'ffa-3', 'ffa-2', 'ffa-1', 'ffa-0'
        ]);
        expect(matchVisionTeams(state).map(team => team.teamId)).toEqual([null, null, null, null]);
    });

    it('keeps two teamless player-mode opponents as separate broadcaster-first sides', () => {
        const state = createState();
        state.match.mode = '1v1';
        state.match.isObserver = false;
        state.match.broadcasterPlayerId = 'me';
        state.players = [{ id: 'opponent' }, { id: 'me' }];

        expect(matchVisionTeams(state).map(team => team.players[0]?.id)).toEqual(['me', 'opponent']);
        expect(matchVisionTeams(state).map(team => team.teamId)).toEqual([null, null]);
        expect(matchVisionTeams(state, true).map(team => team.players[0]?.id)).toEqual(['opponent', 'me']);
    });

    it('resets reverse order for a new match and preserves it across restarts of the same match', () => {
        const state = createState();
        const settings = { reversePlayerOrderMatchId: 'match' };

        expect(reversePlayerOrderForMatch(state.match, settings)).toBe(true);
        state.match.id = 'next-match';
        expect(reversePlayerOrderForMatch(state.match, settings)).toBe(false);
    });

});

function resolvedSettings(settings: W3BoosterAppDeliveredSettings = {}) {
    return w3boosterApp.resolveSettings(settings);
}

function createState(): MatchState<MatchVisionSettings> {
    return {
        capabilities: ['match', 'players'],
        match: { id: 'match', status: 'running', gameTime: 10, mode: '1v1', broadcasterPlayerId: '0' },
        players: [{ id: '0', name: 'Player#123', race: 'human', team: 0, colorId: 1 }]
    };
}
