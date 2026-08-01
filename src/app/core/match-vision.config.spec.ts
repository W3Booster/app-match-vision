import { describe, expect, it } from 'vitest';
import { connectionOptions, MATCH_VISION_CLIENT_ID } from './match-vision.config';

describe('Match Vision SDK configuration', () => {
    it('uses the stable app identity', () => {
        expect(connectionOptions('').clientId).toBe(MATCH_VISION_CLIENT_ID);
    });

    it('enables the SDK demo transport only when requested', () => {
        expect(connectionOptions('?view=dashboard').demo).toBe(false);
        expect(connectionOptions('?view=dashboard&demo=1').demo).toBe(true);
    });

    it('leaves platform transport selection to the SDK', () => {
        expect(connectionOptions('?view=dashboard&backend=local').backend).toBeUndefined();
    });
});
