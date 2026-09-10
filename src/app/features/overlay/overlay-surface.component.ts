import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { DeepReadonly, Hero, HeroAbility, MatchState } from '@w3booster/sdk';
import { heroInventory, inventorySlotIdentity, isActiveMatch, isObserverOrReplayMatch, playerHeroes } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionPlayerView, MatchVisionSettings } from '../../domain';
import type { W3BoosterAppSettings } from '../../core/w3booster-app.generated';
import { WarcraftAssetsService } from '../../shared/warcraft/warcraft-assets.service';
import { MapBarComponent } from './map-bar/map-bar.component';
import { MatchBarComponent } from './match-bar/match-bar.component';
import { ObserverBarComponent } from './observer-bar/observer-bar.component';
import { createOverlayPresentation } from './overlay-presentation';
import { TeamObserverBarComponent } from './team-observer-bar/team-observer-bar.component';
import { ProductionQueueComponent } from './production-queue/production-queue.component';
import { heroHealthColor } from './hero-vitals';
import { UpgradePanelComponent } from './upgrade-panel/upgrade-panel.component';

@Component({
    selector: 'mv-overlay-surface',
    imports: [CommonModule, ProductionQueueComponent, MapBarComponent, MatchBarComponent, ObserverBarComponent, TeamObserverBarComponent, UpgradePanelComponent],
    templateUrl: './overlay-surface.component.html',
    styleUrl: './overlay-surface.component.scss'
})
export class OverlaySurfaceComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly matchState = input.required<MatchState<MatchVisionSettings>>({ alias: 'state' });
    readonly resolvedSettings = input.required<DeepReadonly<W3BoosterAppSettings>>({ alias: 'settings' });
    private readonly presentation = computed(() => createOverlayPresentation(this.matchState(), this.resolvedSettings()));

    get state(): MatchState<MatchVisionSettings> { return this.matchState(); }
    get settings() { return this.presentation().settings; }
    get gameContext() { return this.presentation().gameContext; }
    get score() { return this.presentation().score; }
    get players(): readonly MatchVisionPlayerView[] { return this.presentation().players; }
    get observerPlayers(): readonly [MatchVisionPlayerView, MatchVisionPlayerView] | null {
        return this.presentation().observerPlayers;
    }
    get streamer(): MatchVisionPlayerView | null { return this.presentation().streamer; }
    get opponent(): MatchVisionPlayerView | null { return this.presentation().opponent; }
    get streamerHeroes(): readonly Hero[] { return playerHeroes(this.streamer); }
    get opponentHeroes(): readonly Hero[] { return playerHeroes(this.opponent); }
    readonly heroHealthColor = heroHealthColor;
    get isReforged(): boolean { return this.state.match.isReforged === true; }
    get matchActive(): boolean { return isActiveMatch(this.state.match); }
    get requiredAvatarCoverCount(): number { return this.presentation().requiredAvatarCovers; }

    getHeroExperienceProgress(hero: Hero): number { return standardGame.heroExperienceState(hero.experience).progress; }
    getHeroLevel(hero: Hero): string { return standardGame.formatHeroLevelProgress(hero); }
    heroItems(hero: Hero): readonly string[] { return heroInventory(hero); }
    getIconBackground(key: string): string | null { return this.assets.iconBackground(this.state.match, key); }
    getHeroIconBackground(hero: Hero): string | null { return this.assets.heroIconBackground(this.state.match, hero); }
    getAbilityIconBackground(ability: HeroAbility): string | null { return this.assets.abilityIconBackground(this.state.match, ability); }
    getItemIconBackground(rawcode: string): string | null { return this.assets.itemIconBackground(this.state.match, rawcode); }
    isObserverOrReplay(): boolean { return isObserverOrReplayMatch(this.state.match); }
    showObserverBar(): boolean { return this.presentation().showsObserverBar; }
    showObserverTeamBar(): boolean { return this.presentation().showsTeamObserverBar; }
    isHeroDefeated(hero: Hero): boolean { return standardGame.isValuePoolDepleted(hero.hitpoints); }
    heroHealthRatio(hero: Hero): number { return standardGame.valuePoolRatio(hero.hitpoints); }
    heroManaRatio(hero: Hero): number { return standardGame.valuePoolRatio(hero.mana); }
    getCooldown(ability: HeroAbility) { return this.presentation().abilityCooldowns.get(ability); }
    cooldownSeconds(remaining: number): number { return Math.max(0, Math.ceil(remaining)); }
    getRequiredAvatarCoverCountForObserverTeamBar(): number { return this.presentation().teamAvatarCovers; }
    getAvatarCoverTop(index: number): string { return index === 1 ? '12.90%' : index === 2 ? '21.55%' : '4.30%'; }
    trackHero(_index: number, hero: Hero): string { return hero.id; }
    trackAbility(_index: number, ability: HeroAbility): string { return ability.id; }
    trackInventorySlot(index: number, item: string): string { return inventorySlotIdentity(index, item); }
    trackPosition(index: number): number { return index; }
}
