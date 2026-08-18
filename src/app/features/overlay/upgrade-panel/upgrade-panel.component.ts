import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import type { ActiveUpgrade, Match, Player } from '@w3booster/sdk';
import { currentUpgrades, upgradeIdentity } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { upgradePanelInset } from '../overlay-visuals';

@Component({
    selector: 'mv-upgrade-panel',
    imports: [CommonModule],
    templateUrl: './upgrade-panel.component.html'
})
export class UpgradePanelComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly match = input.required<Match>();
    readonly streamer = input.required<Player>();
    readonly opponent = input<Player | null>(null);
    readonly settings = input.required<MatchVisionOverlaySettings>();

    activeResearches(player: Player): readonly ActiveUpgrade[] {
        const active = currentUpgrades(player, {
            includeResearching: this.settings().researchesInQueueEnabled !== false
        });
        return this.settings().researchesShowAllEnabled ? active : active.filter(upgrade => standardGame.isWeaponOrArmorUpgrade(upgrade.name));
    }
    isWeaponOrArmorUpgrade(name: string): boolean { return standardGame.isWeaponOrArmorUpgrade(name); }
    iconPath(upgrade: ActiveUpgrade): string | null {
        return this.assets.upgradeIconPath(this.match(), upgrade);
    }
    panelInset(player: Player): number {
        return upgradePanelInset(
            player,
            this.settings().heroItemsEnabled !== false,
            this.settings().heroAbilitiesEnabled === true
        );
    }
    trackUpgrade(_index: number, upgrade: ActiveUpgrade): string { return upgradeIdentity(upgrade); }
}
