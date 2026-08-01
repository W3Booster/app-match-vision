import type { Hero, MatchState, OverlayRuntimeState, Player } from '@w3booster/sdk';
import { battleTagName } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings, MatchVisionSettings } from './match-vision-settings';

const DEFAULT_SETTINGS: Readonly<MatchVisionOverlaySettings> = {
    mapBarEnabled: true,
    mapNameEnabled: true,
    topBarEnabled: true,
    topBarGameDurationEnabled: true,
    topBarStatisticsOfMeEnabled: true,
    topBarStatisticsOfOpponentEnabled: true,
    topBarPlayerColorsEnabled: true,
    topBarPlayerColorsEnabledIn1V1: true,
    matchscoreEnabled: true,
    controlgroupsEnabled: true,
    heroAbilitiesEnabled: true,
    heroExpProgressEnabled: true,
    heroItemsEnabled: true,
    heroLevelEnabled: true,
    researchesEnabled: true,
    researchesOfAttackAndArmorEnabled: true
};

export function matchVisionSettings(state: MatchState<MatchVisionSettings>): MatchVisionOverlaySettings {
    const profile = state.match.isObserver || state.match.isReplay ? state.application?.settings.observer : state.application?.settings.player;
    return { ...DEFAULT_SETTINGS, ...profile };
}

export function overlayRuntime(state: MatchState<MatchVisionSettings>): OverlayRuntimeState {
    return state.overlay?.misc ?? {};
}

/** Derives display-only player values without changing the SDK state. */
export function matchVisionPlayers(state: MatchState<MatchVisionSettings>, settings: MatchVisionOverlaySettings): Player[] {
    const players = state.players.map(player => ({
        ...player,
        name: battleTagName(player.name),
        mainAccount: player.mainAccount ? { ...player.mainAccount } : undefined
    }));
    const broadcasterId = state.match.broadcasterPlayerId ?? players[0]?.id;

    if (standardGame.isMode(state.match.mode, '4ffa') && state.match.realm === 'W3Champions') {
        for (const player of players) {
            if (player.id === broadcasterId) continue;
            player.name = `Player ${Number(player.team ?? 0) + 1}`;
            player.race = 'random';
            delete player.mainAccount;
        }
    }

    if (players.length === 2 && !state.match.isObserver && !state.match.isReplay) {
        const broadcaster = players.find(player => player.id === broadcasterId);
        if (broadcaster) {
            broadcaster.mainAccount = {
                ...broadcaster.mainAccount,
                name: settings.username || broadcaster.mainAccount?.name || broadcaster.name || broadcaster.id,
                country: settings.nationality
            };
        }
    }

    return players;
}

/** Match Vision deliberately shows the progress within the current hero level. */
export function heroDisplayLevel(hero: Hero): string {
    if (typeof hero.experience !== 'number') return String(hero.level);
    const experience = standardGame.heroExperienceState(hero.experience);
    const displayLevel = experience.level + (experience.level >= 10 ? 0 : experience.progress);
    const digits = experience.level >= 10 ? 0 : 1;
    const factor = 10 ** digits;
    return (Math.trunc(displayLevel * factor) / factor).toFixed(digits);
}
