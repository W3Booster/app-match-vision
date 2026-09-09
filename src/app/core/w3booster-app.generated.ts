/* Generated from the W3Booster application database. Do not edit directly. */
// @w3booster-client-id app_7bd7c42015297f608f1e5436
// @w3booster-revision fef76895a6205e445159db7968ff605616176234281a46d1d67d223e697317a8

import type { W3BoosterClient } from '@w3booster/sdk';
import { defineApplication, type ApplicationConnectOptions, type ApplicationRuntime, type ApplicationRuntimeSnapshot } from '@w3booster/sdk/app';
import type { DeepPartial } from '@w3booster/sdk/settings';

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
    researchesShowAllEnabled: boolean;
    productionQueuesEnabled: boolean;
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
    researchesShowAllEnabled: boolean;
    productionQueuesEnabled: boolean;
  };
}
export type W3BoosterAppDeliveredSettings = DeepPartial<W3BoosterAppSettings>;
export type W3BoosterAppClient<TOverlayExtensions extends object = object> = W3BoosterClient<W3BoosterAppDeliveredSettings, TOverlayExtensions>;
export type W3BoosterAppRuntime<TOverlayExtensions extends object = object> = ApplicationRuntime<W3BoosterAppSettings, TOverlayExtensions>;
export type W3BoosterAppRuntimeSnapshot<TOverlayExtensions extends object = object> = ApplicationRuntimeSnapshot<W3BoosterAppSettings, TOverlayExtensions>;
const w3boosterAppDefinition = {
  clientId: "app_7bd7c42015297f608f1e5436",
  revision: "fef76895a6205e445159db7968ff605616176234281a46d1d67d223e697317a8",
  scopes: ["match:read","players:read","stats:read","heroes:read","upgrades:read","resources:read","controlgroups:read","buildings:read","production:read"],
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
      "researchesShowAllEnabled": false,
      "productionQueuesEnabled": true
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
      "researchesShowAllEnabled": false,
      "productionQueuesEnabled": true
    }
  }
} as const;

export const w3boosterApp = defineApplication<
  W3BoosterAppSettings,
  typeof w3boosterAppDefinition.scopes
>(w3boosterAppDefinition);

export type W3BoosterAppConnectOptions<TOverlayExtensions extends object = object> = ApplicationConnectOptions<
  W3BoosterAppSettings,
  typeof w3boosterAppDefinition.scopes,
  TOverlayExtensions
>;
