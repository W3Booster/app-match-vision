import { describe, expect, it } from 'vitest';
import { createMatchVisionDemo } from './match-vision-demo';

describe('Match Vision demo catalog', () => {
    it('identifies the generated catalog needed to render its synthetic units', () => {
        const state = createMatchVisionDemo();
        expect(state.match.gameVersion).toBe('3.0.0.24268');
        expect(state.match.gameDataId).toBe('3.0.0.24268-b01f3ba39503e1fd');
        expect(Object.values(state.players[0].heroes ?? {})[0].typeId).toBe('Hamg');
    });
});
