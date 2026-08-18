import type { MatchState, W3BoosterClient } from '@w3booster/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../domain/match-vision-settings';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@w3booster/sdk', async () => ({
    ...await vi.importActual<typeof import('@w3booster/sdk')>('@w3booster/sdk'),
    createClient: createClientMock
}));

import { MatchVisionClientService } from './match-vision-client.service';

describe('MatchVisionClientService', () => {
    beforeEach(() => createClientMock.mockReset());

    it('uses one SDK lifetime for connection, readiness, listeners, and teardown', async () => {
        const readyState: MatchState<MatchVisionSettings> = {
            capabilities: ['match'],
            match: { id: '42', status: 'running', gameTime: 1, mode: '1v1' },
            players: []
        };
        const listenerSignals: AbortSignal[] = [];
        let lifecycleListener: ((snapshot: {
            state: MatchState<MatchVisionSettings> | null;
            status: 'connected';
            isSynchronized: boolean;
            error: unknown | null;
        }) => void) | undefined;
        const lifecycleSubscribe = vi.fn((listener: typeof lifecycleListener, options: { signal: AbortSignal }) => {
            listenerSignals.push(options.signal);
            lifecycleListener = listener;
            return () => undefined;
        });
        const on = vi.fn((_type: string, _listener: unknown, options: { signal: AbortSignal }) => {
            listenerSignals.push(options.signal);
            return () => undefined;
        });
        const start = vi.fn().mockResolvedValue(undefined);
        const disconnect = vi.fn().mockResolvedValue(undefined);
        const client = {
            status: 'connected',
            state: { isSynchronized: true, get: () => readyState },
            lifecycle: { subscribe: lifecycleSubscribe },
            on,
            start,
            disconnect
        } as unknown as W3BoosterClient<MatchVisionSettings>;
        createClientMock.mockReturnValue(client);
        const service = new MatchVisionClientService();

        await expect(service.start('?view=overlay')).resolves.toBe(client);

        const options = createClientMock.mock.calls[0]?.[0] as { retry: boolean; signal: AbortSignal };
        expect(options.retry).toBe(true);
        expect(options.signal).toBeInstanceOf(AbortSignal);
        expect(start).toHaveBeenCalledWith({ signal: options.signal });
        expect(listenerSignals).toHaveLength(2);
        expect(listenerSignals.every(signal => signal === options.signal)).toBe(true);
        expect(service.state()).toBe(readyState);

        lifecycleListener?.({ state: readyState, status: 'connected', isSynchronized: false, error: null });
        expect(service.synchronized()).toBe(false);

        await service.stop();
        expect(options.signal.aborted).toBe(true);
        expect(disconnect).toHaveBeenCalledOnce();
        expect(service.client()).toBeNull();
        expect(service.state()).toBeNull();
        expect(service.status()).toBe('closed');
    });

    it('shares concurrent startup calls instead of leaking superseded clients', async () => {
        const readyState: MatchState<MatchVisionSettings> = {
            capabilities: ['match'],
            match: { id: '42', status: 'running', gameTime: 1, mode: '1v1' },
            players: []
        };
        let resolveStart: (() => void) | undefined;
        const start = vi.fn(() => new Promise<void>(resolve => { resolveStart = resolve; }));
        const client = {
            status: 'connecting',
            state: { isSynchronized: true, get: () => readyState },
            lifecycle: { subscribe: vi.fn(() => () => undefined) },
            on: vi.fn(() => () => undefined),
            start,
            disconnect: vi.fn().mockResolvedValue(undefined)
        } as unknown as W3BoosterClient<MatchVisionSettings>;
        createClientMock.mockReturnValue(client);
        const service = new MatchVisionClientService();

        const first = service.start('?view=overlay');
        const second = service.start('?view=overlay');
        await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
        resolveStart?.();

        await expect(Promise.all([first, second])).resolves.toEqual([client, client]);
        expect(createClientMock).toHaveBeenCalledOnce();
    });
});
