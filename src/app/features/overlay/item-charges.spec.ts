import { describe, expect, it } from 'vitest';
import type { Hero } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';
import { itemCharges } from './item-charges';
const data = { items: { get: (id: string) => ({ initialCharges: ({ hslv: 3, phea: 1, bspd: 0 } as Record<string, number>)[id] }) } } as unknown as GameData;
const hero = (counts: unknown = [3, 1, null, 1, 0, null]): Hero => ({
    id: '0000000000000001', typeId: 'Hamg', isIllusion: false,
    inventory: ['hslv', 'hslv', '', 'phea', 'bspd', 'hslv'], ...{ inventoryCharges: counts }
});
describe('inventory charge badges', () => {
    it('shows remaining counts only for items initially containing multiple charges', () => {
        expect(Array.from({length: 6}, (_, slot) => itemCharges(hero(), slot, data))).toEqual([3, 1, null, null, null, null]);
        expect(itemCharges(hero([0, 1, null, 1, 0, null]), 0, data)).toBe(0);
    });
    it('follows slot moves and never substitutes initial charges for missing observations', () => {
        expect(itemCharges({ ...hero(), inventory: ['', 'hslv'] }, 0, data)).toBeNull();
        expect(itemCharges(hero(), 5, data)).toBeNull();
        expect(itemCharges(hero(undefined), 0, null)).toBeNull();
        const old = { id: 'old', typeId: 'Hamg', inventory: ['hslv'] } as Hero;
        expect(itemCharges(old, 0, data)).toBeNull();
        for (const count of [-1, 1.5, Infinity, NaN, '3', undefined]) expect(itemCharges(hero([count]), 0, data)).toBeNull();
    });
});
