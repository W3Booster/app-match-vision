import { matchVisionScore } from '../../domain';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, input } from '@angular/core';
import { canUseHostCapability } from '@w3booster/sdk';
import type { ConnectionStatus, DeepReadonly, HostLifecycleSnapshot, MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { groupPlayersByTeam, isActiveMatch, playerDisplayIdentity } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch, type MatchVisionSettings } from '../../domain';
import type { W3BoosterAppSettings } from '../../core/w3booster-app.generated';
import { dashboardStatusLabel } from './dashboard-status';
import { MatchHistoryStore, type MatchHistoryEntry } from './match-history.store';
import { MatchControls } from './match-controls';

interface CompactHistoryTeam { id: number | null; players: MatchHistoryEntry['players']; }

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
    readonly settings = input.required<DeepReadonly<W3BoosterAppSettings>>();
    readonly status = input.required<ConnectionStatus>();
    readonly synchronized = input.required<boolean>();
    readonly history = new MatchHistoryStore();
    readonly controls = new MatchControls();
    readonly teams = computed(() => matchVisionTeams(this.state(), this.displayedReversePlayerOrder()));
    fontSize = 12;

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly reversePlayerOrderSync = effect(() => {
        this.controls.reconcileReversePlayerOrder(this.savedReversePlayerOrder());
    });

    ngOnDestroy(): void {
        this.history.disconnect();
        this.controls.destroy();
    }
    get matchActive(): boolean { return isActiveMatch(this.state().match); }
    get wins(): number | undefined { return matchVisionScore(this.state())?.wins; }
    get losses(): number | undefined { return matchVisionScore(this.state())?.losses; }
    get connectionLabel(): string { return dashboardStatusLabel(this.status(), this.matchActive, this.synchronized()); }
    get canChangeScore(): boolean { return canUseHostCapability(this.host(), 'match-score:write'); }
    get canReversePlayers(): boolean { return canUseHostCapability(this.host(), 'settings:write'); }

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
        const identity = playerDisplayIdentity(player, { stripBattleTagDiscriminator: true });
        return identity.hasAlias ? `${identity.primaryName} as ${identity.inGameName}` : identity.primaryName;
    }
    raceInitial(race?: string): string { return (race || 'random').charAt(0).toUpperCase(); }
    raceClass(race?: string): string { return (race || 'random').replace(/[^a-z-]/gi, '').toLowerCase(); }
    historyTeams(entry: MatchHistoryEntry): CompactHistoryTeam[] {
        return [...groupPlayersByTeam(entry.players)]
            .sort((left, right) =>
                (left.teamId ?? Number.MAX_SAFE_INTEGER) - (right.teamId ?? Number.MAX_SAFE_INTEGER))
            .map(team => ({ id: team.teamId, players: [...team.players] }));
    }
    private savedReversePlayerOrder(): boolean {
        return reversePlayerOrderForMatch(
            this.state().match,
            matchVisionSettings(this.state().match, this.settings())
        );
    }
    private displayedReversePlayerOrder(): boolean {
        return this.controls.displayedReversePlayerOrder(this.savedReversePlayerOrder());
    }
}
