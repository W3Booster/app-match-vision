import type { GameContext } from '@w3booster/sdk';
import { describe, expect, it } from 'vitest';
import { createDemoState } from '@w3booster/sdk/testing';
import { productionTop } from './production-queue-layout';

const context = (slot: unknown) => Object.assign({ hudScale: 1 }, { heroBarLastOccupiedSlot: slot }) as unknown as GameContext;
const match = createDemoState().match;
describe('native hero rail reservation', () => {
    it('reserves through slot four even with only one owned and one shared hero', () => {
        expect(productionTop(match, context(4))).toBe('calc(var(--production-top) + 8.65%)');
        expect(productionTop(match, context(7))).toBe('calc(var(--production-top) + 34.6%)');
    });
    it.each([undefined, null, 0, 1, 2, 3, -1, 4.5, 33, NaN, '4'])('keeps the three-row fallback for %s', slot => {
        expect(productionTop(match, context(slot))).toBeNull();
    });
    it('leaves observer and replay presentation unchanged', () => {
        for (const mode of [{ isObserver: true }, { isReplay: true }]) {
            expect(productionTop({ ...match, ...mode }, context(7))).toBeNull();
        }
    });
});
