import { describe, expect, it } from 'vitest';
import type { Unit } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';
import { armyComposition } from './army-composition';

const costs: Record<string, number> = { cheap: 75, expensive: 250, free: 0, tied: 75 };
const data = { units: { get: (id: string) => id in costs ? { cost: { gold: costs[id] } } : undefined } } as unknown as GameData;
const unit = (id: string, typeId: string, extra: Partial<Unit> = {}): Unit => ({ id, typeId, isIllusion: false, ...extra });

describe('army composition', () => {
    it('counts instances and sorts ascending by individual cost, not the total group cost', () => {
        const units = Object.fromEntries([
            unit('1', 'expensive'), ...Array.from({ length: 12 }, (_, i) => unit('cheap-' + i, 'cheap'))
        ].map(value => [value.id, Object.freeze(value)]));
        Object.freeze(units);
        expect(armyComposition({ units }, data)).toEqual([
            { typeId: 'cheap', count: 12, goldCost: 75 }, { typeId: 'expensive', count: 1, goldCost: 250 }
        ]);
    });
    it('excludes illusions and observed dead units, retaining units with unobserved health', () => {
        const units = { a: unit('a', 'cheap'), b: unit('b', 'cheap', { isIllusion: true }), c: unit('c', 'cheap', { hitpoints: { current: 0, max: 100 } }) };
        expect(armyComposition({ units }, data)).toEqual([{ typeId: 'cheap', count: 1, goldCost: 75 }]);
        expect(armyComposition({ units: {} }, data)).toEqual([]);
        expect(armyComposition({}, data)).toEqual([]);
    });
    it('keeps zero cost first, unknown cost last, and ties deterministic across snapshot order', () => {
        const values = ['unknown', 'tied', 'cheap', 'free'].map(id => unit(id, id));
        const groups = armyComposition({ units: Object.fromEntries(values.map(u => [u.id, u])) }, data);
        expect(groups.map(g => g.typeId)).toEqual(['free', 'cheap', 'tied', 'unknown']);
        expect(armyComposition({ units: Object.fromEntries(values.reverse().map(u => [u.id, u])) }, data)).toEqual(groups);
        expect(groups.at(-1)?.goldCost).toBeNull();
    });
    it('retains observed counts when catalog data is unavailable, without inventing costs', () => {
        expect(armyComposition({ units: { a: unit('a', 'cheap') } }, null)).toEqual([{ typeId: 'cheap', count: 1, goldCost: null }]);
    });
});
