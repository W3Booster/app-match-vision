import { describe, expect, it } from 'vitest';
import { WarcraftAssetsService } from './warcraft-assets.service';

describe('WarcraftAssetsService', () => {
    it('resolves uppercase account countries through the shared SDK flag catalog', () => {
        const service = new WarcraftAssetsService();
        expect(service.countryFlagPath('DE')).toContain('/country-flags/v1/flags/de.png');
        expect(service.countryFlagBackground('../invalid')).toBeNull();
    });

    it('uses typed entity identifiers for standard-game artwork', () => {
        const service = new WarcraftAssetsService();
        const match = { isReforged: true };
        expect(service.heroIconPath(match, { id: 'Hamg' })).toContain('/btnheroarchmage.png');
        expect(service.abilityIconPath(match, { name: 'AHbz' })).toContain('/btnblizzard.png');
        expect(service.upgradeIconPath(match, { name: 'Rhme' })).toContain('/btnsteelmelee.png');
        expect(service.heroIconPath(match, { id: 'ZZZZ' })).toBeNull();
        expect(service.heroIconBackground(match, { id: 'Hamg' })).toMatch(/^url\(".*btnheroarchmage\.png"\)$/);
        expect(service.heroIconBackground(match, { id: 'ZZZZ' })).toBeNull();
    });
});
