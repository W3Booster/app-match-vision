import type { W3BoosterClient } from '@w3booster/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { MatchControls } from './match-controls';

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
});
