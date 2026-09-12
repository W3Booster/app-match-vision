import { Injector, signal } from '@angular/core';
import { WarcraftGameDataService } from './warcraft-game-data.service';
import { describe, expect, it } from 'vitest';
import type { PlayerStats } from '@w3booster/sdk';
import { WarcraftAssetsService } from './warcraft-assets.service';

describe('provider league artwork', () => {
    const stats: PlayerStats = { provider: 'bnet', gameMode: '1v1', queue: 'individual', wins: 1, losses: 1, winRate: 50, league: 0 };
    it('uses Battle.net unplaced and placed badges without requiring rank', () => {
        const assets = createService();
        expect(assets.leagueIconPath(stats)).toContain('/wc3/bnet-leagues/v1/standard/0.png');
        expect(assets.leagueIconPath({ ...stats, league: 6 })).toContain('/wc3/bnet-leagues/v1/simplified/6.png');
        expect(assets.leagueIconPath({ ...stats, league: 99 })).toBeNull();
        expect(assets.leagueIconPath({ ...stats, league: undefined })).toBeNull();
    });
    it('keeps W3Champions leagues separate', () => {
        const assets = createService();
        expect(assets.leagueIconPath({ ...stats, provider: 'w3champions', league: 6 })).toBe('/assets/img/leagues/6.png');
        expect(assets.leagueIconPath({ ...stats, provider: 'netease', league: 6 })).toBeNull();
    });
});

describe('WarcraftAssetsService', () => {
    it('resolves uppercase account countries through the shared SDK flag catalog', () => {
        const service = createService();
        expect(service.countryFlagPath('DE')).toContain('/country-flags/v1/flags/de.png');
        expect(service.countryFlagBackground('../invalid')).toBeNull();
    });

    it('renders research queues with the next level artwork and units with their own artwork', () => {
        const service = createService();
        const match = { isReforged: false };
        expect(service.productionIconPath(match, 'hfoo')).toContain('/units/hfoo/classic/1.png');
        expect(service.productionIconPath(match, 'Rhme')).toContain('/upgrades/Rhme/classic/1.png');
        expect(service.productionIconPath(match, 'Rhme', [{typeId: 'Rhme', level: 1, gametime: 10}])).toContain('/upgrades/Rhme/classic/2.png');
        expect(service.productionIconPath(match, 'Rhme', [{typeId: 'Rhme', level: 2, gametime: 20}])).toContain('/upgrades/Rhme/classic/3.png');
        expect(service.productionIconPath(match, 'Rhme', [{typeId: 'Rhme', level: 3, gametime: 30}])).toContain('/upgrades/Rhme/classic/3.png');
    });

    it('uses typed entity identifiers for standard-game artwork', () => {
        const service = createService();
        const match = { isReforged: true };
        expect(service.heroIconPath(match, { typeId: 'Hamg' })).toContain('/units/Hamg/reforged/1.png');
        expect(service.abilityIconPath(match, { typeId: 'AHbz', level: 1 })).toContain('/abilities/AHbz/reforged/1.png');
        expect(service.upgradeIconPath(match, { typeId: 'Rhme', level: 2 })).toContain('/upgrades/Rhme/reforged/2.png');
        expect(service.heroIconPath(match, { typeId: 'ZZZZ' })).toBeNull();
        expect(service.heroIconBackground(match, { typeId: 'Hamg' })).toBe('url("https://example.test/units/Hamg/reforged/1.png")');
        expect(service.heroIconBackground(match, { typeId: 'ZZZZ' })).toBeNull();
    });
});

function createService() {
    const icon = (kind: string) => (typeId: string, options: { graphics: string; level: number }) =>
        typeId === 'ZZZZ' ? undefined : `https://example.test/${kind}/${typeId}/${options.graphics}/${options.level}.png`;
    const data = signal({ upgrades: new Map([['Rhme', {levels: [{}, {}, {}]}]]), assets: { unitIcon: icon('units'), abilityIcon: icon('abilities'), upgradeIcon: icon('upgrades') } });
    return Injector.create({ providers: [{ provide: WarcraftAssetsService, useFactory: () => new WarcraftAssetsService() }, { provide: WarcraftGameDataService, useValue: { data } }] }).get(WarcraftAssetsService);
}
