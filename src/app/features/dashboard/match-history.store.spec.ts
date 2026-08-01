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

        store.record(state);
        store.record(state);

        expect(store.entries()).toHaveLength(1);
        expect(store.entries()[0]?.map).toBe('Echo Isles');
        expect([...values.values()][0]).toContain('Echo Isles');
    });

    it('replaces client event subscriptions when reconnecting', () => {
        let unsubscribed = 0;
        const client = { on: () => () => { unsubscribed++; } } as unknown as W3BoosterClient<MatchVisionSettings>;
        const store = new MatchHistoryStore({ getItem: () => null, setItem: () => undefined });
        store.connect(client);
        store.connect(client);
        expect(unsubscribed).toBe(2);
    });
});
