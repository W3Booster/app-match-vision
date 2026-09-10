import { describe, expect, it } from 'vitest';
import type { PlayerStats } from '@w3booster/sdk';
import { WarcraftAssetsService } from './warcraft-assets.service';

describe('provider league artwork', () => {
    const stats: PlayerStats = { provider: 'bnet', gameMode: '1v1', queue: 'individual', wins: 1, losses: 1, winRate: 50, league: 0 };
    it('uses Battle.net unplaced and placed badges without requiring rank', () => {
        const assets = new WarcraftAssetsService();
        expect(assets.leagueIconPath(stats)).toContain('/wc3/bnet-leagues/v1/standard/0.png');
        expect(assets.leagueIconPath({ ...stats, league: 6 })).toContain('/wc3/bnet-leagues/v1/simplified/6.png');
        expect(assets.leagueIconPath({ ...stats, league: 99 })).toBeNull();
        expect(assets.leagueIconPath({ ...stats, league: undefined })).toBeNull();
    });
    it('keeps W3Champions leagues separate', () => {
        const assets = new WarcraftAssetsService();
        expect(assets.leagueIconPath({ ...stats, provider: 'w3champions', league: 6 })).toBe('/assets/img/leagues/6.png');
        expect(assets.leagueIconPath({ ...stats, provider: 'netease', league: 6 })).toBeNull();
    });
});

describe('WarcraftAssetsService', () => {
    it('resolves uppercase account countries through the shared SDK flag catalog', () => {
        const service = new WarcraftAssetsService();
        expect(service.countryFlagPath('DE')).toContain('/country-flags/v1/flags/de.png');
        expect(service.countryFlagBackground('../invalid')).toBeNull();
    });

    it('uses typed entity identifiers for standard-game artwork', () => {
        const service = new WarcraftAssetsService();
        const match = { isReforged: true };
        expect(service.heroIconPath(match, { typeId: 'Hamg' })).toContain('/btnheroarchmage.png');
        expect(service.abilityIconPath(match, { name: 'AHbz' })).toContain('/btnblizzard.png');
        expect(service.upgradeIconPath(match, { name: 'Rhme' })).toContain('/btnsteelmelee.png');
        expect(service.heroIconPath(match, { typeId: 'ZZZZ' })).toBeNull();
        expect(service.heroIconBackground(match, { typeId: 'Hamg' })).toMatch(/^url\(".*btnheroarchmage\.png"\)$/);
        expect(service.heroIconBackground(match, { typeId: 'ZZZZ' })).toBeNull();
    });
});
