import type { GameContext, Match } from '@w3booster/sdk';

/** Match Vision placement policy. Native slots include gaps and shared heroes. */
export function productionTop(match: Match, context: GameContext): string | null {
    if (match.isObserver || match.isReplay) return null;
    // Feature detection retains compatibility with the minimum registry SDK.
    const slot = 'heroBarLastOccupiedSlot' in context ? context.heroBarLastOccupiedSlot : undefined;
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot <= 3 || slot > 32) return null;
    return `calc(var(--production-top) + ${(slot - 3) * 8.65}%)`;
}
