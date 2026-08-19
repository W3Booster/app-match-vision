import { Injectable } from '@angular/core';
import type { CompletedUpgrade, Hero, HeroAbility, Match } from '@w3booster/sdk';
import * as sharedAssets from '@w3booster/sdk/assets';
import * as standardGameIcons from '@w3booster/sdk/standard-game/icons';

@Injectable({ providedIn: 'root' })
export class WarcraftAssetsService {
    private readonly missingIcons = new Set<string>();
    // The explicit base URL and flag fallback keep clean installs compatible
    // with the published SDK until the unified resolver ships.
    private readonly baseUrl = sharedAssets.resolveAssetBaseUrl();
    private readonly assets = standardGameIcons.createAssetResolver({ baseUrl: this.baseUrl });

    iconPath(match: Pick<Match, 'isReforged'>, key: string): string | null {
        return this.resolveIcon(key, this.assets.icon(match, key));
    }

    heroIconPath(match: Pick<Match, 'isReforged'>, hero: Pick<Hero, 'id'>): string | null {
        return this.resolveIcon(hero.id, this.assets.hero(match, hero));
    }

    abilityIconPath(match: Pick<Match, 'isReforged'>, ability: Pick<HeroAbility, 'name'>): string | null {
        return this.resolveIcon(ability.name, this.assets.ability(match, ability));
    }

    upgradeIconPath(match: Pick<Match, 'isReforged'>, upgrade: Pick<CompletedUpgrade, 'name'>): string | null {
        return this.resolveIcon(upgrade.name, this.assets.upgrade(match, upgrade));
    }

    itemIconPath(match: Pick<Match, 'isReforged'>, rawcode: string): string | null {
        return this.resolveIcon(rawcode, this.assets.item(match, rawcode));
    }

    iconBackground(match: Pick<Match, 'isReforged'>, key: string): string | null {
        return this.background(this.iconPath(match, key));
    }

    heroIconBackground(match: Pick<Match, 'isReforged'>, hero: Pick<Hero, 'id'>): string | null {
        return this.background(this.heroIconPath(match, hero));
    }

    abilityIconBackground(match: Pick<Match, 'isReforged'>, ability: Pick<HeroAbility, 'name'>): string | null {
        return this.background(this.abilityIconPath(match, ability));
    }

    upgradeIconBackground(match: Pick<Match, 'isReforged'>, upgrade: Pick<CompletedUpgrade, 'name'>): string | null {
        return this.background(this.upgradeIconPath(match, upgrade));
    }

    itemIconBackground(match: Pick<Match, 'isReforged'>, rawcode: string): string | null {
        return this.background(this.itemIconPath(match, rawcode));
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
        return this.background(this.countryFlagPath(country));
    }

    private background(path: string | null): string | null {
        return path ? `url("${path}")` : null;
    }
}
