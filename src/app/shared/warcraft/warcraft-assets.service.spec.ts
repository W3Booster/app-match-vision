import { describe, expect, it } from 'vitest';
import * as sharedAssets from '@w3booster/sdk/assets';
import { resolveWarcraftAssetBaseUrl, WarcraftAssetsService } from './warcraft-assets.service';

describe('resolveWarcraftAssetBaseUrl', () => {
    it('uses a local asset origin explicitly advertised by the platform', () => {
        expect(resolveWarcraftAssetBaseUrl({ search: '?backend=local&assetBaseUrl=http%3A%2F%2Flocalhost%3A8083%2Fassets' }))
            .toBe('http://localhost:8083/assets');
    });

    it('keeps production assets when a production app requests the local backend', () => {
        expect(resolveWarcraftAssetBaseUrl({
            search: '?backend=local'
        })).toBe(sharedAssets.assetBaseUrl);
    });

    it('prefers an explicit asset origin override', () => {
        expect(resolveWarcraftAssetBaseUrl({
            search: '?backend=local&assetBaseUrl=http%3A%2F%2Flocalhost%3A9000'
        })).toBe('http://localhost:9000');
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
        expect(service.heroIconPath(match, { id: 'Hamg' })).toContain('/btnheroarchmage.png');
        expect(service.abilityIconPath(match, { name: 'AHbz' })).toContain('/btnblizzard.png');
        expect(service.upgradeIconPath(match, { name: 'Rhme' })).toContain('/btnsteelmelee.png');
    });
});
