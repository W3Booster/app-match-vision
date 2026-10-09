import { describe, expect, it } from 'vitest';
import type { Match, Player } from '@w3booster/sdk';
import { currentStatsProvider } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';

const match = (realm: string): Pick<Match, 'realm'> => ({ realm });
const player = (records: Player['stats']['records']): Pick<Player, 'stats' | 'race'> => ({
    race: 'human', stats: { status: 'ready', records }
});

describe('display statistics provider selection', () => {
    it('selects the current Battle.net record from a mixed collection', () => {
        const provider = currentStatsProvider(match('Reforged'));
        expect(provider).toBe('bnet');
        expect(standardGame.statsForMode(player([
            { provider: 'w3champions', gameMode: '1v1', queue: 'individual', wins: 2, losses: 1, mmr: 1700 },
            { provider: 'bnet', gameMode: '1v1', queue: 'individual', wins: 4, losses: 2, mmr: 1900 }
        ]), '1v1', { provider })).toMatchObject({ provider: 'bnet', mmr: 1900 });
    });

    it('selects W3Champions independently and hides stats for an unknown realm', () => {
        const records = [
            { provider: 'w3champions' as const, gameMode: '1v1' as const, queue: 'individual' as const, wins: 2, losses: 1, mmr: 1700 },
            { provider: 'bnet' as const, gameMode: '1v1' as const, queue: 'individual' as const, wins: 4, losses: 2, mmr: 1900 }
        ];
        const w3c = currentStatsProvider(match('W3Champions@EU'));
        expect(standardGame.statsForMode(player(records), '1v1', { provider: w3c })).toMatchObject({ provider: 'w3champions', mmr: 1700 });
        expect(currentStatsProvider(match('CustomRealm'))).toBeUndefined();
    });
});
