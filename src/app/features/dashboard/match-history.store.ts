import { type Signal, signal, type WritableSignal } from '@angular/core';
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
    private readonly history: WritableSignal<MatchHistoryEntry[]>;
    private lifetime: AbortController | null = null;
    readonly entries: Signal<MatchHistoryEntry[]>;

    constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
        this.history = signal<MatchHistoryEntry[]>(this.read());
        this.entries = this.history.asReadonly();
    }

    connect(client: W3BoosterClient<MatchVisionSettings>): void {
        this.disconnect();
        const lifetime = new AbortController();
        this.lifetime = lifetime;
        // State subscriptions include the current snapshot (which is null
        // before hydration); domain events describe only later transitions.
        client.state.subscribe(state => {
            if (state?.match.status === 'running') this.record(state);
        }, { signal: lifetime.signal });
        client.on('match.ended', event => this.finish(event.match.id), { signal: lifetime.signal });
    }

    disconnect(): void {
        this.lifetime?.abort();
        this.lifetime = null;
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
            if (!value) return [];
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter(isMatchHistoryEntry).slice(0, 20) : [];
        } catch { return []; }
    }

    private write(): void {
        try { this.storage.setItem(HISTORY_KEY, JSON.stringify(this.history())); }
        catch { /* Storage is optional in embedded/private browser contexts. */ }
    }
}

function isMatchHistoryEntry(value: unknown): value is MatchHistoryEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<MatchHistoryEntry>;
    return typeof entry.id === 'string' && entry.id.length > 0 &&
        typeof entry.map === 'string' &&
        typeof entry.mode === 'string' &&
        typeof entry.startedAt === 'string' && Number.isFinite(Date.parse(entry.startedAt)) &&
        (entry.endedAt === undefined || typeof entry.endedAt === 'string' && Number.isFinite(Date.parse(entry.endedAt))) &&
        Array.isArray(entry.players) && entry.players.every(player =>
            player !== null && typeof player === 'object' &&
            typeof player.name === 'string' &&
            typeof player.race === 'string' &&
            Number.isFinite(player.team));
}
