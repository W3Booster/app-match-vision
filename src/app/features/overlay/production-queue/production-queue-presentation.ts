import type { Building, Match } from '@w3booster/sdk';
import { isObserverOrReplayMatch, playerBuildings } from '@w3booster/sdk/selectors';
import { createMemoizedSelector } from '@w3booster/sdk/store';
import type { MatchVisionPlayerView } from '../../../domain';
import { orderedOverlayTeams } from '../overlay-visuals';

/** Reuse SDK entity references; queue positions are slots, never unit identities. */
export const productionPlayers = createMemoizedSelector((
    players: readonly MatchVisionPlayerView[],
    match: Match,
    reversePlayerOrder: boolean
): readonly { player: MatchVisionPlayerView; buildings: readonly Building[]; side: 'left' | 'right' }[] => {
    const visible = isObserverOrReplayMatch(match)
        ? players
        : players.filter(player => player.id === match.broadcasterPlayerId);
    // Assign sides before filtering empty queues so an idle left player never moves the right player.
    return orderedOverlayTeams(visible, match, reversePlayerOrder).flatMap((team, index) => team.map(player => ({
        player,
        side: index % 2 === 0 ? 'left' as const : 'right' as const,
        buildings: playerBuildings(player).filter(building => (building.production?.queue.length ?? 0) > 0)
    }))).filter(group => group.buildings.length > 0);
});

export function progressLabel(progress: number | null): string {
    return progress === null ? 'Progress unknown' : `${Math.floor(progress * 100)}%`;
}
