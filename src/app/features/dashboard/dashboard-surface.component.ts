import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, input } from '@angular/core';
import type { MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { isActiveMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch, type MatchVisionSettings } from '../../domain';
import { MatchHistoryStore } from './match-history.store';
import { MatchControls } from './match-controls';

@Component({
    selector: 'mv-dashboard-surface',
    imports: [CommonModule],
    templateUrl: './dashboard-surface.component.html',
    styleUrl: './dashboard-surface.component.scss'
})
export class DashboardSurfaceComponent implements OnDestroy {
    readonly client = input.required<W3BoosterClient<MatchVisionSettings>>();
    readonly state = input.required<MatchState<MatchVisionSettings>>();
    readonly history = new MatchHistoryStore();
    private readonly controls = new MatchControls();

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly reversePlayerOrderSync = effect(() => {
        this.controls.reconcileReversePlayerOrder(this.savedReversePlayerOrder());
    });

    ngOnDestroy(): void { this.history.disconnect(); }

    get matchActive(): boolean {
        return isActiveMatch(this.state().match);
    }

    get teams(): Array<{ id: number; players: Player[] }> {
        return matchVisionTeams(this.state(), this.displayedReversePlayerOrder());
    }

    get wins(): number { return Number(this.state().overlay?.misc?.matchscoreWins || 0); }
    get losses(): number { return Number(this.state().overlay?.misc?.matchscoreLosses || 0); }

    async changeScore(side: 'wins' | 'losses', delta: 1 | -1): Promise<void> {
        await this.controls.changeScore(this.client(), side, delta);
    }
    async resetScore(): Promise<void> {
        await this.controls.resetScore(this.client());
    }
    async reversePlayers(): Promise<void> {
        await this.controls.reversePlayers(this.client(), this.state().match.id, this.savedReversePlayerOrder());
    }
    openCompact(): void {
        void this.client().host.openWindowAndWait({ path: '?view=compact', width: 500, height: 300, title: 'Match Vision' })
            .catch(error => console.error('Could not open the compact Match Vision window:', error));
    }
    formatTime(seconds: number): string {
        return standardGame.formatGameTime(seconds, { compactHours: true });
    }
    raceName(player: Player): string { return player.race || 'random'; }
    playerStats(player: Player): PlayerStats | undefined {
        return standardGame.preferredStats(player, this.state().match.mode);
    }
    private savedReversePlayerOrder(): boolean {
        return reversePlayerOrderForMatch(this.state().match, matchVisionSettings(this.state()));
    }
    private displayedReversePlayerOrder(): boolean {
        return this.controls.displayedReversePlayerOrder(this.savedReversePlayerOrder());
    }
}
