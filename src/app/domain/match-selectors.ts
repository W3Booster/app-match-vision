import type { MatchState, Player } from '@w3booster/sdk';
import { battleTagName, broadcasterPlayer, isObserverOrReplayMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { w3boosterApp } from '../core/w3booster-app.generated';
import type { MatchVisionOverlaySettings, MatchVisionSettings } from './match-vision-settings';

const overlaySettingsCache = new WeakMap<object, {
    player: MatchVisionOverlaySettings;
    observer: MatchVisionOverlaySettings;
}>();
const displayPlayersCache = new WeakMap<readonly Player[], Map<string, readonly Player[]>>();

export function matchVisionSettings(state: MatchState<MatchVisionSettings>): MatchVisionOverlaySettings {
    const settings = w3boosterApp.settingsFor(state);
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
): Array<{ id: number | null; players: Player[] }> {
    return standardGame.orderMatchTeams(state.players, state.match, { reverse: reversePlayerOrder })
        .map(team => ({ id: team.teamId, players: [...team.players] }));
}

/** Derives display-only player values without changing the SDK state. */
export function matchVisionPlayers(
    state: MatchState<MatchVisionSettings>,
    settings: MatchVisionOverlaySettings
): readonly Player[] {
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

    const immutablePlayers = Object.freeze(players.map(player => Object.freeze({
        ...player,
        ...(player.mainAccount ? { mainAccount: Object.freeze({ ...player.mainAccount }) } : {})
    })));
    variants.set(context, immutablePlayers);
    return immutablePlayers;
}
