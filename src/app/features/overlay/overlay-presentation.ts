import type { MatchState, OverlayRuntimeState, Player } from '@w3booster/sdk';
import type { AbilityCooldownState } from '@w3booster/sdk/standard-game';
import * as standardGame from '@w3booster/sdk/standard-game';
import { matchVisionPlayers, matchVisionSettings, overlayRuntime } from '../../domain';
import type { MatchVisionOverlaySettings, MatchVisionSettings } from '../../domain';

export interface OverlayPresentation {
    settings: MatchVisionOverlaySettings;
    runtime: OverlayRuntimeState;
    players: Player[];
    streamer: Player | null;
    opponent: Player | null;
    additionalCssClasses: string;
    showsObserverBar: boolean;
    showsTeamObserverBar: boolean;
    requiredAvatarCovers: number;
    teamAvatarCovers: number;
    abilityCooldowns: ReadonlyMap<string, AbilityCooldownState>;
}

export function createOverlayPresentation(state: MatchState<MatchVisionSettings>): OverlayPresentation {
    const settings = matchVisionSettings(state);
    const runtime = overlayRuntime(state);
    const players = matchVisionPlayers(state, settings);
    const observerOrReplay = state.match.isObserver === true || state.match.isReplay === true;
    const showsObserverBar = observerOrReplay && standardGame.isMode(state.match.mode, '1v1');
    const showsTeamObserverBar = observerOrReplay && ['2v2', '3v3', '4v4'].some(mode => standardGame.isMode(state.match.mode, mode));
    const broadcasterId = state.match.broadcasterPlayerId ?? players[0]?.id;
    let streamer = players.find(player => player.id === broadcasterId) ?? null;
    let opponent = players.length === 2 ? players.find(player => player.id !== streamer?.id) ?? null : null;

    if (showsObserverBar && streamer && opponent) {
        if ((opponent.startPosition?.x ?? 0) < (streamer.startPosition?.x ?? 0)) {
            [streamer, opponent] = [opponent, streamer];
        }
        if (settings.reversePlayerOrder) [streamer, opponent] = [opponent, streamer];
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
        abilityCooldowns: calculateAbilityCooldowns(state)
    };
}

function calculateAbilityCooldowns(state: MatchState<MatchVisionSettings>): ReadonlyMap<string, AbilityCooldownState> {
    const cooldowns = new Map<string, AbilityCooldownState>();
    if (!state.match.gameTime || state.match.status === 'none' || state.match.status === 'finished') return cooldowns;

    for (const player of state.players) {
        for (const hero of player.heroes ?? []) {
            for (const ability of hero.abilities ?? []) {
                if (!ability.lastActivation || ability.lastActivation <= 0) continue;
                const cooldown = standardGame.abilityCooldown(ability, state.match.gameTime);
                if (cooldown) cooldowns.set(ability.id, cooldown);
            }
        }
    }
    return cooldowns;
}
