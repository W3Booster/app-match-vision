export interface MatchVisionOverlaySettings {
    additionalCSSClasses?: Record<string, string>;
    controlgroupsEnabled?: boolean;
    headlineBot?: string;
    headlineTop?: string;
    headlineTopIsMainHeadline?: boolean;
    heroAbilitiesEnabled?: boolean;
    heroExpProgressEnabled?: boolean;
    heroItemsEnabled?: boolean;
    heroLevelEnabled?: boolean;
    mapBarEnabled?: boolean;
    mapNameEnabled?: boolean;
    matchscoreEnabled?: boolean;
    matchscoreEnabledInReplay?: boolean;
    nationality?: string;
    researchesEnabled?: boolean;
    researchesOfAttackAndArmorEnabled?: boolean;
    researchesShowAllEnabled?: boolean;
    reversePlayerOrder?: boolean;
    showRacesOnlyTextual?: boolean;
    topBarEnabled?: boolean;
    topBarGameDurationEnabled?: boolean;
    topBarPlayerColorsEnabled?: boolean;
    topBarPlayerColorsEnabledIn1V1?: boolean;
    topBarStatisticsOfMeEnabled?: boolean;
    topBarStatisticsOfOpponentEnabled?: boolean;
    username?: string;
}

export interface MatchVisionSettings {
    player?: MatchVisionOverlaySettings;
    observer?: MatchVisionOverlaySettings;
}
