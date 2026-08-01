import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { Match, OverlayRuntimeState, Player, PlayerStats } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';
import { formatGameTime, matchBarClasses, showsMatchBar, truncated } from '../bar-presentation';
import { orderedOverlayTeams, overlayPlayerColor } from '../overlay-visuals';

@Component({
    selector: 'mv-match-bar',
    imports: [CommonModule],
    templateUrl: './match-bar.component.html',
    styleUrl: './match-bar.component.scss'
})
export class MatchBarComponent {
    readonly match = input.required<Match>();
    readonly players = input.required<Player[]>();
    readonly settings = input.required<MatchVisionOverlaySettings>();
    readonly runtime = input<OverlayRuntimeState>({});
    readonly gameTime = input(0);

    readonly showMatchBar = computed(() => showsMatchBar(this.match()));
    readonly teams = computed(() => orderedOverlayTeams(this.players(), this.match()));
    readonly formattedGameTime = computed(() => formatGameTime(this.gameTime()));
    readonly additionalCss = computed(() => matchBarClasses(this.match(), this.settings()));
    readonly normalizedGameMode = computed(() => standardGame.normalizeMode(this.match().mode));
    readonly isOneVersusOne = computed(() => standardGame.isMode(this.match().mode, '1v1'));
    readonly Number = Number;

    getStats(player: Player): PlayerStats | undefined {
        return standardGame.statsForMode(player, this.match().mode);
    }

    getGameMode(): string {
        if (standardGame.isMode(this.match().mode, '1v1')) return '1vs1';
        if (standardGame.isMode(this.match().mode, '2v2')) return '2vs2';
        return 'vs';
    }

    getColorCode(player: Player): string {
        return overlayPlayerColor(player, this.match(), this.players(), this.runtime());
    }
    getRaceName(player: Player): string { return standardGame.raceName(player.race); }
    formatRatio(value: number): string { return truncated(value, 1); }
}
