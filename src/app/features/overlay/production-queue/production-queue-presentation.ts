import { playerBuildings } from '../../../domain/unit-selectors';
import type { Building, Match, TimedProgress } from '@w3booster/sdk';
import { isObserverOrReplayMatch } from '@w3booster/sdk/selectors';
import { createMemoizedSelector } from '@w3booster/sdk/store';
import type { MatchVisionPlayerView } from '../../../domain';
import { orderedOverlayTeams } from '../overlay-visuals';

/** Reuse SDK entity references; queue positions are slots, never unit identities. */
export const productionPlayers = createMemoizedSelector((
    players: readonly MatchVisionPlayerView[],
    match: Match,
    reversePlayerOrder: boolean,
    queuesEnabled = true,
    constructionEnabled = true
): readonly { player: MatchVisionPlayerView; buildings: readonly Building[]; constructions: readonly Building[]; side: 'left' | 'right' }[] => {
    const visible = isObserverOrReplayMatch(match)
        ? players
        : players.filter(player => player.id === match.broadcasterPlayerId);
    // Assign sides before filtering empty queues so an idle left player never moves the right player.
    return orderedOverlayTeams(visible, match, reversePlayerOrder).flatMap((team, index) => team.map(player => {
        const buildings = playerBuildings(player);
        return {
            player,
            side: index % 2 === 0 ? 'left' as const : 'right' as const,
            buildings: queuesEnabled ? buildings.filter(building => (building.production?.queue.length ?? 0) > 0) : [],
            constructions: constructionEnabled ? buildings.filter(building => building.construction !== undefined &&
                (building.construction.progress === null || building.construction.progress < 1)) : []
        };
    })).filter(group => group.buildings.length > 0 || group.constructions.length > 0);
});

export function progressLabel(progress: number | null): string {
    return progress === null ? 'Progress unknown' : `${Math.floor(progress * 100)}%`;
}

/** Round up like ability cooldowns; waiting or unreadable timers remain unknown. */
export function remainingSecondsLabel(value: number | null | undefined): string {
    return value == null ? '?' : String(Math.max(0, Math.ceil(value)));
}

/** The native reader reports zero progress and null timers before production starts. */
export function isProgressWaiting(slot: TimedProgress): boolean {
    return slot.progress === 0 && slot.remainingSeconds === null && slot.totalSeconds === null;
}
