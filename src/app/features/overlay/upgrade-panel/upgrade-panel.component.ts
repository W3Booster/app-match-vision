import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { ActiveUpgrade, Match, Player } from '@w3booster/sdk';
import { currentUpgrades, upgradeIdentity } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { upgradePanelInset } from '../overlay-visuals';

@Component({
    selector: 'mv-upgrade-panel',
    imports: [CommonModule],
    templateUrl: './upgrade-panel.component.html',
    styleUrl: './upgrade-panel.component.scss'
})
export class UpgradePanelComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly match = input.required<Match>();
    readonly streamer = input.required<Player>();
    readonly opponent = input<Player | null>(null);
    readonly settings = input.required<MatchVisionOverlaySettings>();

    readonly isHeadToHead = computed(() => standardGame.isMode(this.match().mode, '1v1'));

    activeResearches(player: Player): readonly ActiveUpgrade[] {
        const active = currentUpgrades(player, {
            includeResearching: this.settings().researchesInQueueEnabled !== false
        });
        const leveled = active.filter(upgrade => this.isWeaponOrArmorUpgrade(upgrade.typeId));
        if (!this.settings().researchesShowAllEnabled) return leveled;
        return [...leveled, ...active.filter(upgrade => !this.isWeaponOrArmorUpgrade(upgrade.typeId))];
    }
    isWeaponOrArmorUpgrade(typeId: string): boolean {
        return ['armor', 'melee', 'ranged'].includes(this.assets.data()?.upgrades.get(typeId)?.category ?? '');
    }
    levels(upgrade: ActiveUpgrade): readonly number[] {
        return (this.assets.data()?.upgrades.get(upgrade.typeId)?.levels ?? []).map(level => level.level).reverse();
    }
    iconBackground(upgrade: ActiveUpgrade): string | null {
        return this.assets.upgradeIconBackground(this.match(), upgrade);
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
