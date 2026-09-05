import type { MatchLifecycleObservationEvent, MatchState } from '@w3booster/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { type MatchHistoryClient, MatchHistoryStore } from './match-history.store';

describe('MatchHistoryStore', () => {
    it('closes stale history on hydration and leaves only the current game live', () => {
        const oldEntry = (id: string) => ({
            id, map: 'Echo Isles', mode: 'Match', startedAt: '2026-09-04T12:00:00Z', players: []
        });
        let persisted = JSON.stringify([oldEntry('current'), oldEntry('missed-end'), oldEntry('older')]);
        const storage = { getItem: () => persisted, setItem: vi.fn((_key: string, value: string) => { persisted = value; }) };
        const store = new MatchHistoryStore(storage);
        let publish!: (state: MatchState<MatchVisionSettings> | null) => void | Promise<void>;
        store.connect({
            state: { subscribe: listener => { publish = listener; return () => undefined; } },
            subscribeMatchLifecycle: () => () => undefined
        });
        const current: MatchState<MatchVisionSettings> = {
            capabilities: ['match'], gameContext: { hudScale: 1 }, players: [],
            match: { id: 'current', status: 'running', gameTime: 10 }
        };
        publish(current);
        expect(store.entries().filter(entry => !entry.endedAt).map(entry => entry.id)).toEqual(['current']);
        expect(store.entries()[1]).toMatchObject({ endedAtSource: 'observed' });
        expect(store.entries()[1]?.result).toBeUndefined();
        const writes = storage.setItem.mock.calls.length;
        publish(current);
        expect(storage.setItem).toHaveBeenCalledTimes(writes);
        expect(new MatchHistoryStore(storage).entries().filter(entry => !entry.endedAt)).toHaveLength(1);

        publish({ ...current, match: { id: 'next', status: 'starting', gameTime: 0 } });
        expect(store.entries().filter(entry => !entry.endedAt).map(entry => entry.id)).toEqual(['next']);
        publish({ ...current, match: { id: '', status: 'none', gameTime: 0 } });
        expect(store.entries().filter(entry => !entry.endedAt)).toEqual([]);
        expect(store.entries().every(entry => entry.result === undefined)).toBe(true);
    });

    it('does not close a game on disconnect or when match access is unavailable', () => {
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        let publish!: (state: MatchState<MatchVisionSettings> | null) => void | Promise<void>;
        store.connect({
            state: { subscribe: listener => { publish = listener; return () => undefined; } },
            subscribeMatchLifecycle: () => () => undefined
        });
        store.record({ capabilities: ['match'], gameContext: { hudScale: 1 }, players: [],
            match: { id: 'still-playing', status: 'running', gameTime: 10 } });
        publish(null);
        publish({ capabilities: [], gameContext: { hudScale: 1 }, players: [],
            match: { id: '', status: 'none', gameTime: 0 } });
        expect(store.entries()[0]?.endedAt).toBeUndefined();
    });

    it.each(['won', 'lost'] as const)('persists a late %s result without losing races or duplicating writes', outcome => {
        let persisted: string | null = null;
        const setItem = vi.fn((_key: string, value: string) => { persisted = value; });
        const storage = { getItem: () => persisted, setItem };
        const store = new MatchHistoryStore(storage);
        let publish!: (state: MatchState<MatchVisionSettings> | null) => void | Promise<void>;
        store.connect({
            state: { subscribe: listener => { publish = listener; return () => undefined; } },
            subscribeMatchLifecycle: () => () => undefined
        });
        const finished: MatchState<MatchVisionSettings> = {
            capabilities: ['match', 'players'],
            gameContext: { hudScale: 1 },
            match: { id: 'late-result', status: 'finished', gameTime: 90, realm: 'w3champions',
                endedAt: '2026-09-05T12:00:00Z', isObserver: false, isReplay: false },
            players: [{ id: 'me', name: 'Moon', race: 'night-elf', team: 0 },
                { id: 'opponent', name: 'Grubby', race: 'orc', team: 1 }]
        };
        publish(finished);
        expect(store.entries()[0]?.result).toBeUndefined();

        // Results can arrive with fewer player details than the original snapshot.
        const withResult = { ...finished, players: [], match: { ...finished.match, result: { playerId: 'me', outcome } } };
        publish(withResult);
        const writes = setItem.mock.calls.length;
        publish(withResult);
        publish(finished);
        expect(setItem).toHaveBeenCalledTimes(writes);
        expect(store.entries()).toHaveLength(1);
        const restored = new MatchHistoryStore(storage).entries()[0]!;
        expect(restored.result).toEqual({ playerId: 'me', outcome });
        expect(restored.players.map(player => player.race)).toEqual(['night-elf', 'orc']);
        expect(restored.endedAt).toBe(finished.match.endedAt);
    });

    it('records the result from an initially finished lifecycle observation', () => {
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        const state = {
            capabilities: ['match'] as const, gameContext: { hudScale: 1 }, players: [],
            match: { id: 'finished-event', status: 'finished' as const, gameTime: 60,
                result: { playerId: 'me', outcome: 'won' as const } }
        };
        store.connect({
            state: { subscribe: () => () => undefined },
            subscribeMatchLifecycle: listener => {
                listener({ phase: 'ended', initial: true, observedAt: '2026-09-05T12:00:00Z', match: state.match, state });
                return () => undefined;
            }
        });
        expect(store.entries()[0]).toMatchObject({
            result: { playerId: 'me', outcome: 'won' }, endedAt: '2026-09-05T12:00:00Z'
        });
    });

    it.each([
        { isObserver: true, result: { playerId: 'observer', outcome: 'won' } },
        { isReplay: true, result: { playerId: 'me', outcome: 'lost' } },
        { result: { playerId: 'me', outcome: 'unknown' } },
        { result: { playerId: '', outcome: 'lost' } },
        {}
    ])('does not invent a personal result from unsuitable or missing data: %j', fields => {
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        store.record({
            capabilities: ['match'], gameContext: { hudScale: 1 }, players: [],
            match: { id: 'unknown-result', status: 'finished', gameTime: 60, ...fields }
        } as MatchState<MatchVisionSettings>);
        expect(store.entries()[0]?.result).toBeUndefined();
    });

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

    it('enriches an early partial snapshot without replacing its observed start time', () => {
        let stateListener: ((state: MatchState<MatchVisionSettings> | null) => void) | undefined;
        let writes = 0;
        const store = new MatchHistoryStore({
            getItem: () => null,
            setItem: () => { writes += 1; }
        });
        store.connect({
            state: {
                subscribe: listener => {
                    stateListener = listener;
                    return () => undefined;
                }
            },
            subscribeMatchLifecycle: listener => {
                const state: MatchState<MatchVisionSettings> = {
                    capabilities: ['match'], players: [],
                    match: { id: 'hydrating', status: 'starting', gameTime: 0, mode: '1v1' }
                };
                listener({ phase: 'started', initial: true, observedAt: '2026-08-19T10:00:00Z', match: state.match, state });
                return () => undefined;
            }
        });

        stateListener?.({
            capabilities: ['match'],
            players: [{ id: 'moon', name: 'Moon', race: 'night-elf', team: 0 }],
            match: { id: 'hydrating', status: 'running', gameTime: 5, mode: '1v1', map: 'Echo Isles' }
        });
        stateListener?.({
            capabilities: ['match'],
            players: [{ id: 'moon', name: 'Moon', race: 'night-elf', team: 0 }],
            match: { id: 'hydrating', status: 'running', gameTime: 6, mode: '1v1', map: 'Echo Isles' }
        });

        expect(store.entries()[0]).toEqual(expect.objectContaining({
            map: 'Echo Isles',
            startedAt: '2026-08-19T10:00:00Z',
            startedAtSource: 'observed',
            players: [{ id: 'moon', name: 'Moon', race: 'night-elf', team: 0 }]
        }));
        expect(writes).toBe(2);
    });

    it('preserves an unknown team as null in memory and persisted history', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value); }
        };
        const store = new MatchHistoryStore(storage);
        store.record({
            capabilities: ['match'],
            players: [{ id: 'unknown-side', name: 'Mystery', race: 'human' }],
            match: { id: 'unknown-team', status: 'running', gameTime: 1, mode: '1v1' }
        }, '2026-08-19T11:00:00Z');

        expect(store.entries()[0]?.players[0]?.team).toBeNull();
        expect(new MatchHistoryStore(storage).entries()[0]?.players[0]?.team).toBeNull();
    });

    it('enriches player fields independently without trading away known values', () => {
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        const match = { id: 'field-merge', status: 'running' as const, gameTime: 1, mode: '1v1' };
        store.record({
            capabilities: ['match'], match,
            players: [{ id: 'same-player', name: 'Known name', team: 0 }]
        }, '2026-08-19T12:00:00Z');
        store.record({
            capabilities: ['match'], match: { ...match, gameTime: 2 },
            players: [{ id: 'same-player', name: '', race: 'human', team: 0 }]
        }, '2026-08-19T12:00:01Z');

        expect(store.entries()[0]?.players[0]).toEqual({
            id: 'same-player', name: 'Known name', race: 'human', team: 0
        });
    });

    it('migrates legacy id-less players without duplicating them', () => {
        let persisted = JSON.stringify([{
            id: 'legacy-match',
            map: 'Echo Isles',
            mode: 'Match',
            startedAt: '2026-08-18T12:00:00Z',
            players: [{ name: 'Moon', race: 'night-elf', team: 0 }]
        }]);
        const store = new MatchHistoryStore({
            getItem: () => persisted,
            setItem: (_key, value) => { persisted = value; }
        });

        store.record({
            capabilities: ['match'],
            match: { id: 'legacy-match', status: 'running', gameTime: 1, mode: '1v1' },
            players: [{ id: 'moon-id', name: '', team: 0 }]
        }, '2026-08-19T12:00:00Z');

        expect(store.entries()[0]?.players).toEqual([{
            id: 'moon-id', name: 'Moon', race: 'night-elf', team: 0
        }]);
        expect(JSON.parse(persisted)[0].players).toHaveLength(1);
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

    it('records a finished hydrated match without an authoritative end timestamp', () => {
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
            capabilities: ['match'], players: [],
            match: { id: 'finished-observed', status: 'finished', gameTime: 600, mode: '1v1' }
        });

        expect(store.entries()[0]).toEqual(expect.objectContaining({
            id: 'finished-observed', endedAtSource: 'observed'
        }));
        expect(Number.isFinite(Date.parse(store.entries()[0]!.endedAt!))).toBe(true);
    });

    it('keeps the first observed finish stable across repeated finished snapshots', () => {
        vi.useFakeTimers();
        try {
            let stateListener: ((state: MatchState<MatchVisionSettings> | null) => void) | undefined;
            let writes = 0;
            const store = new MatchHistoryStore({
                getItem: () => null,
                setItem: () => { writes += 1; }
            });
            store.connect({
                state: {
                    subscribe: listener => {
                        stateListener = listener;
                        return () => undefined;
                    }
                },
                subscribeMatchLifecycle: () => () => undefined
            });
            const finished: MatchState<MatchVisionSettings> = {
                capabilities: ['match'], players: [],
                match: { id: 'stable-finish', status: 'finished', gameTime: 600, mode: '1v1' }
            };

            vi.setSystemTime(new Date('2026-08-19T12:10:00Z'));
            stateListener?.(finished);
            expect(store.entries()[0]?.endedAt).toBe('2026-08-19T12:10:00.000Z');
            expect(writes).toBe(2);

            vi.setSystemTime(new Date('2026-08-19T12:20:00Z'));
            stateListener?.(finished);
            expect(store.entries()[0]?.endedAt).toBe('2026-08-19T12:10:00.000Z');
            expect(writes).toBe(2);

            stateListener?.({
                ...finished,
                match: { ...finished.match, endedAt: '2026-08-19T12:09:30Z' }
            });
            expect(store.entries()[0]).toEqual(expect.objectContaining({
                endedAt: '2026-08-19T12:09:30Z', endedAtSource: 'match'
            }));
            expect(writes).toBe(3);
        } finally {
            vi.useRealTimers();
        }
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
