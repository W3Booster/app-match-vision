/* Generated from the W3Booster application database. Do not edit directly. */
// @w3booster-client-id app_7bd7c42015297f608f1e5436
// @w3booster-revision 0f0f477fe05eab1a72414e94402b2bcc0a6efc0369b919935a0fd43a791e2bf9

import { connect, createClient, type ConnectOptions, type DeepReadonly, type StartupOptions } from '@w3booster/sdk';
import { resolveSettings, type DeepPartial } from '@w3booster/sdk/settings';

export interface W3BoosterAppSettings {
  player: {
    mapBarEnabled: boolean;
    mapNameEnabled: boolean;
    controlgroupsEnabled: boolean;
    topBarEnabled: boolean;
    additionalCSSClasses: {
      MATCHUP_BAR: "MatchupBarIsTopLeft" | "MatchupBarIsBottomCenter";
    };
    username: string;
    nationality: string;
    topBarStatisticsOfMeEnabled: boolean;
    topBarStatisticsOfOpponentEnabled: boolean;
    topBarGameDurationEnabled: boolean;
    topBarPlayerColorsEnabledIn1V1: boolean;
    topBarPlayerColorsEnabled: boolean;
    matchscoreEnabled: boolean;
    heroAbilitiesEnabled: boolean;
    heroItemsEnabled: boolean;
    heroExpProgressEnabled: boolean;
    heroLevelEnabled: boolean;
    researchesEnabled: boolean;
    researchesOfAttackAndArmorEnabled: boolean;
    researchesInQueueEnabled: boolean;
    researchesShowAllEnabled: false | true;
  };
  observer: {
    mapBarEnabled: boolean;
    mapNameEnabled: boolean;
    showRacesOnlyTextual: boolean;
    reversePlayerOrderMatchId: string;
    topBarEnabled: boolean;
    headlineTop: string;
    headlineBot: string;
    headlineTopIsMainHeadline: boolean;
    matchscoreEnabled: boolean;
    matchscoreEnabledInReplay: boolean;
    heroAbilitiesEnabled: boolean;
    heroItemsEnabled: boolean;
    heroExpProgressEnabled: boolean;
    heroLevelEnabled: boolean;
    researchesEnabled: boolean;
    researchesOfAttackAndArmorEnabled: boolean;
    researchesInQueueEnabled: boolean;
    researchesShowAllEnabled: false | true;
  };
}
export type W3BoosterAppDeliveredSettings = DeepPartial<W3BoosterAppSettings>;
const w3boosterEmptySettings: W3BoosterAppDeliveredSettings = {};
const w3boosterResolvedSettings = new WeakMap<object, DeepReadonly<W3BoosterAppSettings>>();

export const w3boosterApp = {
  clientId: "app_7bd7c42015297f608f1e5436",
  revision: "0f0f477fe05eab1a72414e94402b2bcc0a6efc0369b919935a0fd43a791e2bf9",
  scopes: ["match:read","players:read","stats:read","heroes:read","upgrades:read","resources:read","controlgroups:read","overlay:read"],
  settingsDefaults: {
    "player": {
      "mapBarEnabled": true,
      "mapNameEnabled": true,
      "controlgroupsEnabled": true,
      "topBarEnabled": true,
      "additionalCSSClasses": {
        "MATCHUP_BAR": "MatchupBarIsTopLeft"
      },
      "username": "",
      "nationality": "",
      "topBarStatisticsOfMeEnabled": true,
      "topBarStatisticsOfOpponentEnabled": true,
      "topBarGameDurationEnabled": true,
      "topBarPlayerColorsEnabledIn1V1": true,
      "topBarPlayerColorsEnabled": true,
      "matchscoreEnabled": true,
      "heroAbilitiesEnabled": true,
      "heroItemsEnabled": true,
      "heroExpProgressEnabled": true,
      "heroLevelEnabled": true,
      "researchesEnabled": true,
      "researchesOfAttackAndArmorEnabled": true,
      "researchesInQueueEnabled": true,
      "researchesShowAllEnabled": false
    },
    "observer": {
      "mapBarEnabled": true,
      "mapNameEnabled": true,
      "showRacesOnlyTextual": false,
      "reversePlayerOrderMatchId": "",
      "topBarEnabled": true,
      "headlineTop": "overlay provided by",
      "headlineBot": "W3Booster.com",
      "headlineTopIsMainHeadline": false,
      "matchscoreEnabled": true,
      "matchscoreEnabledInReplay": false,
      "heroAbilitiesEnabled": true,
      "heroItemsEnabled": true,
      "heroExpProgressEnabled": true,
      "heroLevelEnabled": true,
      "researchesEnabled": true,
      "researchesOfAttackAndArmorEnabled": true,
      "researchesInQueueEnabled": true,
      "researchesShowAllEnabled": false
    }
  }
} as const;

export type W3BoosterAppConnectOptions = Omit<ConnectOptions<W3BoosterAppDeliveredSettings>, 'clientId' | 'scopes'> & {
  readonly scopes?: readonly (typeof w3boosterApp.scopes)[number][] | 'configured';
};

/** Connect with this application's identity and generated settings type. */
export function connectW3BoosterApp(options: W3BoosterAppConnectOptions = {}) {
  return connect<W3BoosterAppDeliveredSettings>({ ...options, clientId: w3boosterApp.clientId });
}

/** Create a typed client before connecting so lifecycle listeners can be attached first. */
export function createW3BoosterAppClient(options: W3BoosterAppConnectOptions = {}) {
  return createClient<W3BoosterAppDeliveredSettings>({ ...options, clientId: w3boosterApp.clientId });
}

/** Connect and wait for the lifecycle milestone needed by a long-lived frontend. */
export async function startW3BoosterApp(options: W3BoosterAppConnectOptions = {}, startup: StartupOptions = {}) {
  const signal = startup.signal ?? options.signal;
  const client = createW3BoosterAppClient({ ...options, signal });
  try {
    await client.start({ ...startup, signal });
    return client;
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

/** Apply partial delivered values over the generated application defaults. */
export function resolveW3BoosterAppSettings(settings: W3BoosterAppDeliveredSettings = w3boosterEmptySettings): DeepReadonly<W3BoosterAppSettings> {
  const cached = w3boosterResolvedSettings.get(settings);
  if (cached) return cached;
  const resolved = resolveSettings<W3BoosterAppSettings>(w3boosterApp.settingsDefaults, settings);
  w3boosterResolvedSettings.set(settings, resolved);
  return resolved;
}
