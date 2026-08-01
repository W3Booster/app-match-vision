import type { ConnectOptions } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../domain/match-vision-settings';

export const MATCH_VISION_CLIENT_ID = 'app_7bd7c42015297f608f1e5436';

/** Build SDK options from the URL without exposing tokens or transport details to the app. */
export function connectionOptions(search: string): ConnectOptions<MatchVisionSettings> {
    const parameters = new URLSearchParams(search);

    return {
        // Assigned once by W3Booster; unrelated to the editable app title.
        clientId: MATCH_VISION_CLIENT_ID,
        demo: parameters.has('demo'),
        // Published sessions must never probe a developer's localhost. Local platform
        // development is an explicit, per-browser opt-in via `?backend=local`.
        backend: parameters.get('backend') === 'local' ? 'local' : 'cloud'
    };
}
