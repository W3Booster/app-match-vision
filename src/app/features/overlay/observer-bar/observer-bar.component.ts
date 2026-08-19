import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { Match, OverlayRuntimeState, Player, Resources } from '@w3booster/sdk';
import { playerResources } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings, MatchVisionPlayerView } from '../../../domain';
import { reversePlayerOrderForMatch } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { dayNightSprite, raceShortName, raceSpriteIndex } from '../overlay-visuals';

@Component({
    selector: 'mv-observer-bar',
    imports: [CommonModule],
    templateUrl: './observer-bar.component.html',
    styleUrl: './observer-bar.component.scss'
})
export class ObserverBarComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly matchInput = input.required<Match>({ alias: 'match' });
    readonly playersInput = input.required<readonly [MatchVisionPlayerView, MatchVisionPlayerView]>({ alias: 'players' });
    readonly settingsInput = input.required<MatchVisionOverlaySettings>({ alias: 'settings' });
    readonly runtimeInput = input<OverlayRuntimeState>({}, { alias: 'runtime' });
    readonly gameTimeInput = input(0, { alias: 'gameTime' });
    readonly dayNight = computed(() => dayNightSprite(this.gameTimeInput()));
    private readonly orderedPlayers = computed(() => {
        const [first, second] = this.playersInput();
        return standardGame.orderHeadToHeadPlayers([first, second], {
            reverse: reversePlayerOrderForMatch(this.match, this.settingsInput())
        });
    });

    readonly Boolean = Boolean;
    get match(): Match { return this.matchInput(); }
    get players(): readonly [MatchVisionPlayerView, MatchVisionPlayerView] { return this.playersInput(); }
    get settings(): MatchVisionOverlaySettings { return this.settingsInput(); }
    get runtime(): OverlayRuntimeState { return this.runtimeInput(); }
    get player1(): MatchVisionPlayerView { return this.orderedPlayers()[0]; }
    get player2(): MatchVisionPlayerView { return this.orderedPlayers()[1]; }
    get formattedGameTime(): string { return standardGame.formatGameTime(this.gameTimeInput(), { compactHours: true }); }
    get player1Resources(): Readonly<Resources> | undefined { return playerResources(this.player1); }
    get player2Resources(): Readonly<Resources> | undefined { return playerResources(this.player2); }

    raceShortName(player: Player): string { return raceShortName(player.race); }
    raceSpriteIndex(player: Player): number { return raceSpriteIndex(player.race); }
    playerName(player: MatchVisionPlayerView): string { return player.displayIdentity.primaryName; }
    upkeepState(supply: number): standardGame.UpkeepState | undefined { return standardGame.upkeepState(supply); }
    countryFlagBackground(country: string): string | null { return this.assets.countryFlagBackground(country); }
    getColorCode(player: Player): string {
        return standardGame.presentationPlayerColor(player, this.match, this.players, this.runtime);
    }
    trackPlayerResource(
        _index: number,
        entry: { player: Player; resources: Readonly<Resources> | undefined; revert: boolean }
    ): string { return entry.player.id; }
}
