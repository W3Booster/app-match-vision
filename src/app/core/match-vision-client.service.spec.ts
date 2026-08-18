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

import { MatchVisionClientService } from './match-vision-client.service';

const unavailableHost: HostLifecycleSnapshot = {
    available: false, capabilities: [], capabilityStatus: 'unavailable'
};

describe('MatchVisionClientService', () => {
    beforeEach(() => createRuntimeMock.mockReset());

    it('projects the managed SDK runtime and reactive host state into Angular signals', async () => {
        const readyState = createReadyState();
        let listener: ((snapshot: ApplicationRuntimeSnapshot<W3BoosterAppSettings>) => void) | undefined;
        const { client, runtime, snapshot } = createRuntime(readyState, next => { listener = next; });
        createRuntimeMock.mockReturnValue(runtime);
        const service = new MatchVisionClientService();

        await expect(service.start('?view=overlay')).resolves.toBe(client);

        expect(createRuntimeMock).toHaveBeenCalledWith(expect.objectContaining({ retry: true }));
        expect(runtime.start).toHaveBeenCalledOnce();
        expect(service.state()).toBe(readyState);
        expect(service.synchronized()).toBe(true);

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
