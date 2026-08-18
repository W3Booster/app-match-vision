import type { MatchState, OverlayRuntimeState, Player } from '@w3booster/sdk';
import type { AbilityCooldownState } from '@w3booster/sdk/standard-game/objects';
import * as standardGame from '@w3booster/sdk/standard-game';
import * as standardGameObjects from '@w3booster/sdk/standard-game/objects';
import { broadcasterPlayer, isObserverOrReplayMatch, overlayRuntime } from '@w3booster/sdk/selectors';
import { matchVisionPlayers, matchVisionSettings, reversePlayerOrderForMatch } from '../../domain';
import type { MatchVisionOverlaySettings, MatchVisionSettings } from '../../domain';

export interface OverlayPresentation {
    settings: MatchVisionOverlaySettings;
    runtime: OverlayRuntimeState;
    players: readonly Player[];
    streamer: Player | null;
    opponent: Player | null;
    additionalCssClasses: string;
    showsObserverBar: boolean;
    showsTeamObserverBar: boolean;
    requiredAvatarCovers: number;
    teamAvatarCovers: number;
    abilityCooldowns: ReadonlyMap<import('@w3booster/sdk').HeroAbility, AbilityCooldownState>;
}

export function createOverlayPresentation(state: MatchState<MatchVisionSettings>): OverlayPresentation {
    const settings = matchVisionSettings(state);
    const runtime = overlayRuntime(state);
    const players = matchVisionPlayers(state, settings);
    const observerOrReplay = isObserverOrReplayMatch(state.match);
    const showsObserverBar = observerOrReplay && standardGame.isMode(state.match.mode, '1v1');
    const showsTeamObserverBar = observerOrReplay && standardGame.modeInfo(state.match.mode)?.kind === 'team';
    const broadcasterId = broadcasterPlayer(state.match, players, { fallbackToFirst: true })?.id;
    let streamer = players.find(player => player.id === broadcasterId) ?? null;
    let opponent = players.length === 2 ? players.find(player => player.id !== streamer?.id) ?? null : null;

    if (showsObserverBar && streamer && opponent) {
        [streamer, opponent] = standardGame.orderHeadToHeadPlayers(
            [streamer, opponent],
            { reverse: reversePlayerOrderForMatch(state.match, settings) }
        ) as [Player, Player];
    }

    const broadcaster = players.find(player => player.id === broadcasterId);
    const requiredAvatarCovers = state.match.isReplay && !state.match.isObserver && broadcaster && streamer
        ? Math.max(0, (broadcaster.heroes?.length ?? 0) - (streamer.heroes?.length ?? 0))
        : 0;
    const teamAvatarCovers = state.match.isReplay && !state.match.isObserver
        ? Math.min(3, broadcaster?.heroes?.length ?? 0)
        : 0;

    return {
        settings,
        runtime,
        players,
        streamer,
        opponent,
        additionalCssClasses: Object.values(settings.additionalCSSClasses ?? {}).filter(Boolean).join(' '),
        showsObserverBar,
        showsTeamObserverBar,
        requiredAvatarCovers,
        teamAvatarCovers,
        abilityCooldowns: standardGameObjects.abilityCooldownsForState(state)
    };
}
