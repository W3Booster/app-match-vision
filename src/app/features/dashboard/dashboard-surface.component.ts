import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, input } from '@angular/core';
import type { HostLifecycleSnapshot, MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { isActiveMatch, matchScore } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch, type MatchVisionSettings } from '../../domain';
import { MatchHistoryStore } from './match-history.store';
import { hostActionAvailable, MatchControls } from './match-controls';

@Component({
    selector: 'mv-dashboard-surface',
    imports: [CommonModule],
    templateUrl: './dashboard-surface.component.html',
    styleUrl: './dashboard-surface.component.scss'
})
export class DashboardSurfaceComponent implements OnDestroy {
    readonly client = input.required<W3BoosterClient<MatchVisionSettings>>();
    readonly host = input.required<HostLifecycleSnapshot>();
    readonly state = input.required<MatchState<MatchVisionSettings>>();
    readonly synchronized = input.required<boolean>();
    readonly history = new MatchHistoryStore();
    readonly controls = new MatchControls();

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly reversePlayerOrderSync = effect(() => {
        this.controls.reconcileReversePlayerOrder(this.savedReversePlayerOrder());
    });

    ngOnDestroy(): void { this.history.disconnect(); }

    get matchActive(): boolean {
        return isActiveMatch(this.state().match);
    }

    get teams(): Array<{ id: number | null; players: Player[] }> {
        return matchVisionTeams(this.state(), this.displayedReversePlayerOrder());
    }

    get wins(): number { return matchScore(this.state()).wins; }
    get losses(): number { return matchScore(this.state()).losses; }
    get canChangeScore(): boolean { return hostActionAvailable(this.host(), 'match-score:write'); }
    get canOpenCompact(): boolean { return hostActionAvailable(this.host(), 'window:open'); }
    get canReversePlayers(): boolean { return hostActionAvailable(this.host(), 'settings:write'); }

    async changeScore(side: 'wins' | 'losses', delta: 1 | -1): Promise<void> {
        await this.controls.changeScore(this.client(), side, delta);
    }
    async resetScore(): Promise<void> {
        await this.controls.resetScore(this.client());
    }
    async reversePlayers(): Promise<void> {
        await this.controls.reversePlayers(this.client(), this.state().match.id, this.savedReversePlayerOrder());
    }
    async openCompact(): Promise<void> {
        await this.controls.openWindow(this.client(), {
            path: '?view=compact', width: 500, height: 300, title: 'Match Vision'
        });
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
