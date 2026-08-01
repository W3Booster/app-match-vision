import type { ConnectOptions } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../domain/match-vision-settings';

export const MATCH_VISION_CLIENT_ID = 'app_7bd7c42015297f608f1e5436';

/** Build app-specific SDK options without handling platform transport or credentials. */
export function connectionOptions(search: string): ConnectOptions<MatchVisionSettings> {
    const parameters = new URLSearchParams(search);

    return {
        // Assigned once by W3Booster; unrelated to the editable app title.
        clientId: MATCH_VISION_CLIENT_ID,
        demo: parameters.has('demo')
    };
}
