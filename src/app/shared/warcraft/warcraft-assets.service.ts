import { bnetLeagueIconUrl, countryFlagUrl, resolveAssetBaseUrl } from '@w3booster/sdk/assets';
import { Injectable, inject } from '@angular/core';
import type { CompletedUpgrade, Hero, HeroAbility, Match, PlayerStats } from '@w3booster/sdk';
import { WarcraftGameDataService } from './warcraft-game-data.service';

@Injectable({ providedIn: 'root' })
export class WarcraftAssetsService {
    private readonly missingIcons = new Set<string>();
    private readonly catalog = inject(WarcraftGameDataService);
    readonly data = this.catalog.data;

    private options(match: Pick<Match, 'isReforged'>, level = 1) {
        return { graphics: match.isReforged ? 'reforged' as const : 'classic' as const, level };
    }

    leagueIconPath(stats: PlayerStats): string | null {
        if (stats.provider === 'bnet') return typeof stats.league === 'number' ? bnetLeagueIconUrl(stats.league, { baseUrl: resolveAssetBaseUrl() }) ?? null : null;
        return stats.provider === 'w3champions' && Number.isInteger(stats.league) && Number(stats.league) >= 0
            ? `/assets/img/leagues/${stats.league}.png` : null;
    }

    unitIconPath(match: Pick<Match, 'isReforged'>, key: string): string | null {
        return this.resolveIcon(key, this.data()?.assets.unitIcon(key, this.options(match)));
    }

    heroIconPath(match: Pick<Match, 'isReforged'>, hero: Pick<Hero, 'typeId'>): string | null {
        return this.resolveIcon(hero.typeId, this.data()?.assets.unitIcon(hero.typeId, this.options(match)));
    }

    abilityIconPath(match: Pick<Match, 'isReforged'>, ability: Pick<HeroAbility, 'typeId' | 'level'>): string | null {
        return this.resolveIcon(ability.typeId, this.data()?.assets.abilityIcon(ability.typeId, this.options(match, Math.max(1, ability.level))));
    }

    upgradeIconPath(match: Pick<Match, 'isReforged'>, upgrade: Pick<CompletedUpgrade, 'typeId' | 'level'>): string | null {
        return this.resolveIcon(upgrade.typeId, this.data()?.assets.upgradeIcon(upgrade.typeId, this.options(match, upgrade.level)));
    }

    itemIconPath(match: Pick<Match, 'isReforged'>, rawcode: string): string | null {
        return this.resolveIcon(rawcode, this.data()?.assets.itemIcon(rawcode, this.options(match)));
    }

    productionIconPath(match: Pick<Match, 'isReforged'>, typeId: string, completed: readonly CompletedUpgrade[] = []): string | null {
        const upgrade = this.data()?.upgrades.get(typeId);
        if (!upgrade) return this.unitIconPath(match, typeId);
        const completedLevel = completed.find(value => value.typeId === typeId)?.level ?? 0;
        // Completion and queue removal can arrive in adjacent recorder updates.
        const level = Math.min(completedLevel + 1, upgrade.levels.length);
        return this.upgradeIconPath(match, { typeId, level });
    }

    iconBackground(match: Pick<Match, 'isReforged'>, key: string): string | null {
        return this.background(this.unitIconPath(match, key));
    }

    heroIconBackground(match: Pick<Match, 'isReforged'>, hero: Pick<Hero, 'typeId'>): string | null {
        return this.background(this.heroIconPath(match, hero));
    }

    abilityIconBackground(match: Pick<Match, 'isReforged'>, ability: Pick<HeroAbility, 'typeId' | 'level'>): string | null {
        return this.background(this.abilityIconPath(match, ability));
    }

    upgradeIconBackground(match: Pick<Match, 'isReforged'>, upgrade: Pick<CompletedUpgrade, 'typeId' | 'level'>): string | null {
        return this.background(this.upgradeIconPath(match, upgrade));
    }

    itemIconBackground(match: Pick<Match, 'isReforged'>, rawcode: string): string | null {
        return this.background(this.itemIconPath(match, rawcode));
    }

    private resolveIcon(key: string, icon: string | undefined): string | null {
        if (icon) return icon;
        if (this.data() && !this.missingIcons.has(key)) {
            this.missingIcons.add(key);
            console.warn(`No Warcraft III icon metadata found for ${key}.`);
        }
        return null;
    }

    countryFlagPath(country: string): string | null {
        return countryFlagUrl(country, { baseUrl: resolveAssetBaseUrl() }) ?? null;
    }

    countryFlagBackground(country: string): string | null {
        return this.background(this.countryFlagPath(country));
    }

    private background(path: string | null): string | null {
        return path ? `url("${path}")` : null;
    }
}
