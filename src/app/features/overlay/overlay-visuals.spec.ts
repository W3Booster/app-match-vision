import { describe, expect, it } from 'vitest';
import type { Match, Player } from '@w3booster/sdk';
import { activeUpgradeKey, dayNightSprite, inventorySlotKey, orderedOverlayTeams, overlayPlayerColor, raceSpriteIndex, upgradePanelInset } from './overlay-visuals';

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

    it('owns its optional team-color palette', () => {
        expect(overlayPlayerColor(players[1], match, players, { teamColors: false })).toBe('#fe8a0e');
        expect(overlayPlayerColor(players[1], match, players, { teamColors: true })).toBe('#0042ff');
        expect(overlayPlayerColor(players[2], match, players, { teamColors: true })).toBe('#1ce6b9');
        expect(overlayPlayerColor(players[0], match, players, { teamColors: true })).toBe('#ff0303');
    });

    it('keeps sprite-sheet indexes and animation alignment inside the application', () => {
        expect(raceSpriteIndex('orc')).toBe(2);
        expect(dayNightSprite(0)).toEqual({ phase: 0, previousPhase: 15, phaseProgress: 11 / 30 });
    });

    it('keeps live nodes stable but changes animation keys for real item and upgrade events', () => {
        expect(inventorySlotKey(0, 'ratf')).toBe(inventorySlotKey(0, 'ratf'));
        expect(inventorySlotKey(0, '')).not.toBe(inventorySlotKey(0, 'ratf'));
        expect(activeUpgradeKey({ name: 'Rema', level: 1 })).not.toBe(activeUpgradeKey({ name: 'Rema', level: 2 }));
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
