import type { MatchState } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import { w3boosterApp } from '../../core/w3booster-app.generated';
import type { MatchVisionSettings } from '../../domain';
import { createOverlayPresentation } from './overlay-presentation';

describe('overlay presentation', () => {
    it('selects and orders observer players without mutating SDK state', () => {
        const state = createState();
        state.match.isObserver = true;
        state.players[0]!.startPosition = { x: 10, y: 0 };
        state.players[1]!.startPosition = { x: 2, y: 0 };
        const original = structuredClone(state);

        const view = createOverlayPresentation(state, w3boosterApp.resolveSettings());

        expect(view.showsObserverBar).toBe(true);
        expect(view.observerPlayers?.map(player => player.id)).toEqual(['0', '1']);
        expect(view.streamer?.id).toBe('1');
        expect(view.opponent?.id).toBe('0');
        expect(state).toEqual(original);
    });

    it('keeps the observer bar hidden until both scoped players are available', () => {
        const state = createState();
        state.match.isObserver = true;
        state.players = state.players.slice(0, 1);

        const view = createOverlayPresentation(state, w3boosterApp.resolveSettings());

        expect(view.observerPlayers).toBeNull();
        expect(view.showsObserverBar).toBe(false);
    });

    it('reverses every observer-side presentation when configured', () => {
        const state = createState();
        state.match.isObserver = true;
        state.players[0]!.startPosition = { x: -10, y: 0 };
        state.players[1]!.startPosition = { x: 10, y: 0 };
        const settings = w3boosterApp.resolveSettings({
            observer: { reversePlayerOrderMatchId: 'match' }
        });

        const view = createOverlayPresentation(state, settings);

        expect(view.streamer?.id).toBe('1');
        expect(view.opponent?.id).toBe('0');
    });

    it('derives ability cooldowns from complete SDK state', () => {
        const state = createState();
        state.match.gameTime = 15;
        state.players[0]!.heroes = [{
            id: 'Hpal', name: 'Hpal', level: 1,
            abilities: [{ id: 'AHhb', name: 'AHhb', level: 1, lastActivation: 10_000 }]
        }];

        const ability = state.players[0]!.heroes![0]!.abilities![0]!;
        const cooldown = createOverlayPresentation(
            state, w3boosterApp.resolveSettings()
        ).abilityCooldowns.get(ability);
        expect(cooldown).toEqual({ total: 5, elapsed: 5, remaining: 0, progress: 1, active: false });
    });

    it('does not carry ability cooldowns beyond the match lifecycle', () => {
        const state = createState();
        state.match.status = 'finished';
        state.match.gameTime = 15;
        state.players[0]!.heroes = [{
            id: 'Hpal', name: 'Hpal', level: 1,
            abilities: [{ id: 'AHhb', name: 'AHhb', level: 1, lastActivation: 10_000 }]
        }];
        expect(createOverlayPresentation(state, w3boosterApp.resolveSettings()).abilityCooldowns.size).toBe(0);
    });

    it('keeps broadcaster-independent presentation available when identity is absent', () => {
        const state = createState();
        delete state.match.broadcasterPlayerId;

        const view = createOverlayPresentation(state, w3boosterApp.resolveSettings());

        expect(view.streamer).toBeNull();
        expect(view.opponent).toBeNull();
        expect(view.players.map(player => player.id)).toEqual(['0', '1']);
        expect(view.gameContext).toEqual({ hudScale: 1 });
        expect(view.score).toBeUndefined();
    });
});

function createState(): MatchState<MatchVisionSettings> {
    return {
        capabilities: ['match', 'players'],
        match: { id: 'match', status: 'running', gameTime: 0, mode: '1v1', broadcasterPlayerId: '0' },
        players: [{ id: '0', team: 0 }, { id: '1', team: 1 }]
    };
}
