import { Component, input, output } from '@angular/core';
import type { MatchHistoryEntry } from './match-history.store';

export type MatchHistoryModeFilter = 'All' | 'Match' | 'Observed' | 'Replay';

export function filterMatchHistory(entries: readonly MatchHistoryEntry[], mode: MatchHistoryModeFilter): readonly MatchHistoryEntry[] {
    return mode === 'All' ? entries : entries.filter(entry => entry.mode === mode);
}

@Component({
    selector: 'mv-match-history-filter',
    template: `
        <select aria-label="Filter match history" [value]="value()" (change)="valueChange.emit($any($event.target).value)">
            <option value="All">All modes</option>
            <option value="Match">Match</option>
            <option value="Observed">Observed</option>
            <option value="Replay">Replay</option>
        </select>
    `,
    styles: `
        :host { display: inline-flex; flex: 0 0 auto; }
        select { max-width: 100%; padding: 2px 5px; border: 1px solid #344650; border-radius: 3px;
            background: #172229; color: #c7d5dd; color-scheme: dark; font: inherit; font-size: .9em; cursor: pointer; }
        select:focus-visible { outline: 2px solid #56bce9; outline-offset: 2px; }
    `
})
export class MatchHistoryFilterComponent {
    readonly value = input<MatchHistoryModeFilter>('All');
    readonly valueChange = output<MatchHistoryModeFilter>();
}
