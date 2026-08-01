import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { Match, OverlayRuntimeState, Player, Resources } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { formatGameTime } from '../bar-presentation';
import { dayNightSprite, overlayPlayerColor, raceSpriteIndex } from '../overlay-visuals';

const EMPTY_RESOURCES: Readonly<Resources> = { gold: 0, lumber: 0, supplyCap: 0, supply: 0, workerSupply: 0 };

@Component({
    selector: 'mv-observer-bar',
    imports: [CommonModule],
    templateUrl: './observer-bar.component.html',
    styleUrl: './observer-bar.component.scss'
})
export class ObserverBarComponent {
    readonly matchInput = input.required<Match>({ alias: 'match' });
    readonly playersInput = input.required<Player[]>({ alias: 'players' });
    readonly settingsInput = input.required<MatchVisionOverlaySettings>({ alias: 'settings' });
    readonly runtimeInput = input<OverlayRuntimeState>({}, { alias: 'runtime' });
    readonly gameTimeInput = input(0, { alias: 'gameTime' });
    readonly dayNight = computed(() => dayNightSprite(this.gameTimeInput()));
    private readonly orderedPlayers = computed(() => {
        const [first, second] = this.playersInput();
        if (!first || !second) return [first, second] as const;
        const ordered: [Player, Player] = (second.startPosition?.x ?? 0) < (first.startPosition?.x ?? 0)
            ? [second, first]
            : [first, second];
        return this.settingsInput().reversePlayerOrder ? [ordered[1], ordered[0]] as const : ordered;
    });

    readonly Boolean = Boolean;
    get match(): Match { return this.matchInput(); }
    get players(): Player[] { return this.playersInput(); }
    get settings(): MatchVisionOverlaySettings { return this.settingsInput(); }
    get runtime(): OverlayRuntimeState { return this.runtimeInput(); }
    get player1(): Player { return this.orderedPlayers()[0]!; }
    get player2(): Player { return this.orderedPlayers()[1]!; }
    get formattedGameTime(): string { return formatGameTime(this.gameTimeInput(), true); }
    get player1Resources(): Readonly<Resources> { return this.player1?.resources ?? EMPTY_RESOURCES; }
    get player2Resources(): Readonly<Resources> { return this.player2?.resources ?? EMPTY_RESOURCES; }

    raceShortName(player: Player): string { return standardGame.raceShortName(player.race); }
    raceSpriteIndex(player: Player): number { return raceSpriteIndex(player.race); }
    getColorCode(player: Player): string {
        return overlayPlayerColor(player, this.match, this.players, this.runtime);
    }
}
