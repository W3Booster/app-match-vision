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

    it('uses the cloud backend for normal published sessions', () => {
        expect(connectionOptions('').backend).toBe('cloud');
        expect(connectionOptions('?view=overlay&demo=1').backend).toBe('cloud');
    });

    it('uses localhost only when a developer explicitly requests it', () => {
        expect(connectionOptions('?backend=local').backend).toBe('local');
        expect(connectionOptions('?view=dashboard&backend=local').backend).toBe('local');
    });

    it('does not accept arbitrary backend overrides from the URL', () => {
        expect(connectionOptions('?backend=auto').backend).toBe('cloud');
        expect(connectionOptions('?backend=https://example.com').backend).toBe('cloud');
    });
});
