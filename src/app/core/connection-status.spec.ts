import { describe, expect, it } from 'vitest';
import { retryConnectionMessage } from './connection-status';

describe('retryConnectionMessage', () => {
    it('shows bounded retry progress during backoff', () => {
        expect(retryConnectionMessage({
            attempt: 2,
            maxAttempts: 5,
            nextDelay: 1_500,
            lastError: new Error('temporarily unavailable')
        })).toBe('W3Booster is unavailable. Retrying in 2s (attempt 2 of 5)…');
    });

    it('distinguishes an unlimited attempt currently in progress', () => {
        expect(retryConnectionMessage({
            attempt: 3,
            maxAttempts: null,
            nextDelay: null,
            lastError: new Error('temporarily unavailable')
        })).toBe('Connecting to W3Booster (attempt 3)…');
    });
});
