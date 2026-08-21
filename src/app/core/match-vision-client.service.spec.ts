import { ConnectionError } from '@w3booster/sdk';
import type { HostLifecycleSnapshot, MatchState, W3BoosterClient } from '@w3booster/sdk';
import type { ApplicationRuntime, ApplicationRuntimeSnapshot } from '@w3booster/sdk/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../domain/match-vision-settings';
import type { W3BoosterAppSettings } from './w3booster-app.generated';

const { createRuntimeMock } = vi.hoisted(() => ({ createRuntimeMock: vi.fn() }));

vi.mock('./w3booster-app.generated', () => ({
    w3boosterApp: {
        settingsDefaults: { player: { mapBarEnabled: true }, observer: { mapBarEnabled: true } },
        createRuntime: createRuntimeMock
    }
}));

import { connectionErrorMessage, MatchVisionClientService } from './match-vision-client.service';

const unavailableHost: HostLifecycleSnapshot = {
    available: false, capabilities: [], capabilityStatus: 'unavailable'
};

describe('MatchVisionClientService', () => {
    beforeEach(() => createRuntimeMock.mockReset());

    it('explains that an application-definition mismatch requires a new app build', () => {
        const error = new ConnectionError(
            'Application definition mismatch.', [], 'APPLICATION_DEFINITION_MISMATCH', 409
        );

        expect(connectionErrorMessage(error)).toContain('Regenerate and redeploy');
    });

    it('does not describe a whole-startup timeout as missing match data', () => {
        const error = new ConnectionError(
            'Application runtime startup timed out.', [], 'STARTUP_TIMEOUT'
        );

        expect(connectionErrorMessage(error)).toBe('W3Booster did not start before the connection deadline.');
    });

    it('projects the managed SDK runtime and reactive host state into Angular signals', async () => {
        const readyState = createReadyState();
        let listener: ((snapshot: ApplicationRuntimeSnapshot<W3BoosterAppSettings>) => void) | undefined;
        const { client, runtime, snapshot } = createRuntime(readyState, next => { listener = next; });
        createRuntimeMock.mockReturnValue(runtime);
        const service = new MatchVisionClientService();

        await expect(service.start('?view=overlay')).resolves.toBe(client);

        expect(createRuntimeMock).toHaveBeenCalledWith(expect.objectContaining({ retry: true }));
        expect(runtime.start).toHaveBeenCalledOnce();
        expect(client.on).toHaveBeenCalledWith('issue', expect.any(Function), { signal: runtime.signal });
        expect(service.state()).toBe(readyState);
        expect(service.synchronized()).toBe(true);
        expect(service.settings()).toBe(snapshot.settings);

        const retry = {
            attempt: 2,
            maxAttempts: null,
            nextDelay: 1_500,
            lastError: new Error('temporarily unavailable')
        };
        listener?.({ ...snapshot, status: 'connecting', retry } as typeof snapshot & { retry: typeof retry });
        expect(service.retry()).toBe(retry);

        const knownHost: HostLifecycleSnapshot = {
            available: true, capabilities: ['window:open'], capabilityStatus: 'known'
        };
        listener?.({ ...snapshot, host: knownHost });
        expect(service.host()).toBe(knownHost);

        await service.stop();
        expect(runtime.stop).toHaveBeenCalledOnce();
        expect(service.client()).toBeNull();
        expect(service.state()).toBeNull();
        expect(service.status()).toBe('closed');
    });

    it('shares concurrent startup calls instead of leaking superseded runtimes', async () => {
        const readyState = createReadyState();
        let resolveStart: ((client: W3BoosterClient<MatchVisionSettings>) => void) | undefined;
        const created = createRuntime(readyState);
        created.runtime.start = vi.fn(() => new Promise(resolve => { resolveStart = resolve; }));
        createRuntimeMock.mockReturnValue(created.runtime);
        const service = new MatchVisionClientService();

        const first = service.start('?view=overlay');
        const second = service.start('?view=overlay');
        await vi.waitFor(() => expect(created.runtime.start).toHaveBeenCalledOnce());
        resolveStart?.(created.client);

        await expect(Promise.all([first, second])).resolves.toEqual([created.client, created.client]);
        expect(createRuntimeMock).toHaveBeenCalledOnce();
    });

    it('keeps later callers behind synchronization after the transport is connected', async () => {
        const readyState = createReadyState();
        let resolveStart: ((client: W3BoosterClient<MatchVisionSettings>) => void) | undefined;
        const created = createRuntime(readyState);
        created.runtime.start = vi.fn(() => new Promise(resolve => { resolveStart = resolve; }));
        createRuntimeMock.mockReturnValue(created.runtime);
        const service = new MatchVisionClientService();

        const first = service.start('?view=overlay');
        await vi.waitFor(() => expect(created.runtime.start).toHaveBeenCalledOnce());
        expect(service.status()).toBe('connected');

        let laterSettled = false;
        const later = service.start('?view=overlay').finally(() => { laterSettled = true; });
        await Promise.resolve();
        expect(laterSettled).toBe(false);

        resolveStart?.(created.client);
        await expect(Promise.all([first, later])).resolves.toEqual([created.client, created.client]);
        expect(createRuntimeMock).toHaveBeenCalledOnce();
    });

    it('waits for fresh synchronization when start is called during a later reconnect', async () => {
        const readyState = createReadyState();
        let listener: ((snapshot: ApplicationRuntimeSnapshot<W3BoosterAppSettings>) => void) | undefined;
        let resolveResynchronization: ((client: W3BoosterClient<MatchVisionSettings>) => void) | undefined;
        const created = createRuntime(readyState, next => { listener = next; });
        createRuntimeMock.mockReturnValue(created.runtime);
        const service = new MatchVisionClientService();
        await expect(service.start('?view=overlay')).resolves.toBe(created.client);
        created.runtime.start.mockImplementationOnce(() => new Promise(resolve => {
            resolveResynchronization = resolve;
        }));
        listener?.({ ...created.snapshot, status: 'reconnecting', isSynchronized: false });

        let settled = false;
        const restarted = service.start('?view=overlay').finally(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);
        expect(created.runtime.start).toHaveBeenCalledTimes(2);

        resolveResynchronization?.(created.client);
        await expect(restarted).resolves.toBe(created.client);
        expect(createRuntimeMock).toHaveBeenCalledOnce();
    });

    it('starts a fresh runtime when restart races with cancellation of an older startup', async () => {
        const readyState = createReadyState();
        let resolveFirst: ((client: W3BoosterClient<MatchVisionSettings>) => void) | undefined;
        const first = createRuntime(readyState);
        first.runtime.start = vi.fn(() => new Promise(resolve => { resolveFirst = resolve; }));
        const second = createRuntime(readyState);
        createRuntimeMock.mockReturnValueOnce(first.runtime).mockReturnValueOnce(second.runtime);
        const service = new MatchVisionClientService();

        const firstStart = service.start('?view=overlay');
        await vi.waitFor(() => expect(first.runtime.start).toHaveBeenCalledOnce());
        const stopping = service.stop();
        const restarted = service.start('?view=overlay');

        await expect(restarted).resolves.toBe(second.client);
        await stopping;
        expect(createRuntimeMock).toHaveBeenCalledTimes(2);
        expect(service.client()).toBe(second.client);

        resolveFirst?.(first.client);
        await expect(firstStart).resolves.toBeNull();
    });
});

