import type { Player } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';
import { playerUnits } from '@w3booster/sdk/selectors';

export interface ArmyGroup {
    readonly typeId: string;
    readonly count: number;
    readonly goldCost: number | null;
}

/** The ordinary-unit collection includes workers and summons; heroes/buildings have separate panels. */
export function armyComposition(player: Pick<Player, 'units'>, data: GameData | null | undefined): readonly ArmyGroup[] {
    const counts = new Map<string, number>();
    for (const unit of playerUnits(player)) {
        if (unit.isIllusion || (unit.hitpoints && unit.hitpoints.current <= 0)) continue;
        counts.set(unit.typeId, (counts.get(unit.typeId) ?? 0) + 1);
    }
    return [...counts].map(([typeId, count]) => {
        const gold = data?.units.get(typeId)?.cost.gold;
        return { typeId, count, goldCost: gold != null && Number.isFinite(gold) && gold >= 0 ? gold : null };
    }).sort((a, b) => (a.goldCost ?? Infinity) - (b.goldCost ?? Infinity) || a.typeId.localeCompare(b.typeId));
}
