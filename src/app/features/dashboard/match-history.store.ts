import { type Signal, signal, type WritableSignal } from '@angular/core';
import type { MatchLifecycleObservationEvent, MatchLifecycleSubscriptionOptions, MatchState, SubscriptionOptions } from '@w3booster/sdk';
import { playerDisplayIdentity } from '@w3booster/sdk/selectors';
import type { MatchVisionSettings } from '../../domain';

export interface MatchHistoryEntry {
    id: string;
    map: string;
    mode: string;
    startedAt: string;
    startedAtSource?: 'match' | 'observed';
    endedAt?: string;
    endedAtSource?: 'match' | 'observed';
    result?: { playerId: string; outcome: 'won' | 'lost' };
    players: Array<{ id?: string; name: string; race: string; team: number | null }>;
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
        options?: MatchLifecycleSubscriptionOptions
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
                if (event.state.match.id === event.match.id) {
                    this.record(event.state, event.match.startedAt ?? event.observedAt);
                }
                const endedAt = event.match.endedAt;
                this.finish(event.match.id, endedAt ?? event.observedAt, endedAt ? 'match' : 'observed');
            }
        }, { signal: lifetime.signal, includeCurrentFinished: true });
        client.state.subscribe(state => {
            // Null and an ungranted neutral match do not establish that a game ended.
            if (!state || !state.capabilities.includes('match')) return;
            if (state?.match.status === 'running' || state?.match.status === 'starting') {
                this.record(state);
            } else if (state?.match.status === 'finished') {
                const observedAt = new Date().toISOString();
                this.record(state, state.match.startedAt ?? state.match.endedAt ?? observedAt);
                this.finish(
                    state.match.id,
                    state.match.endedAt ?? observedAt,
                    state.match.endedAt ? 'match' : 'observed'
                );
            } else if (state.match.status === 'none') {
                this.closeOtherMatches();
            }
        }, { signal: lifetime.signal });
    }

    disconnect(): void {
        this.lifetime?.abort();
        this.lifetime = null;
    }

    record(state: MatchState<MatchVisionSettings>, observedAt = new Date().toISOString()): void {
        if (!state.match.id) return;
        const id = String(state.match.id);
        // Current state is a single match, including after an app reload that missed
        // an end event. Older unfinished entries can no longer be live.
        this.closeOtherMatches(id);
        const players: MatchHistoryEntry['players'] = state.players.map(player => {
            const identity = playerDisplayIdentity(player);
            const hasDisplayName = Boolean(player.name?.trim() || player.mainAccount?.name?.trim());
            return {
                id: String(player.id),
                name: hasDisplayName ? (player.name?.trim() ? identity.inGameName : identity.primaryName) : 'Unknown player',
                race: player.race || 'random',
                team: typeof player.team === 'number' && Number.isFinite(player.team) ? player.team : null
            };
        });
        const candidate: MatchHistoryEntry = {
            id: String(state.match.id),
            map: state.match.map || 'Unknown map',
            mode: state.match.isReplay ? 'Replay' : (state.match.isObserver ? 'Observed' : 'Match'),
            startedAt: String(state.match.startedAt || observedAt),
            startedAtSource: (state.match.startedAt ? 'match' : 'observed') as 'match' | 'observed',
            players
        };
        const result = confirmedHistoryResult(state);
        if (result) candidate.result = result;
        let changed = false;
        this.history.update(entries => {
            const existingIndex = entries.findIndex(item => item.id === id);
            if (existingIndex === -1) {
                changed = true;
                return [candidate, ...entries].slice(0, 20);
            }

            const existing = entries[existingIndex]!;
            const authoritativeStart = state.match.startedAt
                ? { startedAt: String(state.match.startedAt), startedAtSource: 'match' as const }
                : { startedAt: existing.startedAt, startedAtSource: existing.startedAtSource };
            const nextPlayers = mergeHistoryPlayers(players, existing.players);
            const reconciled: MatchHistoryEntry = {
                ...existing,
                map: state.match.map || existing.map,
                mode: candidate.mode,
                ...authoritativeStart,
                ...(result ? { result } : {}),
                players: nextPlayers
            };
            if (sameHistoryEntry(existing, reconciled)) return entries;
            changed = true;
            return entries.map((entry, index) => index === existingIndex ? reconciled : entry);
        });
        if (changed) this.write();
    }

    finish(
        id: string,
        endedAt = new Date().toISOString(),
        source: 'match' | 'observed' = 'observed'
    ): void {
        let changed = false;
        this.history.update(entries => entries.map(entry => {
            if (entry.id !== String(id)) return entry;
            if (source === 'observed' && entry.endedAt) return entry;
            if (entry.endedAt === endedAt && entry.endedAtSource === source) return entry;
            changed = true;
            return { ...entry, endedAt, endedAtSource: source };
        }));
        if (changed) this.write();
    }

    private read(): MatchHistoryEntry[] {
        try {
            const value = this.storage.getItem(HISTORY_KEY);
            if (!value) return [];
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter(isMatchHistoryEntry).slice(0, 20) : [];
        } catch { return []; }
    }

    private closeOtherMatches(currentId?: string, observedAt = new Date().toISOString()): void {
        let changed = false;
        this.history.update(entries => entries.map(entry => {
            if (entry.id === currentId || entry.endedAt) return entry;
            changed = true;
            return { ...entry, endedAt: observedAt, endedAtSource: 'observed' as const };
        }));
        if (changed) this.write();
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
        (entry.result === undefined || isHistoryResult(entry.result)) &&
        Array.isArray(entry.players) && entry.players.every(player =>
            player !== null && typeof player === 'object' &&
            (player.id === undefined || typeof player.id === 'string') &&
            typeof player.name === 'string' &&
            typeof player.race === 'string' &&
            (player.team === null || Number.isFinite(player.team)));
}

