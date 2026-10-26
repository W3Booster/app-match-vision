import { describe, expect, it } from 'vitest';
import type { Hero, Player, ProductionQueueItem } from '@w3booster/sdk';
import { heroRevival } from './hero-revival';

const hero: Hero = { id: '0000000000000001', typeId: 'Hamg', isIllusion: false, hitpoints: { current: 0, max: 500 } };
const slot: ProductionQueueItem = { position: 0, typeId: 'Hamg', buildType: 'reviving', progress: .4, totalSeconds: 50, remainingSeconds: 30 };
function player(queue: readonly ProductionQueueItem[] = [slot]): Player {
    return { heroes: { [hero.id]: hero }, buildings: { altar: { id: 'altar', typeId: 'halt', production: { queue } } } } as unknown as Player;
}

describe('hero revival observations', () => {
    it('uses the same owner’s active observation without estimating timers', () => {
        expect(heroRevival(hero, player())).toBe(slot);
        const unknown = { ...slot, progress: null, totalSeconds: null, remainingSeconds: null };
        expect(heroRevival(hero, player([unknown]))).toBe(unknown);
        const waiting = { ...unknown, progress: 0 };
        expect(heroRevival(hero, player([waiting]))).toBe(waiting);
    });
    it('withdraws on cancellation, completion, missing data, and revival', () => {
        expect(heroRevival(hero, player([]))).toBeNull();
        expect(heroRevival(hero, null)).toBeNull();
        expect(heroRevival({ ...hero, hitpoints: undefined }, player())).toBeNull();
        expect(heroRevival({ ...hero, hitpoints: { current: 1, max: 500 } }, player())).toBeNull();
        for (const change of [{ progress: 1 }, { remainingSeconds: 0 }, { typeId: 'Hmkg' }, { buildType: 'unit' as const }, { buildType: undefined }, { position: 1 }]) {
            expect(heroRevival(hero, player([{ ...slot, ...change }]))).toBeNull();
        }
    });
    it('rejects waiting slots, other owners, illusions and ambiguous identities', () => {
        expect(heroRevival(hero, player([{ ...slot, typeId: 'Hmkg' }, { ...slot, position: 1 }]))).toBeNull();
        expect(heroRevival({ ...hero, id: 'other' }, player())).toBeNull();
        expect(heroRevival({ ...hero, isIllusion: true }, player())).toBeNull();
        const owner = player();
        expect(heroRevival(hero, { ...owner, heroes: { ...owner.heroes, duplicate: { ...hero, id: 'duplicate' } } })).toBeNull();
        expect(heroRevival(hero, { ...owner, buildings: { ...owner.buildings, duplicate: { ...Object.values(owner.buildings!)[0]!, id: 'duplicate' } } })).toBeNull();
    });
});
