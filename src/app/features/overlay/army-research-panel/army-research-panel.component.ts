import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { ActiveUpgrade, Match, Player } from '@w3booster/sdk';
import { currentUpgrades } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { upgradePanelInset } from '../overlay-visuals';
import { armyComposition, type ArmyGroup } from './army-composition';

@Component({
    selector: 'mv-army-research-panel',
    imports: [CommonModule],
    templateUrl: './army-research-panel.component.html',
    styleUrl: './army-research-panel.component.scss'
})
export class ArmyResearchPanelComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly match = input.required<Match>();
    readonly player = input.required<Player>();
    readonly opponent = input(false);
    readonly settings = input.required<MatchVisionOverlaySettings>();
    readonly isHeadToHead = computed(() => standardGame.isMode(this.match().mode, '1v1'));
    readonly army = computed(() => this.settings().armyCompositionEnabled !== false
        ? armyComposition(this.player(), this.assets.data()) : []);
    readonly researches = computed(() => {
        if (!this.settings().researchesEnabled || !this.settings().researchesOfAttackAndArmorEnabled) return [];
        const active = currentUpgrades(this.player(), { includeResearching: this.settings().researchesInQueueEnabled !== false });
        const leveled = active.filter(upgrade => this.isWeaponOrArmorUpgrade(upgrade.typeId));
        return this.settings().researchesShowAllEnabled
            ? [...leveled, ...active.filter(upgrade => !this.isWeaponOrArmorUpgrade(upgrade.typeId))] : leveled;
    });
    readonly panelInset = computed(() => upgradePanelInset(this.player(), this.settings().heroItemsEnabled !== false, this.settings().heroAbilitiesEnabled === true));

    isWeaponOrArmorUpgrade(typeId: string): boolean {
        return ['armor', 'melee', 'ranged'].includes(this.assets.data()?.upgrades.get(typeId)?.category ?? '');
    }
    levels(upgrade: ActiveUpgrade): readonly number[] {
        return (this.assets.data()?.upgrades.get(upgrade.typeId)?.levels ?? []).map(level => level.level).reverse();
    }
    researchIcon(upgrade: ActiveUpgrade): string | null { return this.assets.upgradeIconBackground(this.match(), upgrade); }
    armyIcon(group: ArmyGroup): string | null { return this.assets.iconBackground(this.match(), group.typeId); }
    armyLabel(group: ArmyGroup): string { return `${this.assets.data()?.units.get(group.typeId)?.name ?? group.typeId}: ${group.count}`; }
}
