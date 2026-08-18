import { describe, expect, it } from 'vitest';
import { connectionOptions } from './match-vision.config';

describe('Match Vision SDK configuration', () => {
    const signal = new AbortController().signal;

    it('leaves stable app identity ownership to the generated client helper', () => {
        expect(connectionOptions('', signal)).not.toHaveProperty('clientId');
    });

    it('enables the SDK demo transport only when requested', () => {
        expect(connectionOptions('?view=dashboard', signal).demo).toBe(false);
        expect(connectionOptions('?view=dashboard&demo=1', signal).demo).toMatchObject({
            settings: { player: { mapBarEnabled: true }, observer: { mapBarEnabled: true } }
        });
    });

    it('leaves platform transport selection to the SDK', () => {
        expect(connectionOptions('', signal).backend).toBeUndefined();
        expect(connectionOptions('?backend=local', signal).backend).toBeUndefined();
    });

    it('lets the regular dashboard own its viewport height and scrolling', () => {
        expect(connectionOptions('?view=dashboard', signal).autoResize).toBe(false);
        expect(connectionOptions('?view=compact', signal).autoResize).toBeUndefined();
        expect(connectionOptions('?view=overlay', signal).autoResize).toBeUndefined();
    });

    it('gives the SDK ownership of the live connection lifetime and retries', () => {
        const live = connectionOptions('', signal);
        expect(live.signal).toBe(signal);
        expect(live.retry).toBe(true);
        expect(connectionOptions('?demo=1', signal).retry).toBe(false);
    });
});
