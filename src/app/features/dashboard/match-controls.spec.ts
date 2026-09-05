import { describe, expect, it, vi } from 'vitest';
import type { MatchVisionSettings } from '../../domain';
import { MatchControls } from './match-controls';

describe('MatchControls', () => {
    it('sends rapid reverse-order intent in caller order so the SDK queue keeps the last choice', async () => {
        const setSetting = vi.fn().mockResolvedValue({} as MatchVisionSettings);
        const client = { host: { setSetting } };
        const controls = new MatchControls();

        const first = controls.reversePlayers(client, 'match', false);
        const second = controls.reversePlayers(client, 'match', false);
        await Promise.all([first, second]);
        expect(setSetting).toHaveBeenCalledTimes(2);
        expect(setSetting).toHaveBeenNthCalledWith(
            1,
            'observer.reversePlayerOrderMatchId',
            'match',
            { signal: expect.any(AbortSignal) }
        );

        expect(setSetting).toHaveBeenNthCalledWith(
            2,
            'observer.reversePlayerOrderMatchId',
            '',
            { signal: expect.any(AbortSignal) }
        );
        expect(controls.displayedReversePlayerOrder(false)).toBe(false);
    });

    it('exposes acknowledged host failures and pending state to the UI', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let rejectAction: ((error: Error) => void) | undefined;
        const openWindow = vi.fn(() => new Promise<void>((_resolve, reject) => {
            rejectAction = reject;
        }));
        const client = { host: { openWindow } };
        const controls = new MatchControls();

        const action = controls.openWindow(client, {});
        expect(controls.busy()).toBe(true);
        rejectAction?.(new Error('host unavailable'));
        await action;

        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('The compact Match Vision window could not be opened.');
        controls.clearError();
        expect(controls.error()).toBe('');
        consoleError.mockRestore();
    });

    it('does not let an older failed action overwrite a newer successful result', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let rejectFirst: ((error: Error) => void) | undefined;
        const openWindow = vi.fn()
            .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
                rejectFirst = reject;
            }))
            .mockResolvedValueOnce(undefined);
        const client = { host: { openWindow } };
        const controls = new MatchControls();

        const first = controls.openWindow(client, {});
        await controls.openWindow(client, {});
        rejectFirst?.(new Error('late failure'));
        await first;

        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('');
        consoleError.mockRestore();
    });

    it('cancels pending host actions without presenting teardown as an error', async () => {
        let actionSignal: AbortSignal | undefined;
        const openWindow = vi.fn((_window, options: { signal: AbortSignal }) => {
            actionSignal = options.signal;
            return new Promise<void>((_resolve, reject) => {
                options.signal.addEventListener(
                    'abort',
                    () => reject(new DOMException('cancelled', 'AbortError')),
                    { once: true }
                );
            });
        });
        const client = { host: { openWindow } };
        const controls = new MatchControls();

        const action = controls.openWindow(client, {});
        expect(controls.busy()).toBe(true);
        controls.destroy();
        await action;

        expect(actionSignal?.aborted).toBe(true);
        expect(controls.busy()).toBe(false);
        expect(controls.error()).toBe('');
    });

});
