import type { MatchLifecycleObservationEvent, MatchState } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { type MatchHistoryClient, MatchHistoryStore } from './match-history.store';

describe('MatchHistoryStore', () => {
    it('records a match once and persists it', () => {
        const values = new Map<string, string>();
        const store = new MatchHistoryStore({
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => { values.set(key, value); }
        });
        const state: MatchState<MatchVisionSettings> = {
            capabilities: ['match'],
            match: { id: '42', status: 'running', gameTime: 4, mode: '1v1', map: 'Echo Isles' },
            players: [{ id: '0', name: 'Moon', race: 'night-elf', team: 0 }]
        };

        const lifecycleListeners: Array<(event: MatchLifecycleObservationEvent<MatchVisionSettings>) => void> = [];
        const client: MatchHistoryClient = {
            state: { subscribe: () => () => undefined },
            subscribeMatchLifecycle: listener => {
                lifecycleListeners.push(listener);
                return () => undefined;
            },
        };
        store.connect(client);
        lifecycleListeners[0]?.({
            phase: 'started', initial: true, observedAt: '2026-08-19T00:00:00Z', match: state.match, state
        });
        lifecycleListeners[0]?.({
            phase: 'started', initial: false, observedAt: '2026-08-19T00:00:01Z', match: state.match, state
        });
        const completedState: MatchState<MatchVisionSettings> = {
            ...state,
            match: { ...state.match, status: 'finished', endedAt: '2026-08-19T00:30:00Z' }
        };
        lifecycleListeners[0]?.({
            phase: 'ended', initial: false, observedAt: '2026-08-19T00:30:01Z',
            match: completedState.match, previousMatch: state.match, state: completedState
        });

        expect(store.entries()).toHaveLength(1);
        expect(store.entries()[0]?.map).toBe('Echo Isles');
        expect(store.entries()[0]?.startedAtSource).toBe('observed');
        expect(store.entries()[0]?.endedAt).toBe('2026-08-19T00:30:00Z');
        expect(store.entries()[0]?.endedAtSource).toBe('match');
        expect([...values.values()][0]).toContain('Echo Isles');
    });

    it('owns initial-state and event subscriptions with an AbortSignal', () => {
        const signals: AbortSignal[] = [];
        let stateListener: ((state: MatchState<MatchVisionSettings> | null) => void) | undefined;
        const client: MatchHistoryClient = {
            state: {
                subscribe: (listener, options) => {
                    stateListener = listener;
                    signals.push(options!.signal!);
                    return () => undefined;
                }
            },
            subscribeMatchLifecycle: (_listener: unknown, options: { signal: AbortSignal }) => {
                signals.push(options.signal);
                return () => undefined;
            }
        };
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        store.connect(client);
        expect(signals).toHaveLength(2);
        expect(signals[0]?.aborted).toBe(false);
        store.connect(client);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(true);
        expect(signals[2]?.aborted).toBe(false);
        expect(signals[3]?.aborted).toBe(false);
        store.disconnect();
        expect(signals[2]?.aborted).toBe(true);
        expect(signals[3]?.aborted).toBe(true);
        expect(stateListener).toBeTypeOf('function');
    });

    it('reconciles an authoritative end time from a finished hydrated snapshot', () => {
        const initial = JSON.stringify([{
            id: '42', map: 'Echo Isles', mode: 'Match', startedAt: '2026-08-19T00:00:00Z', players: []
        }]);
        let persisted = initial;
        let stateListener: ((state: MatchState<MatchVisionSettings> | null) => void) | undefined;
        const store = new MatchHistoryStore({
            getItem: () => persisted,
            setItem: (_key, value) => { persisted = value; }
        });
        const client: MatchHistoryClient = {
            state: {
                subscribe: listener => {
                    stateListener = listener;
                    return () => undefined;
                }
            },
            subscribeMatchLifecycle: () => () => undefined
        };

        store.connect(client);
        stateListener?.({
            capabilities: ['match'], players: [],
            match: {
                id: '42', status: 'finished', gameTime: 1800, mode: '1v1',
                endedAt: '2026-08-19T00:30:00Z'
            }
        });

        expect(store.entries()[0]?.endedAt).toBe('2026-08-19T00:30:00Z');
        expect(store.entries()[0]?.endedAtSource).toBe('match');
        expect(JSON.parse(persisted)[0].endedAt).toBe('2026-08-19T00:30:00Z');
    });

    it('records the first authoritative snapshot when the match is already finished', () => {
        let stateListener: ((state: MatchState<MatchVisionSettings> | null) => void) | undefined;
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        store.connect({
            state: {
                subscribe: listener => {
                    stateListener = listener;
                    return () => undefined;
                }
            },
            subscribeMatchLifecycle: () => () => undefined
        });

        stateListener?.({
            capabilities: ['match'],
            players: [{ id: 'moon', name: 'Moon', race: 'night-elf', team: 0 }],
            match: {
                id: 'finished-first', status: 'finished', gameTime: 1800, mode: '1v1',
                map: 'Echo Isles', startedAt: '2026-08-19T00:00:00Z', endedAt: '2026-08-19T00:30:00Z'
            }
        });

        expect(store.entries()).toEqual([expect.objectContaining({
            id: 'finished-first',
            map: 'Echo Isles',
            startedAt: '2026-08-19T00:00:00Z',
            startedAtSource: 'match',
            endedAt: '2026-08-19T00:30:00Z',
            endedAtSource: 'match'
        })]);
    });

    it('ignores malformed persisted history instead of trusting parsed storage', () => {
        const wrongShape = new MatchHistoryStore({
            getItem: () => JSON.stringify({ id: 'not-an-array' }),
            setItem: () => undefined
        });
        expect(wrongShape.entries()).toEqual([]);

        const mixedEntries = new MatchHistoryStore({
            getItem: () => JSON.stringify([
                { id: 'valid', map: 'Turtle Rock', mode: 'Match', startedAt: '2026-08-18T12:00:00Z', players: [] },
                { id: 'invalid', players: 'not-an-array' }
            ]),
            setItem: () => undefined
        });
        expect(mixedEntries.entries().map(entry => entry.id)).toEqual(['valid']);
    });
});
