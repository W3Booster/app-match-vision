import { describe, expect, it, vi } from 'vitest';
import { playerBuildings, playerHeroes } from './unit-selectors';

// Exercise the application safeguard even when the SDK itself does not filter.
vi.mock('@w3booster/sdk/selectors', () => ({
    playerHeroes: (player: { heroes?: object } | null) => Object.values(player?.heroes ?? {}),
    playerBuildings: (player: { buildings?: object } | null) => Object.values(player?.buildings ?? {})
}));

describe('Match Vision illusion policy', () => {
    it('keeps hero order stable across health-driven map reconstruction and complete replacement snapshots', () => {
        const heroes = ['0020000000000000', '0020000000000001', '0020000080000000'].map((id, index) =>
            Object.freeze({ id, typeId: 'Hmkg', isIllusion: false, experience: index * 200 }));
        for (const order of [[0, 1, 2], [0, 2, 1], [2, 1, 0]]) {
            const map = Object.freeze(Object.fromEntries(order.map(i => [heroes[i]!.id, heroes[i]])));
            const result = playerHeroes({ heroes: map });
            expect(result).toEqual(heroes);
            expect(result[1]).toBe(heroes[1]);
            expect(Object.keys(map)).toEqual(order.map(i => heroes[i]!.id));
        }
    });
    it('uses the native hero order ahead of IDs, with deterministic ties and missing values', () => {
        const heroes = [3, 1, 2, 4, 5].map((n, index) => ({
            id: n.toString(16).padStart(16, '0'), typeId: 'Hamg', isIllusion: false,
            heroOrder: [1, 2, 3, undefined, 2][index]
        }));
        for (const permutation of [[4, 3, 2, 1, 0], [3, 1, 2, 0, 4]]) {
            const result = playerHeroes({ heroes: Object.fromEntries(permutation.map(i => [heroes[i]!.id, heroes[i]])) });
            expect(result.map(h => h.id)).toEqual([heroes[0]!.id, heroes[1]!.id, heroes[4]!.id, heroes[2]!.id, heroes[3]!.id]);
        }
    });
    it('hides copies without collapsing distinct real heroes of the same type', () => {
        const real = { id: '0000000000000001', typeId: 'Hmkg', isIllusion: false };
        const copy = { ...real, id: '0000000000000002', isIllusion: true };
        const secondReal = { ...real, id: '0000000000000003' };
        const player = { heroes: Object.freeze({ [real.id]: real, [copy.id]: copy, [secondReal.id]: secondReal }) };
        expect(playerHeroes(player)).toEqual([real, secondReal]);
        expect(Object.values(player.heroes)).toEqual([real, copy, secondReal]);
    });
    it('excludes illusion buildings from production and construction presentation', () => {
        const real = { id: '0000000000000001', typeId: 'hbar', isIllusion: false };
        const copy = { ...real, id: '0000000000000002', isIllusion: true };
        expect(playerBuildings({ buildings: { [real.id]: real, [copy.id]: copy } })).toEqual([real]);
        expect(playerHeroes(null)).toEqual([]);
        expect(playerBuildings(null)).toEqual([]);
    });
});
