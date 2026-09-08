import { RaceTagComponent } from './race-tag.component';
import { CopyPlayerNameComponent } from './copy-player-name.component';
import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { groupPlayersByTeam } from '@w3booster/sdk/selectors';
import type { MatchHistoryEntry } from './match-history.store';

@Component({
    selector: 'mv-match-history-players',
    host: { '[class.duel]': 'teams().length === 2' },
    imports: [RaceTagComponent, CopyPlayerNameComponent, CommonModule],
    template: `
        <ng-container *ngFor="let team of teams(); let first = first; let index = index">
            <span class="versus" *ngIf="!first && teams().length === 2">vs</span>
            <span class="team" [class.opponent]="index === 1 && teams().length === 2">
                <span class="team-label" *ngIf="teams().length > 2">{{team.teamId === null ? 'Unassigned team' : 'Team ' + (team.teamId + 1)}}</span>
                <span class="player" *ngFor="let player of team.players">
                    <mv-copy-player-name [name]="player.name"></mv-copy-player-name>
                    <mv-race-tag [value]="player.race"></mv-race-tag>
                </span>
            </span>
        </ng-container>
    `,
    styles: `
        :host { min-width: 0; color: #aeb9bf; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 6px; }
        :host(.duel) { grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); gap: 4px; }
        .team { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .player { display: flex; align-items: center; gap: 4px; min-width: 0; }
        :host(.duel) .opponent { text-align: right; }
        :host(.duel) .opponent .player { flex-direction: row-reverse; }
        .versus { align-self: center; color: #85949e; font-size: .85em; text-align: center; font-weight: 700; }
        .team-label { color: #95b5c8; font-size: .8em; font-weight: 700; }
    `
})
export class MatchHistoryPlayersComponent {
    readonly entry = input.required<MatchHistoryEntry>();
    readonly teams = computed(() => [...groupPlayersByTeam(this.entry().players)]
        .sort((left, right) => (left.teamId ?? Number.MAX_SAFE_INTEGER) - (right.teamId ?? Number.MAX_SAFE_INTEGER)));

}

export function matchHistoryStatus(entry: MatchHistoryEntry): string {
    if (entry.result) return entry.result.outcome === 'won' ? 'Won' : 'Lost';
    if (!entry.endedAt) return 'Live';
    return entry.mode === 'Replay' || entry.mode === 'Observed' ? 'Finished' : 'Result unavailable';
}
