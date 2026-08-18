import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, input } from '@angular/core';
import type { ConnectionStatus, HostLifecycleSnapshot, MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { isActiveMatch, matchScore } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch, type MatchVisionSettings } from '../../domain';
import { dashboardStatusLabel } from './dashboard-status';
import { MatchHistoryStore, type MatchHistoryEntry } from './match-history.store';
import { hostActionAvailable, MatchControls } from './match-controls';

interface CompactTeam { id: number | null; players: Player[]; }
interface CompactHistoryTeam { id: number; players: MatchHistoryEntry['players']; }

@Component({
    selector: 'mv-compact-dashboard-surface',
    imports: [CommonModule],
    templateUrl: './compact-dashboard-surface.component.html',
    styleUrl: './compact-dashboard-surface.component.scss'
})
export class CompactDashboardSurfaceComponent implements OnDestroy {
    readonly client = input.required<W3BoosterClient<MatchVisionSettings>>();
    readonly host = input.required<HostLifecycleSnapshot>();
    readonly state = input.required<MatchState<MatchVisionSettings>>();
    readonly status = input.required<ConnectionStatus>();
    readonly synchronized = input.required<boolean>();
    readonly history = new MatchHistoryStore();
    readonly controls = new MatchControls();
    fontSize = 12;

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly reversePlayerOrderSync = effect(() => {
        this.controls.reconcileReversePlayerOrder(this.savedReversePlayerOrder());
    });

    ngOnDestroy(): void { this.history.disconnect(); }
    get matchActive(): boolean { return isActiveMatch(this.state().match); }
    get teams(): CompactTeam[] {
        return matchVisionTeams(this.state(), this.displayedReversePlayerOrder());
    }
    get wins(): number { return matchScore(this.state()).wins; }
    get losses(): number { return matchScore(this.state()).losses; }
    get connectionLabel(): string { return dashboardStatusLabel(this.status(), this.matchActive, this.synchronized()); }
    get canChangeScore(): boolean { return hostActionAvailable(this.host(), 'match-score:write'); }
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
    changeFont(delta: 1 | -1): void { this.fontSize = Math.min(20, Math.max(10, this.fontSize + delta)); }
    playerStats(player: Player): PlayerStats | undefined {
        return standardGame.preferredStats(player, this.state().match.mode);
    }
    displayName(player: Player): string {
        const accountName = player.mainAccount?.name;
        const playerName = player.name || player.id;
        return accountName && accountName !== playerName ? `${accountName} as ${playerName}` : accountName || playerName;
    }
    raceInitial(race?: string): string { return (race || 'random').charAt(0).toUpperCase(); }
    raceClass(race?: string): string { return (race || 'random').replace(/[^a-z-]/gi, '').toLowerCase(); }
    historyTeams(entry: MatchHistoryEntry): CompactHistoryTeam[] {
        const grouped = new Map<number, MatchHistoryEntry['players']>();
        for (const player of entry.players) {
            const team = Number(player.team || 0);
            grouped.set(team, [...(grouped.get(team) ?? []), player]);
        }
        return [...grouped.entries()].sort(([a], [b]) => a - b).map(([id, players]) => ({ id, players }));
    }
    private savedReversePlayerOrder(): boolean {
        return reversePlayerOrderForMatch(this.state().match, matchVisionSettings(this.state()));
    }
    private displayedReversePlayerOrder(): boolean {
        return this.controls.displayedReversePlayerOrder(this.savedReversePlayerOrder());
    }
}
