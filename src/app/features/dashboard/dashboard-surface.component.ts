import { MatchHistoryPlayersComponent, matchHistoryStatus } from './match-history-players.component';
import { AutomaticScoreService } from '../../core/automatic-score.service';
import { AutomaticScoreHelpComponent } from './automatic-score-help.component';
import { matchVisionScore } from '../../domain';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, input } from '@angular/core';
import { canUseHostCapability } from '@w3booster/sdk';
import type { DeepReadonly, HostLifecycleSnapshot, MatchState, Player, PlayerStats, W3BoosterClient } from '@w3booster/sdk';
import { isActiveMatch, playerDisplayIdentity } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { matchVisionSettings, matchVisionTeams, reversePlayerOrderForMatch, type MatchVisionSettings } from '../../domain';
import type { W3BoosterAppSettings } from '../../core/w3booster-app.generated';
import { MatchHistoryStore } from './match-history.store';
import { MatchControls } from './match-controls';

@Component({
    selector: 'mv-dashboard-surface',
    imports: [CommonModule, AutomaticScoreHelpComponent, MatchHistoryPlayersComponent],
    templateUrl: './dashboard-surface.component.html',
    styleUrl: './dashboard-surface.component.scss'
})
export class DashboardSurfaceComponent implements OnDestroy {
    readonly client = input.required<W3BoosterClient<MatchVisionSettings>>();
    readonly host = input.required<HostLifecycleSnapshot>();
    readonly state = input.required<MatchState<MatchVisionSettings>>();
    readonly settings = input.required<DeepReadonly<W3BoosterAppSettings>>();
    readonly synchronized = input.required<boolean>();
    readonly history = new MatchHistoryStore();
    readonly historyStatus = matchHistoryStatus;
    readonly score = inject(AutomaticScoreService);
    readonly controls = new MatchControls();
    readonly teams = computed(() => matchVisionTeams(this.state(), this.displayedReversePlayerOrder()));

    private readonly clientBinding = effect(() => this.history.connect(this.client()));
    private readonly reversePlayerOrderSync = effect(() => {
        this.controls.reconcileReversePlayerOrder(this.savedReversePlayerOrder());
    });

    ngOnDestroy(): void {
        this.history.disconnect();
        this.controls.destroy();
    }

    get matchActive(): boolean {
        return isActiveMatch(this.state().match);
    }

    get wins(): number | undefined { return matchVisionScore(this.state())?.wins; }
    get losses(): number | undefined { return matchVisionScore(this.state())?.losses; }
    get canChangeScore(): boolean { return !!this.score.document() && !this.score.busy() && canUseHostCapability(this.host(), 'command'); }
    get canOpenCompact(): boolean { return canUseHostCapability(this.host(), 'window:open'); }
    get canReversePlayers(): boolean { return canUseHostCapability(this.host(), 'settings:write'); }

    async changeScore(side: 'wins' | 'losses', delta: 1 | -1): Promise<void> {
        await this.score.run({ side, delta });
    }
    async resetScore(): Promise<void> {
        await this.score.run({ reset: true });
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
    playerName(player: Player): string {
        return playerDisplayIdentity(player, { stripBattleTagDiscriminator: true }).primaryName;
    }
    playerStats(player: Player): PlayerStats | undefined {
        return standardGame.preferredStats(player, this.state().match.mode);
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
