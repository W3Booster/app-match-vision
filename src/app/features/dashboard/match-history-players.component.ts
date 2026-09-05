import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { groupPlayersByTeam } from '@w3booster/sdk/selectors';
import { raceInfo } from '@w3booster/sdk/standard-game';
import type { MatchHistoryEntry } from './match-history.store';

@Component({
    selector: 'mv-match-history-players',
    imports: [CommonModule],
    template: `
        <ng-container *ngFor="let team of teams(); let first = first">
            <span class="versus" *ngIf="!first">vs</span>
            <span class="team">
                <span class="player" *ngFor="let player of team.players">
                    <span>{{player.name}}</span>
                    <small [attr.data-race]="race(player.race).id">{{race(player.race).label}}</small>
                </span>
            </span>
        </ng-container>
    `,
    styles: `
        :host { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-width: 0; color: #aeb9bf; }
        .team { display: flex; flex-wrap: wrap; gap: 4px 10px; min-width: 0; }
        .player { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
        .versus { color: #85949e; font-size: .85em; }
        small { padding: 1px 4px; border-radius: 3px; background: #26343d; color: #c7d2d9; font-size: .8em; white-space: nowrap; }
        small[data-race='human'] { background: #203b54; color: #a4d1ff; }
        small[data-race='orc'] { background: #482c29; color: #ffb6a7; }
        small[data-race='undead'] { background: #342b48; color: #d2baff; }
        small[data-race='night-elf'] { background: #203d31; color: #9fe1bd; }
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
