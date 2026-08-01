import { signal } from '@angular/core';
import type { MatchState, W3BoosterClient } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../../domain';

export interface MatchHistoryEntry {
    id: string;
    map: string;
    mode: string;
    startedAt: string;
    endedAt?: string;
    players: Array<{ name: string; race: string; team: number }>;
}

const HISTORY_KEY = 'w3booster:match-vision:matches';

export class MatchHistoryStore {
    private readonly history = signal<MatchHistoryEntry[]>(this.read());
    private subscriptions: Array<() => void> = [];
    readonly entries = this.history.asReadonly();

    constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {}

    connect(client: W3BoosterClient<MatchVisionSettings>): void {
        this.disconnect();
        this.subscriptions = [
            client.on('match.started', event => this.record(event.state)),
            client.on('match.ended', event => this.finish(event.match.id))
        ];
    }

    disconnect(): void {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
    }

    record(state: MatchState<MatchVisionSettings>): void {
        if (!state.match.id || this.history().some(item => item.id === String(state.match.id))) return;
        this.history.update(entries => [{
            id: String(state.match.id),
            map: state.match.map || 'Unknown map',
            mode: state.match.isReplay ? 'Replay' : (state.match.isObserver ? 'Observed' : 'Match'),
            startedAt: String(state.match.startedAt || new Date().toISOString()),
            players: state.players.map(player => ({
                name: player.mainAccount?.name || player.name || 'Unknown player',
                race: player.race || 'random',
                team: Number(player.team || 0)
            }))
        }, ...entries].slice(0, 20));
        this.write();
    }

    finish(id: string): void {
        this.history.update(entries => entries.map(entry => entry.id === String(id)
            ? { ...entry, endedAt: new Date().toISOString() }
            : entry));
        this.write();
    }

    private read(): MatchHistoryEntry[] {
        try {
            const value = this.storage.getItem(HISTORY_KEY);
            return value ? JSON.parse(value) : [];
        } catch { return []; }
    }

    private write(): void {
        try { this.storage.setItem(HISTORY_KEY, JSON.stringify(this.history())); }
        catch { /* Storage is optional in embedded/private browser contexts. */ }
    }
}
