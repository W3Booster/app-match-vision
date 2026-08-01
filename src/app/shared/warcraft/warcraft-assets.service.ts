import { Injectable } from '@angular/core';
import type { Match } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';

@Injectable({ providedIn: 'root' })
export class WarcraftAssetsService {
    private readonly missingIcons = new Set<string>();
    private readonly baseUrl = new URLSearchParams(globalThis.location?.search ?? '').get('assetBaseUrl')
        || standardGame.assetBaseUrl;

    iconPath(match: Pick<Match, 'isReforged'>, key: string): string | null {
        const icon = standardGame.iconUrl(key, {
            graphics: match.isReforged ? 'reforged' : 'classic',
            baseUrl: this.baseUrl
        });
        if (icon) return icon;
        if (!this.missingIcons.has(key)) {
            this.missingIcons.add(key);
            console.warn(`No Warcraft III icon metadata found for ${key}.`);
        }
        return null;
    }
}
