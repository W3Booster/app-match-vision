import type { Building, Hero, Player } from '@w3booster/sdk';
import { playerBuildings as sdkBuildings, playerHeroes as sdkHeroes } from '@w3booster/sdk/selectors';
import { createMemoizedSelector } from '@w3booster/sdk/store';

// Explicit Match Vision policy, including when running with an older SDK whose
// selectors still return every instance. The raw SDK collections stay intact.
function isReal(unit: object): boolean {
    return !('isIllusion' in unit && unit.isIllusion === true);
}
function compareIds(a: { readonly id: string }, b: { readonly id: string }): number {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function heroOrder(hero: Hero & { readonly heroOrder?: number }): number {
    const value = hero.heroOrder;
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 0x7fffffff
        ? value : Number.MAX_SAFE_INTEGER;
}
function compareHeroes(a: Hero, b: Hero): number {
    return heroOrder(a) - heroOrder(b) || compareIds(a, b);
}
function orderedRealUnits<T extends { readonly id: string }>(units: readonly T[], compare: (a: T, b: T) => number = compareIds): readonly T[] {
    if (units.every((unit, index) => isReal(unit) && (index === 0 || compare(units[index - 1]!, unit) <= 0))) {
        return units;
    }
    // Apply the same default with published SDKs that still preserve map order.
    // Full-string comparison preserves 64-bit identity precision; it is not spawn order.
    return Object.freeze(units.filter(isReal).sort(compare));
}
const visibleHeroes = createMemoizedSelector((heroes: readonly Hero[]) => orderedRealUnits(heroes, compareHeroes));
const visibleBuildings = createMemoizedSelector((buildings: readonly Building[]) => orderedRealUnits(buildings));

export function playerHeroes(player: Pick<Player, 'heroes'> | null | undefined): readonly Hero[] {
    return visibleHeroes(sdkHeroes(player));
}
export function playerBuildings(player: Pick<Player, 'buildings'> | null | undefined): readonly Building[] {
    return visibleBuildings(sdkBuildings(player));
}
