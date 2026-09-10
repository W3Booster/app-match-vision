import { describe, expect, it } from 'vitest';
import type { Match, Player } from '@w3booster/sdk';
import { dayNightSprite, orderedOverlayTeams, raceSpriteIndex, upgradePanelInset } from './overlay-visuals';

const match = { broadcasterPlayerId: 'me', isObserver: true } as Match;
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

    it('uses canonical map-position ordering for observer head-to-head matches', () => {
        const east = { id: 'east', team: 1, startPosition: { x: 100, y: 0 } } as Player;
        const west = { id: 'west', team: 0, startPosition: { x: -100, y: 0 } } as Player;
        expect(orderedOverlayTeams([east, west], { ...match, broadcasterPlayerId: 'east' })
            .map(team => team[0]?.id)).toEqual(['west', 'east']);
    });

    it('keeps the broadcaster first on player overlays even when input starts with the opponent', () => {
        expect(orderedOverlayTeams(players, { ...match, isObserver: false })
            .map(team => team.map(player => player.id))).toEqual([
            ['me', 'ally'],
            ['opponent']
        ]);
    });

    it('keeps sprite-sheet indexes and animation alignment inside the application', () => {
        expect(raceSpriteIndex('orc')).toBe(2);
        expect(dayNightSprite(0)).toEqual({ phase: 0, previousPhase: 15, phaseProgress: 11 / 30 });
    });

    it('moves upgrades only when the first hero occupies another ability column', () => {
        const player = (abilityCount: number): Player => ({
            id: 'hero-player',
            heroes: { "0000000000000001": {
                id: '0000000000000001', typeId: 'Hpal', level: 1,
                abilities: Array.from({ length: abilityCount }, (_, index) => ({
                    id: `ability-${index}`, name: `A00${index}`, level: 1
                }))
            } }
        });
        expect(upgradePanelInset(player(2), true, true)).toBe(207);
        expect(upgradePanelInset(player(2), false, true)).toBe(146);
        expect(upgradePanelInset(player(4), false, true)).toBe(191);
        expect(upgradePanelInset(player(1), true, true)).toBe(upgradePanelInset(player(2), true, true));
        expect(upgradePanelInset(player(3), true, true) - upgradePanelInset(player(2), true, true)).toBe(45);
    });
});
