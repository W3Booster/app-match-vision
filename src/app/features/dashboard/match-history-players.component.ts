import { CopyPlayerNameComponent } from './copy-player-name.component';
import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { groupPlayersByTeam } from '@w3booster/sdk/selectors';
import { raceInfo } from '@w3booster/sdk/standard-game';
import type { MatchHistoryEntry } from './match-history.store';

@Component({
    selector: 'mv-match-history-players',
    host: { '[class.duel]': 'teams().length === 2' },
    imports: [CopyPlayerNameComponent, CommonModule],
    template: `
        <ng-container *ngFor="let team of teams(); let first = first; let index = index">
            <span class="versus" *ngIf="!first && teams().length === 2">vs</span>
            <span class="team" [class.opponent]="index === 1 && teams().length === 2">
                <span class="team-label" *ngIf="teams().length > 2">{{team.teamId === null ? 'Unassigned team' : 'Team ' + (team.teamId + 1)}}</span>
                <span class="player" *ngFor="let player of team.players">
                    <small [attr.data-race]="race(player.race).id">{{race(player.race).label}}</small>
                    <mv-copy-player-name [name]="player.name"></mv-copy-player-name>
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
        small { flex: 0 0 auto; color: #c7d2d9; font-size: .8em; white-space: nowrap; }
        small[data-race='human'] { color: #a4d1ff; }
        small[data-race='orc'] { color: #ffb6a7; }
        small[data-race='undead'] { color: #d2baff; }
        small[data-race='night-elf'] { color: #9fe1bd; }
    `
})
export class MatchHistoryPlayersComponent {
    readonly entry = input.required<MatchHistoryEntry>();
    readonly teams = computed(() => [...groupPlayersByTeam(this.entry().players)]
        .sort((left, right) => (left.teamId ?? Number.MAX_SAFE_INTEGER) - (right.teamId ?? Number.MAX_SAFE_INTEGER)));
    race(value: string): { id: string; label: string } {
        const key = raceInfo(value).localizationKey;
        const labels = { 'race.human': 'Human', 'race.orc': 'Orc', 'race.undead': 'Undead',
            'race.night-elf': 'Night Elf', 'race.random': 'Random' };
        return { id: key.slice(5), label: labels[key] };
    }
}

export function matchHistoryStatus(entry: MatchHistoryEntry): string {
    if (entry.result) return entry.result.outcome === 'won' ? 'Won' : 'Lost';
    if (!entry.endedAt) return 'Live';
    return entry.mode === 'Replay' || entry.mode === 'Observed' ? 'Finished' : 'Result unavailable';
}
