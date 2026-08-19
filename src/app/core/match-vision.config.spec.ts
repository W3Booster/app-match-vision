import { describe, expect, it } from 'vitest';
import { connectionOptions } from './match-vision.config';

describe('Match Vision SDK configuration', () => {
    it('leaves stable app identity ownership to the generated client helper', () => {
        expect(connectionOptions('')).not.toHaveProperty('clientId');
    });

    it('enables the SDK demo transport only when requested', () => {
        expect(connectionOptions('?view=dashboard').demo).toBe(false);
        expect(connectionOptions('?view=dashboard&demo=1').demo).toMatchObject({
            settings: { player: { mapBarEnabled: true }, observer: { mapBarEnabled: true } }
        });
    });

    it('uses the proxied production API while leaving backend selection to the SDK', () => {
        expect(connectionOptions('').cloudApi).toBe('https://api.w3booster.com');
        expect(connectionOptions('').backend).toBeUndefined();
        expect(connectionOptions('?backend=local').backend).toBeUndefined();
    });

    it('lets the regular dashboard own its viewport height and scrolling', () => {
        expect(connectionOptions('?view=dashboard').autoResize).toBe(false);
        expect(connectionOptions('?view=compact').autoResize).toBeUndefined();
        expect(connectionOptions('?view=overlay').autoResize).toBeUndefined();
    });

    it('gives the SDK ownership of the live connection lifetime and retries', () => {
        const live = connectionOptions('');
        expect(live.signal).toBeUndefined();
        expect(live.retry).toBe(true);
        expect(connectionOptions('?demo=1').retry).toBe(false);
    });
});
