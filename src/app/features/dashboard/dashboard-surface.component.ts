import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, input } from '@angular/core';
import type { MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { groupPlayersByTeam, isActiveMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionSettings } from '../../domain';
import { MatchHistoryStore } from './match-history.store';

@Component({
    selector: 'mv-dashboard-surface',
    imports: [CommonModule],
    templateUrl: './dashboard-surface.component.html',
    styleUrl: './dashboard-surface.component.scss'
})
export class DashboardSurfaceComponent implements OnDestroy {
    readonly client = input.required<W3BoosterClient<MatchVisionSettings>>();
    readonly state = input.required<MatchState<MatchVisionSettings>>();
    readonly compact = input(false);
    readonly history = new MatchHistoryStore();

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly activeMatchTracking = effect(() => {
        const state = this.state();
        if (isActiveMatch(state.match)) this.history.record(state);
    });

    ngOnDestroy(): void { this.history.disconnect(); }

    get matchActive(): boolean {
        return isActiveMatch(this.state().match);
    }

    get teams(): Array<{ id: number; players: Player[] }> {
        return groupPlayersByTeam(this.state().players).map(team => ({ id: team.teamId ?? 0, players: [...team.players] }));
    }

    get wins(): number { return Number(this.state().overlay?.misc?.matchscoreWins || 0); }
    get losses(): number { return Number(this.state().overlay?.misc?.matchscoreLosses || 0); }

    changeScore(side: 'wins' | 'losses', delta: 1 | -1): void {
        this.client().host.command('overlay.match-score.change', { side, delta });
    }
    resetScore(): void { this.client().host.command('overlay.match-score.reset'); }
    reversePlayers(): void {
        const current = this.state().application?.settings.observer?.reversePlayerOrder === true;
        this.client().host.setSetting('observer.reversePlayerOrder', !current);
    }
    openCompact(): void {
        this.client().host.openWindow({ path: '?view=compact', width: 540, height: 680, title: 'Match Vision' });
    }
    closeCompact(): void { window.close(); }
    formatTime(seconds: number): string {
        const value = Math.max(0, Number(seconds) || 0);
        return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    }
    raceName(player: Player): string { return player.race || 'random'; }
    playerStats(player: Player): PlayerStats | undefined {
        return standardGame.statsForMode(player, this.state().match.mode)
            ?? player.stats?.solo
            ?? player.stats?.team
            ?? player.stats?.team4
            ?? player.stats?.ffa;
    }
}
