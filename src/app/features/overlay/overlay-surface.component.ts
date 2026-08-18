import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { Hero, HeroAbility, MatchState, Player } from '@w3booster/sdk';
import { heroInventory, inventorySlotIdentity, isObserverOrReplayMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionSettings } from '../../domain';
import { WarcraftAssetsService } from '../../shared/warcraft/warcraft-assets.service';
import { MapBarComponent } from './map-bar/map-bar.component';
import { MatchBarComponent } from './match-bar/match-bar.component';
import { ObserverBarComponent } from './observer-bar/observer-bar.component';
import { createOverlayPresentation } from './overlay-presentation';
import { TeamObserverBarComponent } from './team-observer-bar/team-observer-bar.component';
import { UpgradePanelComponent } from './upgrade-panel/upgrade-panel.component';

@Component({
    selector: 'mv-overlay-surface',
    imports: [CommonModule, MapBarComponent, MatchBarComponent, ObserverBarComponent, TeamObserverBarComponent, UpgradePanelComponent],
    templateUrl: './overlay-surface.component.html',
    styleUrl: './overlay-surface.component.scss'
})
export class OverlaySurfaceComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly matchState = input.required<MatchState<MatchVisionSettings>>({ alias: 'state' });
    private readonly presentation = computed(() => createOverlayPresentation(this.matchState()));

    get state(): MatchState<MatchVisionSettings> { return this.matchState(); }
    get settings() { return this.presentation().settings; }
    get runtime() { return this.presentation().runtime; }
    get players(): readonly Player[] { return this.presentation().players; }
    get streamer(): Player | null { return this.presentation().streamer; }
    get opponent(): Player | null { return this.presentation().opponent; }
    get additionalCSSClasses(): string { return this.presentation().additionalCssClasses; }
    get isReforged(): boolean { return this.state.match.isReforged === true; }
    get requiredAvatarCoverCount(): number { return this.presentation().requiredAvatarCovers; }

    getHeroExperienceProgress(hero: Hero): number { return standardGame.heroExperienceState(hero.experience).progress; }
    getHeroLevel(hero: Hero): string { return standardGame.formatHeroLevelProgress(hero); }
    heroItems(hero: Hero): readonly string[] { return heroInventory(hero); }
    getIconPath(key: string): string | null { return this.assets.iconPath(this.state.match, key); }
    getHeroIconPath(hero: Hero): string | null { return this.assets.heroIconPath(this.state.match, hero); }
    getAbilityIconPath(ability: HeroAbility): string | null { return this.assets.abilityIconPath(this.state.match, ability); }
    getItemIconPath(rawcode: string): string | null { return this.assets.itemIconPath(this.state.match, rawcode); }
    isObserverOrReplay(): boolean { return isObserverOrReplayMatch(this.state.match); }
    showObserverBar(): boolean { return this.presentation().showsObserverBar; }
    showObserverTeamBar(): boolean { return this.presentation().showsTeamObserverBar; }
    isHeroDefeated(hero: Hero): boolean { return standardGame.isValuePoolDepleted(hero.hitpoints); }
    heroHealthRatio(hero: Hero): number { return standardGame.valuePoolRatio(hero.hitpoints); }
    getCooldown(ability: HeroAbility) { return this.presentation().abilityCooldowns.get(ability); }
    getRequiredAvatarCoverCountForObserverTeamBar(): number { return this.presentation().teamAvatarCovers; }
    getAvatarCoverTop(index: number): string { return index === 1 ? '12.90%' : index === 2 ? '21.55%' : '4.30%'; }
    trackHero(_index: number, hero: Hero): string { return hero.id; }
    trackAbility(_index: number, ability: HeroAbility): string { return ability.id; }
    trackInventorySlot(index: number, item: string): string { return inventorySlotIdentity(index, item); }
    trackPosition(index: number): number { return index; }
}
