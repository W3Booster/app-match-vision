import type { ConnectOptions } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../domain/match-vision-settings';

export const MATCH_VISION_CLIENT_ID = 'app_7bd7c42015297f608f1e5436';

/** Build SDK options from the URL without exposing tokens or transport details to the app. */
export function connectionOptions(search: string): ConnectOptions<MatchVisionSettings> {
    return {
        // Assigned once by W3Booster; unrelated to the editable app title.
        clientId: MATCH_VISION_CLIENT_ID,
        demo: new URLSearchParams(search).has('demo')
    };
}
