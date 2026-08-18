/* Generated from the W3Booster application database. Do not edit directly. */
// @w3booster-client-id app_7bd7c42015297f608f1e5436
// @w3booster-revision 0f0f477fe05eab1a72414e94402b2bcc0a6efc0369b919935a0fd43a791e2bf9

import { defineApplication, type ApplicationConnectOptions } from '@w3booster/sdk/app';
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
const w3boosterAppDefinition = {
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

export const w3boosterApp = defineApplication<
  W3BoosterAppSettings,
  typeof w3boosterAppDefinition.scopes
>(w3boosterAppDefinition);

export type W3BoosterAppConnectOptions = ApplicationConnectOptions<
  W3BoosterAppSettings,
  typeof w3boosterAppDefinition.scopes
>;
