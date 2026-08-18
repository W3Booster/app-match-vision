import type { HostLifecycleSnapshot, W3BoosterClient } from '@w3booster/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { hostActionAvailable, MatchControls } from './match-controls';

describe('MatchControls', () => {
    it('serializes rapid reverse-order writes so the last choice wins', async () => {
        const releases: Array<() => void> = [];
        const setSetting = vi.fn(() => new Promise<MatchVisionSettings>(resolve => {
            releases.push(() => resolve({}));
        }));
        const client = { host: { setSetting } } as unknown as W3BoosterClient<MatchVisionSettings>;
        const controls = new MatchControls();

        const first = controls.reversePlayers(client, 'match', false);
        const second = controls.reversePlayers(client, 'match', false);
        await Promise.resolve();
        expect(setSetting).toHaveBeenCalledTimes(1);
        expect(setSetting).toHaveBeenNthCalledWith(1, 'observer.reversePlayerOrderMatchId', 'match');

        releases[0]?.();
        await first;
        await Promise.resolve();
        expect(setSetting).toHaveBeenCalledTimes(2);
        expect(setSetting).toHaveBeenNthCalledWith(2, 'observer.reversePlayerOrderMatchId', '');
        releases[1]?.();
        await second;
        expect(controls.displayedReversePlayerOrder(false)).toBe(false);
    });

    it('exposes acknowledged host failures and pending state to the UI', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let rejectAction: ((error: Error) => void) | undefined;
        const changeMatchScore = vi.fn(() => new Promise<unknown>((_resolve, reject) => {
            rejectAction = reject;
        }));
        const client = { host: { changeMatchScore } } as unknown as W3BoosterClient<MatchVisionSettings>;
        const controls = new MatchControls();

        const action = controls.changeScore(client, 'wins', 1);
        expect(controls.busy()).toBe(true);
        rejectAction?.(new Error('host unavailable'));
        await action;

        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('The match score could not be updated.');
        controls.clearError();
        expect(controls.error()).toBe('');
        consoleError.mockRestore();
    });

    it('does not let an older failed action overwrite a newer successful result', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let rejectFirst: ((error: Error) => void) | undefined;
        const changeMatchScore = vi.fn()
            .mockImplementationOnce(() => new Promise<unknown>((_resolve, reject) => {
                rejectFirst = reject;
            }))
            .mockResolvedValueOnce({ accepted: true });
        const client = { host: { changeMatchScore } } as unknown as W3BoosterClient<MatchVisionSettings>;
        const controls = new MatchControls();

        const first = controls.changeScore(client, 'wins', 1);
        await controls.changeScore(client, 'losses', 1);
        rejectFirst?.(new Error('late failure'));
        await first;

        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('');
        consoleError.mockRestore();
    });

    it('uses the SDK capability decision across known, legacy, pending, and unavailable hosts', () => {
        const capable: HostLifecycleSnapshot = {
            available: true, capabilityStatus: 'known', capabilities: ['window:open']
        };
        const legacy: HostLifecycleSnapshot = {
            available: true, capabilityStatus: 'legacy', capabilities: []
        };
        const pending: HostLifecycleSnapshot = {
            available: true, capabilityStatus: 'pending', capabilities: []
        };

        expect(hostActionAvailable(capable, 'window:open')).toBe(true);
        expect(hostActionAvailable(capable, 'settings:write')).toBe(false);
        expect(hostActionAvailable(legacy, 'settings:write')).toBe(true);
        expect(hostActionAvailable(pending, 'window:open')).toBe(false);
    });
});
