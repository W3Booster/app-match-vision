import type { Hero } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';

/** Older recorders/catalogs omit charges; never display a guessed remaining count. */
export function itemCharges(hero: Hero, slot: number, data: GameData | null): number | null {
    const typeId = hero.inventory?.[slot];
    const item = typeId ? data?.items.get(typeId) : undefined;
    if (!item || !('initialCharges' in item) || typeof item.initialCharges !== 'number' ||
        !Number.isInteger(item.initialCharges) || item.initialCharges <= 1) return null;
    if (!('inventoryCharges' in hero) || !Array.isArray(hero.inventoryCharges)) return null;
    const count: unknown = hero.inventoryCharges[slot];
    return typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 0x7fffffff ? count : null;
}
