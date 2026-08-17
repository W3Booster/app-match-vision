import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, input } from '@angular/core';
import type { ConnectionStatus, MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { groupPlayersByTeam, isActiveMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionSettings } from '../../domain';
import { MatchHistoryStore, type MatchHistoryEntry } from './match-history.store';

interface CompactTeam { id: number; players: Player[]; }
interface CompactHistoryTeam { id: number; players: MatchHistoryEntry['players']; }

@Component({
    selector: 'mv-compact-dashboard-surface',
    imports: [CommonModule],
    templateUrl: './compact-dashboard-surface.component.html',
    styleUrl: './compact-dashboard-surface.component.scss'
})
export class CompactDashboardSurfaceComponent implements OnDestroy {
    readonly client = input.required<W3BoosterClient<MatchVisionSettings>>();
    readonly state = input.required<MatchState<MatchVisionSettings>>();
    readonly status = input.required<ConnectionStatus>();
    readonly history = new MatchHistoryStore();
    fontSize = 12;

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly activeMatchTracking = effect(() => {
        const state = this.state();
        if (isActiveMatch(state.match)) this.history.record(state);
    });

    ngOnDestroy(): void { this.history.disconnect(); }
    get matchActive(): boolean { return isActiveMatch(this.state().match); }
    get teams(): CompactTeam[] {
        return groupPlayersByTeam(this.state().players).map(team => ({ id: team.teamId ?? 0, players: [...team.players] }));
    }
    get wins(): number { return Number(this.state().overlay?.misc?.matchscoreWins || 0); }
    get losses(): number { return Number(this.state().overlay?.misc?.matchscoreLosses || 0); }
    get connectionLabel(): string {
        switch (this.status()) {
            case 'connected': return this.matchActive ? 'Match data live' : 'Connected — waiting for a match';
            case 'reconnecting': return 'Connection interrupted — reconnecting';
            case 'connecting': return 'Connecting to W3Booster';
            case 'error': return 'Connection error';
            case 'closed': return 'Disconnected';
            default: return 'Waiting for W3Booster';
        }
    }

    changeScore(side: 'wins' | 'losses', delta: 1 | -1): void {
        this.client().host.command('overlay.match-score.change', { side, delta });
    }
    resetScore(): void { this.client().host.command('overlay.match-score.reset'); }
    reversePlayers(): void {
        const current = this.state().application?.settings.observer?.reversePlayerOrder === true;
        this.client().host.setSetting('observer.reversePlayerOrder', !current);
    }
    changeFont(delta: 1 | -1): void { this.fontSize = Math.min(20, Math.max(10, this.fontSize + delta)); }
    playerStats(player: Player): PlayerStats | undefined {
        return standardGame.statsForMode(player, this.state().match.mode)
            ?? player.stats?.solo ?? player.stats?.team ?? player.stats?.team4 ?? player.stats?.ffa;
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
    decodedMap(map: string): string {
        try { return decodeURIComponent(map); }
        catch { return map; }
    }
}
