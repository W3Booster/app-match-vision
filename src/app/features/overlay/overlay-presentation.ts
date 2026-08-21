import type { DeepReadonly, MatchState, OverlayRuntimeState } from '@w3booster/sdk';
import type { AbilityCooldownState } from '@w3booster/sdk/standard-game/cooldowns';
import * as standardGame from '@w3booster/sdk/standard-game';
import * as standardGameCooldowns from '@w3booster/sdk/standard-game/cooldowns';
import { broadcasterPlayer, headToHeadPair, isObserverOrReplayMatch, overlayRuntime } from '@w3booster/sdk/selectors';
import { matchVisionPlayers, matchVisionSettings, reversePlayerOrderForMatch } from '../../domain';
import type { MatchVisionOverlaySettings, MatchVisionPlayerView, MatchVisionSettings } from '../../domain';
import type { W3BoosterAppSettings } from '../../core/w3booster-app.generated';

export interface OverlayPresentation {
    settings: MatchVisionOverlaySettings;
    runtime: OverlayRuntimeState;
    players: readonly MatchVisionPlayerView[];
    observerPlayers: readonly [MatchVisionPlayerView, MatchVisionPlayerView] | null;
    streamer: MatchVisionPlayerView | null;
    opponent: MatchVisionPlayerView | null;
    additionalCssClasses: string;
    showsObserverBar: boolean;
    showsTeamObserverBar: boolean;
    requiredAvatarCovers: number;
    teamAvatarCovers: number;
    abilityCooldowns: ReadonlyMap<import('@w3booster/sdk').HeroAbility, AbilityCooldownState>;
}

export function createOverlayPresentation(
    state: MatchState<MatchVisionSettings>,
    resolvedSettings: DeepReadonly<W3BoosterAppSettings>
): OverlayPresentation {
    const settings = matchVisionSettings(state.match, resolvedSettings);
    const runtime = overlayRuntime(state);
    const players = matchVisionPlayers(state, settings);
    const observerPlayers = headToHeadPair(players);
    const observerOrReplay = isObserverOrReplayMatch(state.match);
    const showsObserverBar = observerOrReplay && standardGame.isMode(state.match.mode, '1v1') && observerPlayers !== null;
    const showsTeamObserverBar = observerOrReplay && standardGame.modeInfo(state.match.mode)?.kind === 'team';
    const broadcasterId = broadcasterPlayer(state.match, players)?.id;
    let streamer = players.find(player => player.id === broadcasterId) ?? null;
    const streamerId = streamer?.id;
    let opponent = players.length === 2 && streamerId !== undefined
        ? players.find(player => player.id !== streamerId) ?? null
        : null;

    if (showsObserverBar && streamer && opponent) {
        [streamer, opponent] = standardGame.orderHeadToHeadPlayers(
            [streamer, opponent] as const,
            { reverse: reversePlayerOrderForMatch(state.match, settings) }
        );
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
        observerPlayers,
        streamer,
        opponent,
        additionalCssClasses: Object.values(settings.additionalCSSClasses ?? {}).filter(Boolean).join(' '),
        showsObserverBar,
        showsTeamObserverBar,
        requiredAvatarCovers,
        teamAvatarCovers,
        abilityCooldowns: standardGameCooldowns.abilityCooldownsForState(state)
    };
}
