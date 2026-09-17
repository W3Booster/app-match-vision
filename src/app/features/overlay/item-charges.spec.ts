import { describe, expect, it } from 'vitest';
import type { Hero } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';
import { itemCharges } from './item-charges';
const data = { items: { get: (id: string) => ({ initialCharges: ({ hslv: 3, phea: 1, bspd: 0 } as Record<string, number>)[id] }) } } as unknown as GameData;
const hero = (counts: unknown = [3, 1, null, 1, 0, null]): Hero => ({
    id: '0000000000000001', typeId: 'Hamg', isIllusion: false,
    inventory: ['hslv', 'hslv', '', 'phea', 'bspd', 'hslv'], ...{ inventoryCharges: counts }
});
describe('inventory charge indicators', () => {
    it('shows remaining counts only for items initially containing multiple charges', () => {
        expect(Array.from({length: 6}, (_, slot) => itemCharges(hero(), slot, data))).toEqual([{ remaining: 3, dots: [true, true, true] }, { remaining: 1, dots: [true, false, false] }, null, null, null, null]);
        expect(itemCharges(hero([0, 1, null, 1, 0, null]), 0, data)).toEqual({ remaining: 0, dots: [false, false, false] });
    });
    it('falls back to a number for counts above the default and capacities too large for dots', () => {
        expect(itemCharges(hero([7]), 0, data)).toEqual({ remaining: 7, dots: null });
        const catalog = (initialCharges: number) => ({ items: { get: () => ({ initialCharges }) } }) as unknown as GameData;
        expect(itemCharges(hero([6]), 0, catalog(10))).toEqual({ remaining: 6, dots: [true, true, true, true, true, true, false, false, false, false] });
        expect(itemCharges(hero([6]), 0, catalog(100))).toEqual({ remaining: 6, dots: null });
        for (const value of [NaN, Infinity, 1.5, -1, 0x80000000]) expect(itemCharges(hero(), 0, catalog(value))).toBeNull();
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
