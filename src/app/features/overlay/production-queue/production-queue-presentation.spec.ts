import { describe, expect, it } from 'vitest';
import type { MatchState } from '@w3booster/sdk';
import { createDemoState } from '@w3booster/sdk/testing';
import { w3boosterApp } from '../../../core/w3booster-app.generated';
import { createOverlayPresentation } from '../overlay-presentation';
import { productionPlayers, progressLabel, remainingSecondsLabel, isProgressWaiting } from './production-queue-presentation';

function fixture() {
    const state = structuredClone(createDemoState()) as MatchState;
    for (const player of state.players) {
        const id = `000000000000000${Number(player.id) + 1}`;
        Object.assign(player, { buildings: { [id]: { id, typeId: 'hbar', isIllusion: false, production: { queue: [
            { position: 0, typeId: 'hfoo', progress: null, remainingSeconds: null, totalSeconds: null },
            { position: 1, typeId: 'hfoo', progress: 0, remainingSeconds: null, totalSeconds: null }
        ] } } } });
    }
    return state;
}
function groups(state: MatchState, reverse = false) {
    const view = createOverlayPresentation(state, w3boosterApp.resolveSettings());
    return productionPlayers(view.players, state.match, reverse);
}

describe('production queue presentation', () => {
    it('rounds remaining game seconds like ability cooldowns and keeps unknown timers unknown', () => {
        expect(remainingSecondsLabel(12.4)).toBe('13');
        expect(remainingSecondsLabel(0.01)).toBe('1');
        expect(remainingSecondsLabel(0)).toBe('0');
        expect(remainingSecondsLabel(null)).toBe('?');
        expect(remainingSecondsLabel(undefined)).toBe('?');
    });
    it('identifies unstarted production without treating unreadable or absent timers as blocked', () => {
        const slot = { position: 0, typeId: 'hfoo', progress: 0, remainingSeconds: null, totalSeconds: null };
        expect(isProgressWaiting(slot)).toBe(true);
        expect(isProgressWaiting({ ...slot, progress: null, remainingSeconds: null, totalSeconds: null })).toBe(false);
        expect(isProgressWaiting({ ...slot, remainingSeconds: 20, totalSeconds: 20 })).toBe(false);
    });

    it('only shows the current player during play even if another player has data', () => {
        const state = fixture();
        expect(groups(state).map(group => group.player.id)).toEqual(['0']);
        Object.assign(state.match, { broadcasterPlayerId: undefined });
        expect(groups(state)).toEqual([]);
    });

    it.each(['1v1', '2v2', 'FFA'])('shows available queues for every observer player in %s', mode => {
        const state = fixture();
        Object.assign(state.match, { mode, isObserver: true, broadcasterPlayerId: undefined });
        expect(groups(state).map(group => group.player.id)).toEqual(['0', '1']);
    });

    it('keeps replay selection first even when manual reversal is enabled', () => {
        const state = fixture();
        Object.assign(state.match, { isReplay: true, broadcasterPlayerId: '1' });
        expect(groups(state, true).map(group => group.player.id)).toEqual(['1', '0']);
    });

    it('assigns sides before filtering idle buildings and keeps teams together', () => {
        const state = fixture();
        Object.assign(state.match, { isObserver: true });
        Object.assign(state.players[0], { buildings: {} });
        expect(groups(state).map(group => [group.player.id, group.side])).toEqual([['1', 'right']]);
        const team = fixture();
        Object.assign(team.match, { isObserver: true, mode: '2v2' });
        Object.assign(team.players[1], { team: 0 });
        expect(groups(team).map(group => group.side)).toEqual(['left', 'left']);
    });

    it('retains duplicate slots and unknown progress without cloning SDK buildings', () => {
        const state = fixture();
        const before = structuredClone(state);
        const building = groups(state)[0]!.buildings[0]!;
        expect(building).toBe(state.players[0]!.buildings!['0000000000000001']);
        expect(building.production!.queue.map(slot => slot.typeId)).toEqual(['hfoo', 'hfoo']);
        expect(building.production!.queue.map(slot => slot.progress)).toEqual([null, 0]);
        expect(state).toEqual(before);
        expect(progressLabel(null)).toBe('Progress unknown');
        expect(progressLabel(0)).toBe('0%');
        expect(progressLabel(0.375)).toBe('37%');
    });

    it('removes cancelled and completed queues and tolerates unobserved production', () => {
        const state = fixture();
        expect(groups(state)).toHaveLength(1);
        const next = structuredClone(state);
        Object.assign(next.players[0], { buildings: {
            '0000000000000001': { id: '0000000000000001', typeId: 'hbar', isIllusion: false, production: { queue: [] } },
            '0000000000000003': { id: '0000000000000003', typeId: 'hbar', isIllusion: false }
        } });
        expect(groups(next)).toEqual([]);
        Object.assign(next.players[0], { buildings: undefined });
        expect(groups(next)).toEqual([]);
    });
});


describe('construction presentation', () => {
    it('keeps observed in-progress buildings, including unknown progress, without inventing completion', () => {
        const state = fixture();
        Object.assign(state.players[0], { buildings: {
            a: { id: 'a', typeId: 'hbar', isIllusion: false, construction: { progress: 0, remainingSeconds: null, totalSeconds: null } },
            b: { id: 'b', typeId: 'hhou', isIllusion: false, construction: { progress: null, remainingSeconds: null, totalSeconds: null } },
            c: { id: 'c', typeId: 'hhou', isIllusion: false, construction: { progress: 1, remainingSeconds: 0, totalSeconds: 20 } },
            d: { id: 'd', typeId: 'hhou', isIllusion: false }
        } });
        const result = groups(state);
        expect(result[0]!.constructions.map(b => b.id)).toEqual(['a', 'b']);
        expect(result[0]!.constructions[0]).toBe(state.players[0]!.buildings!['a']);
        expect(result[0]!.buildings).toEqual([]);
    });
    it('uses independent toggles without moving the other player when a side becomes empty', () => {
        const state = fixture();
        Object.assign(state.match, { isObserver: true });
        Object.assign(state.players[0], { buildings: { a: { id: 'a', typeId: 'hbar', isIllusion: false, construction: { progress: 0.5, remainingSeconds: 10, totalSeconds: 20 } } } });
        const view = createOverlayPresentation(state, w3boosterApp.resolveSettings());
        expect(productionPlayers(view.players, state.match, false, false, true).map(g => [g.player.id, g.side])).toEqual([['0', 'left']]);
        expect(productionPlayers(view.players, state.match, false, true, false).map(g => [g.player.id, g.side])).toEqual([['1', 'right']]);
        expect(productionPlayers(view.players, state.match, false, false, false)).toEqual([]);
    });
});
