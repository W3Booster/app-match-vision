import type { MatchState } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import { overlayVisible } from './overlay-visibility';

describe('native HUD visibility', () => {
    it.each(['self', 'observer', 'replay'])('hides and restores both overlay surfaces for %s', (mode) => {
        for (const surface of ['ingameOverlay', 'streamOverlay'] as const) {
            for (const menuOpen of [true, false, undefined]) {
                const state = {
                    capabilities: [], players: [], gameContext: { hudScale: 1, menuOpen },
                    match: { id: 'match', status: 'running', gameTime: 5, paused: true,
                        isObserver: mode === 'observer', isReplay: mode === 'replay' },
                    application: { clientId: 'test', surface, settings: {} }
                } as unknown as MatchState;
                const before = structuredClone(state);
                expect(overlayVisible(state)).toBe(menuOpen !== true);
                expect(state).toEqual(before);
                expect(overlayVisible({ ...state, match: { ...state.match, status: 'idle' } })).toBe(false);
            }
        }
    });
});

// The layout observation owns visibility; do not guess from replay/observer mode.
describe('advanced observer visibility', () => {
    it.each(['self', 'observer', 'replay'])('hides and restores both surfaces for %s without mutating state', mode => {
        for (const surface of ['ingameOverlay', 'streamOverlay'] as const) {
            for (const advancedObserverMode of [undefined, true, false, true, undefined]) {
                const state = {
                    capabilities: [], players: [], gameContext: { hudScale: 1, advancedObserverMode },
                    match: { id: 'match', status: 'running', gameTime: 5,
                        isObserver: mode === 'observer', isReplay: mode === 'replay' },
                    application: { clientId: 'test', surface, settings: {} }
                } as unknown as MatchState;
                const before = structuredClone(state);
                expect(overlayVisible(state)).toBe(advancedObserverMode !== true);
                expect(state).toEqual(before);
                expect(overlayVisible({ ...state, gameContext: { ...state.gameContext, menuOpen: true } })).toBe(false);
            }
        }
    });
});