function createReadyState(): MatchState<MatchVisionSettings> {
    return {
        capabilities: ['match'],
        match: { id: '42', status: 'running', gameTime: 1, mode: '1v1' },
        players: []
    };
}

function createRuntime(
    state: MatchState<MatchVisionSettings>,
    subscribed?: (listener: (snapshot: ApplicationRuntimeSnapshot<W3BoosterAppSettings>) => void) => void
): {
    client: W3BoosterClient<MatchVisionSettings>;
    runtime: ApplicationRuntime<W3BoosterAppSettings> & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
    snapshot: ApplicationRuntimeSnapshot<W3BoosterAppSettings>;
} {
    const client = {
        status: 'connected',
        state: { isSynchronized: true, get: () => state },
        host: { lifecycle: { get: () => unavailableHost } },
        on: vi.fn(() => () => undefined)
    } as unknown as W3BoosterClient<MatchVisionSettings>;
    const snapshot = {
        client,
        state,
        status: 'connected',
        isSynchronized: true,
        error: null,
        settings: {} as W3BoosterAppSettings,
        host: unavailableHost
    } satisfies ApplicationRuntimeSnapshot<W3BoosterAppSettings>;
    const runtime = {
        client,
        signal: new AbortController().signal,
        lifecycle: {
            get: () => snapshot,
            subscribe: vi.fn((listener: (value: typeof snapshot) => void) => {
                subscribed?.(listener);
                listener(snapshot);
                return () => undefined;
            })
        },
        start: vi.fn().mockResolvedValue(client),
        stop: vi.fn().mockResolvedValue(undefined)
    } as unknown as ApplicationRuntime<W3BoosterAppSettings> & {
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
    };
    return { client, runtime, snapshot };
}
