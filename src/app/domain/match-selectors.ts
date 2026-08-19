import type { DeepReadonly, Match, MatchState, Player } from '@w3booster/sdk';
import { broadcasterPlayer, isObserverOrReplayMatch, playerDisplayIdentity } from '@w3booster/sdk/selectors';
import type { PlayerDisplayIdentity } from '@w3booster/sdk/selectors';
import type { PlayerTeam } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { createMemoizedSelector } from '@w3booster/sdk/store';
import type { W3BoosterAppSettings } from '../core/w3booster-app.generated';
import type { MatchVisionOverlaySettings, MatchVisionSettings } from './match-vision-settings';

const overlaySettingsCache = new WeakMap<object, {
    player: MatchVisionOverlaySettings;
    observer: MatchVisionOverlaySettings;
}>();

/**
 * Match Vision's display-name policy, kept compatible with the minimum SDK.
 * SDK 1 only stripped the in-game discriminator, so normalize both names here.
 */
export function matchVisionPlayerDisplayIdentity(player: Player): PlayerDisplayIdentity {
    const identity = playerDisplayIdentity(player, { stripBattleTagDiscriminator: true });
    const inGameName = stripBattleTagDiscriminator(identity.inGameName);
    const accountName = identity.accountName === undefined
        ? undefined
        : stripBattleTagDiscriminator(identity.accountName);
    const primaryName = accountName || inGameName;
    return Object.freeze({
        ...identity,
        primaryName,
        inGameName,
        accountName,
        hasAlias: Boolean(accountName && accountName !== inGameName)
    });
}

function stripBattleTagDiscriminator(name: string): string {
    return name.replace(/#\d+$/, '') || name;
}
export interface MatchVisionPlayerView extends Player {
    readonly displayIdentity: PlayerDisplayIdentity;
    readonly displayCountry?: string;
}
const selectDisplayPlayers = createMemoizedSelector((
    sourcePlayers: readonly Player[],
    mode: string,
    realm: string | undefined,
    broadcasterPlayerId: string | undefined,
    isObserver: boolean,
    isReplay: boolean,
    username: string,
    nationality: string
): readonly MatchVisionPlayerView[] => {
    const match = { mode, realm, broadcasterPlayerId, isObserver, isReplay };
    const broadcasterId = broadcasterPlayer(match, sourcePlayers)?.id;
    const overridesBroadcaster = sourcePlayers.length === 2 && !isObserverOrReplayMatch(match);
    return Object.freeze(sourcePlayers.map(player => {
        let displayIdentity = matchVisionPlayerDisplayIdentity(player);
        const overridden = overridesBroadcaster && player.id === broadcasterId;
        if (overridden) {
            const primaryName = username || displayIdentity.accountName || displayIdentity.inGameName || player.id;
            displayIdentity = Object.freeze({
                ...displayIdentity,
                primaryName,
                accountName: primaryName,
                hasAlias: primaryName !== displayIdentity.inGameName
            });
        }
        return Object.freeze({
            ...player,
            displayIdentity,
            displayCountry: overridden ? nationality : player.mainAccount?.country
        });
    }));
});

export function matchVisionSettings(
    match: Match,
    settings: DeepReadonly<W3BoosterAppSettings>
): MatchVisionOverlaySettings {
    let profiles = overlaySettingsCache.get(settings);
    if (!profiles) {
        profiles = {
            player: Object.freeze({ ...settings.observer, ...settings.player }),
            observer: Object.freeze({ ...settings.player, ...settings.observer })
        };
        overlaySettingsCache.set(settings, profiles);
    }
    return isObserverOrReplayMatch(match) ? profiles.observer : profiles.player;
}

/** A reverse choice belongs to one match and must never leak into the next one. */
export function reversePlayerOrderForMatch(
    match: MatchState['match'],
    settings: MatchVisionOverlaySettings
): boolean {
    const matchId = match.id.trim();
    return matchId.length > 0 && settings.reversePlayerOrderMatchId === matchId;
}

/** Orders dashboard teams exactly like the observer overlay without mutating SDK state. */
export function matchVisionTeams(
    state: MatchState<MatchVisionSettings>,
    reversePlayerOrder = false
): readonly PlayerTeam<Player>[] {
    return standardGame.orderMatchTeams(state.players, state.match, { reverse: reversePlayerOrder });
}

/** Derives display-only player values without changing the SDK state. */
export function matchVisionPlayers(
    state: MatchState<MatchVisionSettings>,
    settings: MatchVisionOverlaySettings
): readonly MatchVisionPlayerView[] {
    return selectDisplayPlayers(
        state.players,
        state.match.mode,
        state.match.realm,
        state.match.broadcasterPlayerId,
        state.match.isObserver === true,
        state.match.isReplay === true,
        settings.username,
        settings.nationality
    );
}
