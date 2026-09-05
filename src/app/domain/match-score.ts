import type { MatchState } from '@w3booster/sdk';

export interface MatchVisionScore { readonly wins: number; readonly losses: number }

export function matchVisionScore(state: MatchState): MatchVisionScore | undefined {
    const data = state.application?.data;
    const value = data?.['matchScore'];
    if (!value || typeof value !== 'object' || !('wins' in value) || !('losses' in value)) return undefined;
    return typeof value.wins === 'number' && Number.isFinite(value.wins) &&
        typeof value.losses === 'number' && Number.isFinite(value.losses)
        ? { wins: value.wins, losses: value.losses } : undefined;
}
