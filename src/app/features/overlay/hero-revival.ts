import type { Hero, Player, TimedProgress } from '@w3booster/sdk';
import { playerBuildings, playerHeroes } from '../../domain/unit-selectors';

/** Queue entries carry a type, not a hero instance: only associate unambiguous dead heroes. */
export function heroRevival(hero: Hero, player: Player | null): TimedProgress | null {
    if (!player || !hero.hitpoints || hero.hitpoints.current !== 0 || hero.isIllusion) return null;
    const candidates = playerHeroes(player).filter(candidate => candidate.typeId === hero.typeId);
    if (candidates.length !== 1 || candidates[0]!.id !== hero.id) return null;
    const queues = playerBuildings(player).flatMap(building => {
        const slot = building.production?.queue[0];
        return slot?.position === 0 && slot.buildType === 'reviving' && slot.typeId === hero.typeId
            ? [slot] : [];
    });
    if (queues.length !== 1) return null;
    const slot = queues[0]!;
    return slot.progress === 1 || slot.remainingSeconds === 0 ? null : slot;
}
