import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { Hero, Match, OverlayRuntimeState, Player, Resources } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import { heroDisplayLevel } from '../../../domain';
import { reversePlayerOrderForMatch, type MatchVisionOverlaySettings } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { matchBarClasses, showsMatchBar } from '../bar-presentation';
import { orderedOverlayTeams, overlayPlayerColor } from '../overlay-visuals';

const EMPTY_RESOURCES: Readonly<Resources> = { gold: 0, lumber: 0, supplyCap: 0, supply: 0, workerSupply: 0 };

@Component({
    selector: 'mv-team-observer-bar',
    imports: [CommonModule],
    templateUrl: './team-observer-bar.component.html',
    styleUrl: './team-observer-bar.component.scss'
})
export class TeamObserverBarComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly matchInput = input.required<Match>({ alias: 'match' });
    readonly playersInput = input.required<Player[]>({ alias: 'players' });
    readonly settingsInput = input.required<MatchVisionOverlaySettings>({ alias: 'settings' });
    readonly runtimeInput = input<OverlayRuntimeState>({}, { alias: 'runtime' });
    readonly showMatchBar = computed(() => showsMatchBar(this.match));
    readonly teams = computed(() => orderedOverlayTeams(
        this.players,
        this.match,
        reversePlayerOrderForMatch(this.match, this.settings)
    ));
    readonly additionalCss = computed(() => matchBarClasses(this.match, this.settings));

    get match(): Match { return this.matchInput(); }
    get players(): Player[] { return this.playersInput(); }
    get settings(): MatchVisionOverlaySettings { return this.settingsInput(); }
    get runtime(): OverlayRuntimeState { return this.runtimeInput(); }
    getPlayerResources(player: Player): Readonly<Resources> { return player.resources ?? EMPTY_RESOURCES; }
    showFullResources(): boolean { return !standardGame.isMode(this.match.mode, '4v4'); }
    getPlayerHeroes(player: Player): Hero[] { return (player.heroes ?? []).slice(0, 3); }
    getHeroLevel(hero: Hero): string { return heroDisplayLevel(hero); }
    getHeroIconPath(hero: Hero): string | null { return this.assets.heroIconPath(this.match, hero); }
    countryFlagBackground(country: string): string | null { return this.assets.countryFlagBackground(country); }
    getColorCode(player: Player): string {
        return overlayPlayerColor(player, this.match, this.players, this.runtime);
    }
    getRaceName(player: Player): string { return standardGame.raceName(player.race); }
    trackPlayer(_index: number, player: Player): string { return player.id; }
    trackHero(_index: number, hero: Hero): string { return hero.id; }
}