function mergeHistoryPlayers(
    candidate: MatchHistoryEntry['players'],
    existing: MatchHistoryEntry['players']
): MatchHistoryEntry['players'] {
    const usedExisting = new Set<number>();
    const merged = candidate.map((player, index) => {
        let existingIndex = player.id
            ? existing.findIndex(previous => previous.id === player.id)
            : -1;
        // History written before player IDs were persisted can only be
        // reconciled positionally. Claim that legacy slot once, then persist
        // the hydrated ID so every later update uses stable identity.
        if (existingIndex < 0 && index < existing.length &&
            existing[index]?.id === undefined && !usedExisting.has(index)) {
            existingIndex = index;
        }
        const previous = existingIndex >= 0 ? existing[existingIndex] : undefined;
        if (existingIndex >= 0) usedExisting.add(existingIndex);
        if (!previous) return player;
        return {
            id: player.id ?? previous.id,
            name: player.name !== 'Unknown player' ? player.name : previous.name,
            race: player.race !== 'random' ? player.race : previous.race,
            team: player.team !== null ? player.team : previous.team
        };
    });
    existing.forEach((player, index) => {
        if (!usedExisting.has(index) && !candidate.some(next => next.id && next.id === player.id)) merged.push(player);
    });
    return merged;
}

function sameHistoryEntry(left: MatchHistoryEntry, right: MatchHistoryEntry): boolean {
    return left.map === right.map && left.mode === right.mode &&
        left.result?.playerId === right.result?.playerId && left.result?.outcome === right.result?.outcome &&
        left.startedAt === right.startedAt && left.startedAtSource === right.startedAtSource &&
        left.players.length === right.players.length && left.players.every((player, index) => {
            const other = right.players[index];
            return !!other && player.id === other.id && player.name === other.name &&
                player.race === other.race && player.team === other.team;
        });
}

function isHistoryResult(value: unknown): value is NonNullable<MatchHistoryEntry['result']> {
    if (!value || typeof value !== 'object') return false;
    const result = value as Partial<NonNullable<MatchHistoryEntry['result']>>;
    return typeof result.playerId === 'string' && result.playerId.length > 0 &&
        (result.outcome === 'won' || result.outcome === 'lost');
}

function confirmedHistoryResult(state: MatchState<MatchVisionSettings>): MatchHistoryEntry['result'] {
    if (state.match.status !== 'finished' || state.match.isObserver || state.match.isReplay ||
        !('result' in state.match) || !isHistoryResult(state.match.result)) return undefined;
    return { playerId: state.match.result.playerId, outcome: state.match.result.outcome };
}
