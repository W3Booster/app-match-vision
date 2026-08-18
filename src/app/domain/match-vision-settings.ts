import type { DeepReadonly } from '@w3booster/sdk';
import type { W3BoosterAppDeliveredSettings, W3BoosterAppSettings } from '../core/w3booster-app.generated';

/** Host settings may arrive incrementally; field names and values come from the generated database schema binding. */
export type MatchVisionSettings = W3BoosterAppDeliveredSettings;
/** Complete presentation settings after generated database defaults are applied. */
export type MatchVisionOverlaySettings = DeepReadonly<
    W3BoosterAppSettings['player'] & W3BoosterAppSettings['observer']
>;
