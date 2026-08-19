import { describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { MatchControls } from './match-controls';

describe('MatchControls', () => {
    it('serializes rapid reverse-order writes so the last choice wins', async () => {
        const releases: Array<() => void> = [];
        const setSetting = vi.fn(() => new Promise<MatchVisionSettings>(resolve => {
            releases.push(() => resolve({}));
        }));
        const client = { host: { setSetting } };
        const controls = new MatchControls();

        const first = controls.reversePlayers(client, 'match', false);
        const second = controls.reversePlayers(client, 'match', false);
        await Promise.resolve();
        expect(setSetting).toHaveBeenCalledTimes(1);
        expect(setSetting).toHaveBeenNthCalledWith(
            1,
            'observer.reversePlayerOrderMatchId',
            'match',
            { signal: expect.any(AbortSignal) }
        );

        releases[0]?.();
        await first;
        await Promise.resolve();
        expect(setSetting).toHaveBeenCalledTimes(2);
        expect(setSetting).toHaveBeenNthCalledWith(
            2,
            'observer.reversePlayerOrderMatchId',
            '',
            { signal: expect.any(AbortSignal) }
        );
        releases[1]?.();
        await second;
        expect(controls.displayedReversePlayerOrder(false)).toBe(false);
    });

    it('exposes acknowledged host failures and pending state to the UI', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let rejectAction: ((error: Error) => void) | undefined;
        const changeMatchScore = vi.fn(() => new Promise<void>((_resolve, reject) => {
            rejectAction = reject;
        }));
        const client = { host: { changeMatchScore } };
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
            .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
                rejectFirst = reject;
            }))
            .mockResolvedValueOnce(undefined);
        const client = { host: { changeMatchScore } };
        const controls = new MatchControls();

        const first = controls.changeScore(client, 'wins', 1);
        await controls.changeScore(client, 'losses', 1);
        rejectFirst?.(new Error('late failure'));
        await first;

        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('');
        consoleError.mockRestore();
    });

    it('cancels pending host actions without presenting teardown as an error', async () => {
        let actionSignal: AbortSignal | undefined;
        const changeMatchScore = vi.fn((_side, _delta, options: { signal: AbortSignal }) => {
            actionSignal = options.signal;
            return new Promise<void>((_resolve, reject) => {
                options.signal.addEventListener(
                    'abort',
                    () => reject(new DOMException('cancelled', 'AbortError')),
                    { once: true }
                );
            });
        });
        const client = { host: { changeMatchScore } };
        const controls = new MatchControls();

        const action = controls.changeScore(client, 'wins', 1);
        expect(controls.busy()).toBe(true);
        controls.destroy();
        await action;

        expect(actionSignal?.aborted).toBe(true);
        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('');
    });

});
