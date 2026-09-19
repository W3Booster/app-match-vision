import { describe, expect, it } from 'vitest';
import { createMatchVisionDemo } from './match-vision-demo';

describe('Match Vision demo catalog', () => {
    it('identifies the generated catalog needed to render its synthetic units', () => {
        const state = createMatchVisionDemo();
        expect(state.match.gameDataId).toBe(`${state.match.gameVersion}-61e667c51d996056`);
        expect(Object.values(state.players[0].heroes ?? {})[0].typeId).toBe('Hamg');
    });
});
