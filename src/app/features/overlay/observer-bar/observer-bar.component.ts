import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { Match, OverlayRuntimeState, Player, Resources } from '@w3booster/sdk';
import { playerResources } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { reversePlayerOrderForMatch } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { dayNightSprite, raceSpriteIndex } from '../overlay-visuals';

@Component({
    selector: 'mv-observer-bar',
    imports: [CommonModule],
    templateUrl: './observer-bar.component.html',
    styleUrl: './observer-bar.component.scss'
})
export class ObserverBarComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly matchInput = input.required<Match>({ alias: 'match' });
    readonly playersInput = input.required<readonly Player[]>({ alias: 'players' });
    readonly settingsInput = input.required<MatchVisionOverlaySettings>({ alias: 'settings' });
    readonly runtimeInput = input<OverlayRuntimeState>({}, { alias: 'runtime' });
    readonly gameTimeInput = input(0, { alias: 'gameTime' });
    readonly dayNight = computed(() => dayNightSprite(this.gameTimeInput()));
    private readonly orderedPlayers = computed(() => {
        const [first, second] = this.playersInput();
        if (!first || !second) return [first, second] as const;
        return standardGame.orderHeadToHeadPlayers([first, second], {
            reverse: reversePlayerOrderForMatch(this.match, this.settingsInput())
        }) as [Player, Player];
    });

    readonly Boolean = Boolean;
    get match(): Match { return this.matchInput(); }
    get players(): readonly Player[] { return this.playersInput(); }
    get settings(): MatchVisionOverlaySettings { return this.settingsInput(); }
    get runtime(): OverlayRuntimeState { return this.runtimeInput(); }
    get player1(): Player { return this.orderedPlayers()[0]!; }
    get player2(): Player { return this.orderedPlayers()[1]!; }
    get formattedGameTime(): string { return standardGame.formatGameTime(this.gameTimeInput(), { compactHours: true }); }
    get player1Resources(): Readonly<Resources> { return playerResources(this.player1); }
    get player2Resources(): Readonly<Resources> { return playerResources(this.player2); }

    raceShortName(player: Player): string { return standardGame.raceShortName(player.race); }
    raceSpriteIndex(player: Player): number { return raceSpriteIndex(player.race); }
    countryFlagBackground(country: string): string | null { return this.assets.countryFlagBackground(country); }
    getColorCode(player: Player): string {
        return standardGame.presentationPlayerColor(player, this.match, this.players, this.runtime);
    }
    trackPlayerResource(
        _index: number,
        entry: { player: Player; resources: Readonly<Resources>; revert: boolean }
    ): string { return entry.player.id; }
}
