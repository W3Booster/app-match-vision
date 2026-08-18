import type { MatchState, W3BoosterClient } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { MatchHistoryStore } from './match-history.store';

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

        const stateListeners: Array<(state: MatchState<MatchVisionSettings>) => void> = [];
        const client = {
            state: {
                subscribe: (listener: (value: MatchState<MatchVisionSettings>) => void) => {
                    stateListeners.push(listener);
                    return () => undefined;
                }
            },
            on: () => () => undefined
        } as unknown as W3BoosterClient<MatchVisionSettings>;
        store.connect(client);
        stateListeners[0]?.(state);
        stateListeners[0]?.(state);

        expect(store.entries()).toHaveLength(1);
        expect(store.entries()[0]?.map).toBe('Echo Isles');
        expect([...values.values()][0]).toContain('Echo Isles');
    });

    it('owns initial-state and event subscriptions with an AbortSignal', () => {
        const signals: AbortSignal[] = [];
        const client = {
            state: {
                subscribe: (_listener: unknown, options: { signal: AbortSignal }) => {
                    signals.push(options.signal);
                    return () => undefined;
                }
            },
            on: (_type: string, _listener: unknown, options: { signal: AbortSignal }) => {
                signals.push(options.signal);
                return () => undefined;
            }
        } as unknown as W3BoosterClient<MatchVisionSettings>;
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        store.connect(client);
        expect(signals).toHaveLength(2);
        expect(signals[0]?.aborted).toBe(false);
        store.connect(client);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(true);
        expect(signals[2]?.aborted).toBe(false);
        store.disconnect();
        expect(signals[2]?.aborted).toBe(true);
        expect(signals[3]?.aborted).toBe(true);
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
