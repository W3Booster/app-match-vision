import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { Match, OverlayRuntimeState, Player, PlayerStats } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings, MatchVisionPlayerView } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { matchBarClasses, showsMatchBar, truncated } from '../bar-presentation';
import { orderedOverlayTeams, raceName } from '../overlay-visuals';

@Component({
    selector: 'mv-match-bar',
    imports: [CommonModule],
    templateUrl: './match-bar.component.html',
    styleUrl: './match-bar.component.scss'
})
export class MatchBarComponent {
    private readonly assets = inject(WarcraftAssetsService);
    readonly match = input.required<Match>();
    readonly players = input.required<readonly MatchVisionPlayerView[]>();
    readonly settings = input.required<MatchVisionOverlaySettings>();
    readonly runtime = input<OverlayRuntimeState>({});
    readonly gameTime = input(0);

    readonly showMatchBar = computed(() => showsMatchBar(this.match()));
    readonly teams = computed(() => orderedOverlayTeams(this.players(), this.match()));
    readonly formattedGameTime = computed(() => standardGame.formatGameTime(this.gameTime()));
    readonly additionalCss = computed(() => matchBarClasses(this.match(), this.settings()));
    readonly normalizedGameMode = computed(() => standardGame.normalizeMode(this.match().mode));
    readonly isOneVersusOne = computed(() => standardGame.isMode(this.match().mode, '1v1'));
    readonly Number = Number;

    getStats(player: Player): PlayerStats | undefined {
        return standardGame.statsForMode(player, this.match().mode);
    }
    playerIdentity(player: MatchVisionPlayerView) { return player.displayIdentity; }

    getGameMode(): string {
        if (standardGame.isMode(this.match().mode, '1v1')) return '1vs1';
        if (standardGame.isMode(this.match().mode, '2v2')) return '2vs2';
        return 'vs';
    }

    getColorCode(player: Player): string {
        return standardGame.presentationPlayerColor(player, this.match(), this.players(), this.runtime());
    }
    getRaceName(player: Player): string { return raceName(player.race); }
    countryFlagBackground(country: string): string | null { return this.assets.countryFlagBackground(country); }
    formatRatio(value: number): string { return truncated(value, 1); }
    trackTeam(index: number, team: readonly Player[]): string | number { return team[0]?.team ?? index; }
    trackPlayer(_index: number, player: Player): string { return player.id; }
}
