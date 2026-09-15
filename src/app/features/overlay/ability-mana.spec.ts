import { describe, expect, it } from 'vitest';
import type { Hero, HeroAbility } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';
import { abilityManaState } from './ability-mana';
const data = { abilities: { get: () => ({ levels: [{ manaCost: 75 }, { manaCost: 125 }] }) } } as unknown as GameData;
const ability: HeroAbility = { id: 'mana-test', typeId: 'AHtb', level: 2 };
const hero = (current = 50, rate = 2.5, max = 300): Hero => ({
    id: '0000000000000001', typeId: 'Hmkg', isIllusion: false,
    mana: { current, max, ...{ regenerationPerSecond: rate } }
});
describe('ability mana availability', () => {
    it('uses learned-level cost and observed regeneration and updates with rate changes', () => {
        expect(abilityManaState(hero(), ability, data)).toMatchObject({ missing: 75, recoverySeconds: 30 });
        expect(abilityManaState(hero(50, 5), ability, data)).toMatchObject({ missing: 75, recoverySeconds: 15 });
        expect(abilityManaState(hero(50), { ...ability, level: 1 }, data)).toMatchObject({ missing: 25, recoverySeconds: 10 });
    });
    it('enables the ability exactly at its cost and rounds display values upward', () => {
        expect(abilityManaState(hero(125), ability, data)).toMatchObject({cost:125, missing:0, availableFraction:1, label:'Enough mana for this ability.'});
        expect(abilityManaState(hero(124.9), ability, data)?.label).toContain('1 more mana needed.');
    });
    it('does not invent recovery with unavailable, stopped, negative or invalid regeneration', () => {
        for (const rate of [0, -1, Infinity, NaN]) expect(abilityManaState(hero(50, rate), ability, data)?.recoverySeconds).toBeNull();
        const unknown = { ...hero(), mana: { current: 50, max: 300 } };
        expect(abilityManaState(unknown, ability, data)?.recoverySeconds).toBeNull();
        expect(abilityManaState(hero(50, 2, 100), ability, data)?.recoverySeconds).toBeNull();
        expect(abilityManaState({ ...hero(), hitpoints: { current: 0, max: 500 } }, ability, data)?.recoverySeconds).toBeNull();
    });
    it('leaves absent pools, missing catalogs, unlearned abilities and unknown costs alone', () => {
        expect(abilityManaState({ ...hero(), mana: undefined }, ability, data)).toBeNull();
        expect(abilityManaState(hero(), ability, null)).toBeNull();
        expect(abilityManaState(hero(), { ...ability, level: 0 }, data)).toBeNull();
        expect(abilityManaState(hero(), { ...ability, level: 3 }, data)).toBeNull();
    });
});

it('fills toward the learned ability cost, not the maximum mana pool', () => {
    expect(abilityManaState(hero(25), ability, data)?.availableFraction).toBe(.2);
    expect(abilityManaState(hero(100), ability, data)?.availableFraction).toBe(.8);
    expect(abilityManaState(hero(25), {...ability, level:1}, data)?.availableFraction).toBeCloseTo(1/3);
    expect(abilityManaState(hero(0), ability, data)?.availableFraction).toBe(0);
    expect(abilityManaState(hero(-1), ability, data)?.availableFraction).toBe(0);
    expect(abilityManaState(hero(125), ability, data)).toMatchObject({cost:125, missing:0, availableFraction:1, label:'Enough mana for this ability.'});
});

it('keeps enough-mana distinct from almost full and caps overfilled pools', () => {
    expect(abilityManaState(hero(124.999), ability, data)?.missing).toBeGreaterThan(0);
    expect(abilityManaState(hero(126), ability, data)).toMatchObject({missing:0, availableFraction:1});
    expect(abilityManaState(hero(75), {...ability, level:1}, data)).toMatchObject({cost:75, availableFraction:1});
});
