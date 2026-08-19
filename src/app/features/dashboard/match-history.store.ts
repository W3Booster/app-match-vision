import { type Signal, signal, type WritableSignal } from '@angular/core';
import type { MatchLifecycleObservationEvent, MatchState, SubscriptionOptions } from '@w3booster/sdk';
import { matchVisionPlayerDisplayIdentity, type MatchVisionSettings } from '../../domain';

export interface MatchHistoryEntry {
    id: string;
    map: string;
    mode: string;
    startedAt: string;
    startedAtSource?: 'match' | 'observed';
    endedAt?: string;
    endedAtSource?: 'match' | 'observed';
    players: Array<{ name: string; race: string; team: number }>;
}

const HISTORY_KEY = 'w3booster:match-vision:matches';

export interface MatchHistoryClient {
    readonly state: {
        subscribe(
            listener: (state: MatchState<MatchVisionSettings> | null) => void | Promise<void>,
            options?: SubscriptionOptions
        ): () => void;
    };
    subscribeMatchLifecycle(
        listener: (event: MatchLifecycleObservationEvent<MatchVisionSettings>) => void | Promise<void>,
        options?: SubscriptionOptions
    ): () => void;
}

export class MatchHistoryStore {
    private readonly history: WritableSignal<MatchHistoryEntry[]>;
    private lifetime: AbortController | null = null;
    readonly entries: Signal<MatchHistoryEntry[]>;

    constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
        this.history = signal<MatchHistoryEntry[]>(this.read());
        this.entries = this.history.asReadonly();
    }

    connect(client: MatchHistoryClient): void {
        this.disconnect();
        const lifetime = new AbortController();
        this.lifetime = lifetime;
        client.subscribeMatchLifecycle(event => {
            if (event.phase === 'started') this.record(event.state, event.observedAt);
            else {
                const endedAt = event.match.endedAt;
                this.finish(event.match.id, endedAt ?? event.observedAt, endedAt ? 'match' : 'observed');
            }
        }, { signal: lifetime.signal });
        client.state.subscribe(state => {
            if (state?.match.status === 'running' || state?.match.status === 'starting') {
                this.record(state);
            } else if (state?.match.status === 'finished' && state.match.endedAt) {
                this.record(state, state.match.startedAt ?? state.match.endedAt);
                this.finish(state.match.id, state.match.endedAt, 'match');
            }
        }, { signal: lifetime.signal });
    }

    disconnect(): void {
        this.lifetime?.abort();
        this.lifetime = null;
    }

    record(state: MatchState<MatchVisionSettings>, observedAt = new Date().toISOString()): void {
        if (!state.match.id || this.history().some(item => item.id === String(state.match.id))) return;
        this.history.update(entries => [{
            id: String(state.match.id),
            map: state.match.map || 'Unknown map',
            mode: state.match.isReplay ? 'Replay' : (state.match.isObserver ? 'Observed' : 'Match'),
            startedAt: String(state.match.startedAt || observedAt),
            startedAtSource: (state.match.startedAt ? 'match' : 'observed') as 'match' | 'observed',
            players: state.players.map(player => ({
                name: matchVisionPlayerDisplayIdentity(player).primaryName || 'Unknown player',
                race: player.race || 'random',
                team: Number(player.team || 0)
            }))
        }, ...entries].slice(0, 20));
        this.write();
    }

    finish(
        id: string,
        endedAt = new Date().toISOString(),
        source: 'match' | 'observed' = 'observed'
    ): void {
        this.history.update(entries => entries.map(entry => entry.id === String(id)
            ? { ...entry, endedAt, endedAtSource: source }
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
        (entry.startedAtSource === undefined || entry.startedAtSource === 'match' || entry.startedAtSource === 'observed') &&
        (entry.endedAt === undefined || typeof entry.endedAt === 'string' && Number.isFinite(Date.parse(entry.endedAt))) &&
        (entry.endedAtSource === undefined || entry.endedAtSource === 'match' || entry.endedAtSource === 'observed') &&
        Array.isArray(entry.players) && entry.players.every(player =>
            player !== null && typeof player === 'object' &&
            typeof player.name === 'string' &&
            typeof player.race === 'string' &&
            Number.isFinite(player.team));
}
