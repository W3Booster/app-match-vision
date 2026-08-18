import type { Hero, MatchState, OverlayRuntimeState, Player } from '@w3booster/sdk';
import { battleTagName, broadcasterPlayer, groupPlayersByTeam, isObserverOrReplayMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { resolveW3BoosterAppSettings } from '../core/w3booster-app.generated';
import type { MatchVisionOverlaySettings, MatchVisionSettings } from './match-vision-settings';

const overlaySettingsCache = new WeakMap<object, {
    player: MatchVisionOverlaySettings;
    observer: MatchVisionOverlaySettings;
}>();
const displayPlayersCache = new WeakMap<readonly Player[], Map<string, Player[]>>();

export function matchVisionSettings(state: MatchState<MatchVisionSettings>): MatchVisionOverlaySettings {
    const settings = resolveW3BoosterAppSettings(state.application?.settings);
    let profiles = overlaySettingsCache.get(settings);
    if (!profiles) {
        profiles = {
            player: Object.freeze({ ...settings.observer, ...settings.player }),
            observer: Object.freeze({ ...settings.player, ...settings.observer })
        };
        overlaySettingsCache.set(settings, profiles);
    }
    return isObserverOrReplayMatch(state.match) ? profiles.observer : profiles.player;
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
    reversePlayerOrder = reversePlayerOrderForMatch(state.match, matchVisionSettings(state))
): Array<{ id: number; players: Player[] }> {
    const teams = groupedMatchVisionTeams(state.players);
    if (!isObserverOrReplayMatch(state.match) || teams.length !== 2) return teams;

    const playerCount = teams.reduce((count, team) => count + team.players.length, 0);
    if (playerCount === 2) {
        const orderedPlayers = standardGame.orderHeadToHeadPlayers(
            teams.map(team => team.players[0]!),
            { reverse: reversePlayerOrder }
        );
        return orderedPlayers.map(player => teams.find(team => team.players[0]?.id === player.id)!);
    }
    return broadcasterFirstTeams(state.players, state.match, reversePlayerOrder);
}

/** Stable application-owned team order shared by dashboard and overlay surfaces. */
export function broadcasterFirstTeams(
    players: readonly Player[],
    match: Pick<MatchState['match'], 'broadcasterPlayerId'>,
    reverse = false
): Array<{ id: number; players: Player[] }> {
    const teams = groupedMatchVisionTeams(players);
    const broadcaster = broadcasterPlayer(match, players);
    if (broadcaster) {
        teams.sort((left, right) =>
            Number(right.id === broadcaster.team) - Number(left.id === broadcaster.team));
    }
    if (reverse) teams.reverse();
    return teams;
}

function groupedMatchVisionTeams(players: readonly Player[]): Array<{ id: number; players: Player[] }> {
    return groupPlayersByTeam(players)
        .map(team => ({ id: team.teamId ?? 0, players: [...team.players] }));
}

export function overlayRuntime(state: MatchState<MatchVisionSettings>): OverlayRuntimeState {
    return state.overlay?.misc ?? {};
}

/** Derives display-only player values without changing the SDK state. */
export function matchVisionPlayers(state: MatchState<MatchVisionSettings>, settings: MatchVisionOverlaySettings): Player[] {
    const context = JSON.stringify([
        state.match.mode,
        state.match.realm,
        state.match.broadcasterPlayerId,
        state.match.isObserver === true,
        state.match.isReplay === true,
        settings.username,
        settings.nationality
    ]);
    let variants = displayPlayersCache.get(state.players);
    if (!variants) {
        variants = new Map();
        displayPlayersCache.set(state.players, variants);
    }
    const cached = variants.get(context);
    if (cached) return cached;

    const players = state.players.map(player => ({
        ...player,
        name: battleTagName(player.name),
        mainAccount: player.mainAccount ? { ...player.mainAccount } : undefined
    }));
    const broadcasterId = broadcasterPlayer(state.match, players, { fallbackToFirst: true })?.id;

    if (standardGame.isMode(state.match.mode, '4ffa') && state.match.realm === 'W3Champions') {
        for (const player of players) {
            if (player.id === broadcasterId) continue;
            player.name = `Player ${Number(player.team ?? 0) + 1}`;
            player.race = 'random';
            delete player.mainAccount;
        }
    }

    if (players.length === 2 && !isObserverOrReplayMatch(state.match)) {
        const broadcaster = players.find(player => player.id === broadcasterId);
        if (broadcaster) {
            broadcaster.mainAccount = {
                ...broadcaster.mainAccount,
                name: settings.username || broadcaster.mainAccount?.name || broadcaster.name || broadcaster.id,
                country: settings.nationality
            };
        }
    }

    variants.set(context, players);
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
