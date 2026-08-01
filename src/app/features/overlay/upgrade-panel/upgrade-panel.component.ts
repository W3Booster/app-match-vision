import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import type { ActiveUpgrade, Match, Player } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';

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

    activeResearches(player: Player): ActiveUpgrade[] {
        const active = player.upgrades?.active ?? [];
        return this.settings().researchesShowAllEnabled ? active : active.filter(upgrade => standardGame.isWeaponOrArmorUpgrade(upgrade.name));
    }
    isWeaponOrArmorUpgrade(name: string): boolean { return standardGame.isWeaponOrArmorUpgrade(name); }
    iconPath(upgrade: ActiveUpgrade): string | null {
        const key = upgrade.name + (upgrade.level > 1 ? upgrade.level : '');
        return this.assets.iconPath(this.match(), key);
    }
}
