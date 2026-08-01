import { describe, expect, it } from 'vitest';
import type { Match, Player } from '@w3booster/sdk';
import { dayNightSprite, orderedOverlayTeams, overlayPlayerColor, raceSpriteIndex } from './overlay-visuals';

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
});
