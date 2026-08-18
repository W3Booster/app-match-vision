import { describe, expect, it } from 'vitest';
import type { Match, Player } from '@w3booster/sdk';
import { dayNightSprite, orderedOverlayTeams, raceSpriteIndex, upgradePanelInset } from './overlay-visuals';

const match = { broadcasterPlayerId: 'me', isObserver: false } as Match;
const players: Player[] = [
    { id: 'opponent', team: 1, colorId: 4 },
    { id: 'me', team: 0, colorId: 5 },
    { id: 'ally', team: 0, colorId: 6 }
];

describe('Match Vision overlay presentation rules', () => {
    it('orders the broadcaster team first without changing SDK team grouping', () => {
        expect(orderedOverlayTeams(players, match).map(team => team.map(player => player.id))).toEqual([
            ['me', 'ally'],
            ['opponent']
        ]);
    });

    it('reverses observer teams after applying the canonical team order', () => {
        expect(orderedOverlayTeams(players, match, true).map(team => team.map(player => player.id))).toEqual([
            ['opponent'],
            ['me', 'ally']
        ]);
    });

    it('keeps sprite-sheet indexes and animation alignment inside the application', () => {
        expect(raceSpriteIndex('orc')).toBe(2);
        expect(dayNightSprite(0)).toEqual({ phase: 0, previousPhase: 15, phaseProgress: 11 / 30 });
    });

    it('moves upgrades only when the first hero occupies another ability column', () => {
        const player = (abilityCount: number): Player => ({
            id: 'hero-player',
            heroes: [{
                id: 'Hpal', name: 'Paladin', level: 1,
                abilities: Array.from({ length: abilityCount }, (_, index) => ({
                    id: `ability-${index}`, name: `A00${index}`, level: 1
                }))
            }]
        });
        expect(upgradePanelInset(player(2), true, true)).toBe(207);
        expect(upgradePanelInset(player(1), true, true)).toBe(upgradePanelInset(player(2), true, true));
        expect(upgradePanelInset(player(3), true, true) - upgradePanelInset(player(2), true, true)).toBe(45);
    });
});
