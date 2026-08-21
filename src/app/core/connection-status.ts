import type { MatchVisionConnectionRetry } from './match-vision-client.service';

export function retryConnectionMessage(retry: MatchVisionConnectionRetry): string {
    const attempt = retry.maxAttempts === null
        ? `attempt ${retry.attempt}`
        : `attempt ${retry.attempt} of ${retry.maxAttempts}`;
    if (retry.nextDelay !== null) {
        const seconds = Math.max(1, Math.ceil(retry.nextDelay / 1000));
        return `W3Booster is unavailable. Retrying in ${seconds}s (${attempt})…`;
    }
    return `Connecting to W3Booster (${attempt})…`;
}
