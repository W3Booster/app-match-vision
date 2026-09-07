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
    const overridesBroadcaster = !isObserverOrReplayMatch(match);
    return Object.freeze(sourcePlayers.map(player => {
        let displayIdentity = playerDisplayIdentity(player, { stripBattleTagDiscriminator: true });
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

/** Orders dashboard teams exactly like the overlay without mutating SDK state. */
export function matchVisionTeams(
    state: MatchState<MatchVisionSettings>,
    reversePlayerOrder = false
): readonly PlayerTeam<Player>[] {
    return orderedMatchVisionTeams(state.players, state.match, reversePlayerOrder);
}

type PresentationMatch = Pick<Match, 'mode' | 'broadcasterPlayerId' | 'isObserver' | 'isReplay'>;

/** Replay selection must align with Warcraft's native hero panel, ahead of manual reversal. */
export function matchVisionHeadToHeadPlayers<TPlayer extends Player>(
    players: readonly [TPlayer, TPlayer],
    match: PresentationMatch,
    reversePlayerOrder = false
): readonly [TPlayer, TPlayer] {
    const selected = match.isReplay ? broadcasterPlayer(match, players) : null;
    if (selected) {
        return Object.freeze(selected.id === players[0].id ? [...players] : [players[1], players[0]]);
    }
    return standardGame.orderHeadToHeadPlayers(players, { reverse: reversePlayerOrder });
}

/** Share replay selection priority across dashboard and overlay team layouts. */
export function orderedMatchVisionTeams<TPlayer extends Player>(
    players: readonly TPlayer[],
    match: PresentationMatch,
    reversePlayerOrder = false
): readonly PlayerTeam<TPlayer>[] {
    const selected = match.isReplay ? broadcasterPlayer(match, players) : null;
    const teams = standardGame.orderMatchTeams(players, match, { reverse: selected ? false : reversePlayerOrder });
    if (!selected) return teams;
    const selectedTeam = teams.find(team => team.players.some(player => player.id === selected.id));
    if (!selectedTeam) return teams;
    return Object.freeze([
        Object.freeze({
            ...selectedTeam,
            players: Object.freeze([selected, ...selectedTeam.players.filter(player => player.id !== selected.id)])
        }),
        ...teams.filter(team => team !== selectedTeam)
    ]);
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
