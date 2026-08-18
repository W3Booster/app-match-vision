import { Injectable } from '@angular/core';
import type { CompletedUpgrade, Hero, HeroAbility, Match } from '@w3booster/sdk';
import * as sharedAssets from '@w3booster/sdk/assets';
import * as standardGameIcons from '@w3booster/sdk/standard-game/icons';

export function resolveWarcraftAssetBaseUrl(
    location: Pick<Location, 'search'> | undefined = globalThis.location
): string {
    return sharedAssets.resolveAssetBaseUrl({ location });
}

@Injectable({ providedIn: 'root' })
export class WarcraftAssetsService {
    private readonly missingIcons = new Set<string>();
    private readonly baseUrl = resolveWarcraftAssetBaseUrl();
    private readonly standardGame = standardGameIcons.createAssetResolver({ baseUrl: this.baseUrl });

    iconPath(match: Pick<Match, 'isReforged'>, key: string): string | null {
        return this.resolveIcon(key, this.standardGame.icon(match, key));
    }

    heroIconPath(match: Pick<Match, 'isReforged'>, hero: Pick<Hero, 'id'>): string | null {
        return this.resolveIcon(hero.id, this.standardGame.hero(match, hero));
    }

    abilityIconPath(match: Pick<Match, 'isReforged'>, ability: Pick<HeroAbility, 'name'>): string | null {
        return this.resolveIcon(ability.name, this.standardGame.ability(match, ability));
    }

    upgradeIconPath(match: Pick<Match, 'isReforged'>, upgrade: Pick<CompletedUpgrade, 'name'>): string | null {
        return this.resolveIcon(upgrade.name, this.standardGame.upgrade(match, upgrade));
    }

    itemIconPath(match: Pick<Match, 'isReforged'>, rawcode: string): string | null {
        return this.resolveIcon(rawcode, this.standardGame.item(match, rawcode));
    }

    private resolveIcon(key: string, icon: string | undefined): string | null {
        if (icon) return icon;
        if (!this.missingIcons.has(key)) {
            this.missingIcons.add(key);
            console.warn(`No Warcraft III icon metadata found for ${key}.`);
        }
        return null;
    }

    countryFlagPath(country: string): string | null {
        return sharedAssets.countryFlagUrl(country, { baseUrl: this.baseUrl }) ?? null;
    }

    countryFlagBackground(country: string): string | null {
        const path = this.countryFlagPath(country);
        return path ? `url("${path}")` : null;
    }
}
