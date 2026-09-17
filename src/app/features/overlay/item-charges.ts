import type { Hero } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';

export interface ItemCharges {
    readonly remaining: number;
    /** Null selects a numeric badge when the count cannot fit the catalog capacity. */
    readonly dots: readonly boolean[] | null;
}

/** Older recorders/catalogs omit charges; never display a guessed remaining count. */
export function itemCharges(hero: Hero, slot: number, data: GameData | null): ItemCharges | null {
    const typeId = hero.inventory?.[slot];
    const item = typeId ? data?.items.get(typeId) : undefined;
    if (!item || !('initialCharges' in item) || typeof item.initialCharges !== 'number' ||
        !Number.isInteger(item.initialCharges) || item.initialCharges <= 1 || item.initialCharges > 0x7fffffff) return null;
    if (!('inventoryCharges' in hero) || !Array.isArray(hero.inventoryCharges)) return null;
    const count: unknown = hero.inventoryCharges[slot];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 0x7fffffff) return null;
    return {
        remaining: count,
        // Two rows of five fit the inventory artwork. Larger custom capacities use a number.
        dots: count <= item.initialCharges && item.initialCharges <= 10
            ? Array.from({ length: item.initialCharges }, (_, index) => index < count)
            : null
    };
}
