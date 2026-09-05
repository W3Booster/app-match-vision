import { signal } from '@angular/core';
import type { JsonObject, JsonValue, W3BoosterClient } from '@w3booster/sdk';
import { isAbortError } from '@w3booster/sdk';
import { recordedResultFromState, updateScore, type RecordedResult, type ScoreAction, type ScoreContext, type ScoreDocument } from '../../domain/automatic-score';

type ScoreHost = Pick<W3BoosterClient['host'], 'command'>;

/** One app-owned writer per surface; host CAS serializes separate windows. */
export class AutomaticScoreController {
    readonly document = signal<ScoreDocument | null>(null);
    readonly error = signal('');
    readonly busy = signal(false);
    private lifetime: AbortController | null = null;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private queue: Promise<unknown> = Promise.resolve();
    private host: ScoreHost | null = null;
    private readonly results = new Map<string, RecordedResult>();

    connect(host: ScoreHost, state: W3BoosterClient<object>['state']): void {
        this.disconnect();
        this.host = host;
        const lifetime = this.lifetime = new AbortController();
        state.subscribe(snapshot => {
            const result = recordedResultFromState(snapshot);
            if (result && !this.results.has(result.id)) {
                this.results.set(result.id, result);
                void this.run();
            }
        }, { signal: lifetime.signal });
        const poll = async () => {
            await this.run();
            if (!lifetime.signal.aborted) this.timer = setTimeout(poll, 1000);
        };
        void poll();
    }

    disconnect(): void {
        this.lifetime?.abort();
        clearTimeout(this.timer);
        this.host = null;
        this.results.clear();
        this.document.set(null);
    }

    async run(action?: ScoreAction): Promise<void> {
        const host = this.host;
        const lifetime = this.lifetime;
        if (!host || !lifetime || lifetime.signal.aborted) return;
        if (action) this.busy.set(true);
        const operation = this.queue.then(async () => {
            if (lifetime.signal.aborted) return;
            for (let attempt = 0; attempt < 5; attempt++) {
                const stored = await host.command('application.storage.get', undefined, { signal: lifetime.signal, parse: parseStoredScore });
                const results = [...this.results.values()];
                const context: ScoreContext = {
                    document: {
                        revision: stored.revision,
                        wins: stored.data['matchScore']?.wins ?? 0,
                        losses: stored.data['matchScore']?.losses ?? 0,
                        lastUpdate: stored.data['matchScore']?.lastUpdate ?? 0,
                        automatic: stored.data['automaticScore']?.enabled ?? true,
                        processedResults: stored.data['automaticScore']?.processedResults ?? []
                    },
                    results
                };
                const next = updateScore(context, Date.now(), action);
                if (JSON.stringify(next) === JSON.stringify(context.document)) {
                    this.document.set(context.document);
                    next.processedResults.forEach(id => this.results.delete(id));
                    return;
                }
                const result = await host.command('application.storage.commit', {
                    expectedRevision: context.document.revision,
                    data: {
                        ...stored.data,
                        matchScore: { wins: next.wins, losses: next.losses, lastUpdate: next.lastUpdate },
                        automaticScore: { enabled: next.automatic, processedResults: next.processedResults }
                    }
                }, { signal: lifetime.signal, parse: parseScoreCommit });
                if (result.committed) {
                    this.document.set({ ...next, revision: next.revision + 1 });
                    next.processedResults.forEach(id => this.results.delete(id));
                    return;
                }
            }
            throw new Error('The score is changing in another window. Please try again.');
        });
        this.queue = operation.catch(() => {});
        try {
            await operation;
            if (!lifetime.signal.aborted) this.error.set('');
        } catch (error) {
            if (!lifetime.signal.aborted && !isAbortError(error)) {
                this.error.set(action ? 'The score change could not be saved. Please try again.' : 'Automatic scoring is unavailable. Retrying…');
                console.warn('Match Vision score update failed:', error);
            }
        } finally {
            if (action) this.busy.set(false);
        }
    }
}

interface StoredScore {
    revision: number;
    data: JsonObject & {
        matchScore?: { wins: number; losses: number; lastUpdate: number };
        automaticScore?: { enabled: boolean; processedResults: string[] };
    };
}

export function parseStoredScore(value: unknown): StoredScore {
    if (!isRecord(value) || !isCount(value['revision']) || !isRecord(value['data']) || !isJson(value['data'])) {
        throw new TypeError('Invalid application storage response.');
    }
    const score = value['data']['matchScore'];
    const automatic = value['data']['automaticScore'];
    if (score !== undefined && (!isRecord(score) || !isCount(score['wins']) || !isCount(score['losses']) || !isCount(score['lastUpdate']))) {
        throw new TypeError('Invalid stored match score.');
    }
    if (automatic !== undefined && (!isRecord(automatic) || typeof automatic['enabled'] !== 'boolean' ||
        !Array.isArray(automatic['processedResults']) || !automatic['processedResults'].every(id => typeof id === 'string' && id.length > 0))) {
        throw new TypeError('Invalid stored automatic score settings.');
    }
    return value as unknown as StoredScore;
}

export function parseScoreCommit(value: unknown): { committed: boolean } {
    if (!isRecord(value) || typeof value['committed'] !== 'boolean') throw new TypeError('Invalid score commit response.');
    return { committed: value['committed'] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
function isCount(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}
function isJson(value: unknown, depth = 0): value is JsonValue {
    if (depth > 64) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(item => isJson(item, depth + 1));
    return isRecord(value) && Object.entries(value).every(([key, item]) =>
        !['__proto__', 'prototype', 'constructor'].includes(key) && isJson(item, depth + 1));
}
