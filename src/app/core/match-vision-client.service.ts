import { Injectable, signal } from '@angular/core';
import { classifyW3BoosterError, ConnectionError, isAbortError } from '@w3booster/sdk';
import type { ConnectionStatus, MatchState, W3BoosterClient } from '@w3booster/sdk';
import { connectionOptions } from './match-vision.config';
import type { MatchVisionSettings } from '../domain/match-vision-settings';
import { createW3BoosterAppClient } from './w3booster-app.generated';

@Injectable({ providedIn: 'root' })
export class MatchVisionClientService {
    private readonly clientState = signal<W3BoosterClient<MatchVisionSettings> | null>(null);
    private readonly matchState = signal<MatchState<MatchVisionSettings> | null>(null);
    private readonly connectionStatus = signal<ConnectionStatus>('idle');
    private readonly connectionError = signal('');
    private readonly stateSynchronized = signal(false);
    private lifetime: AbortController | null = null;
    private startup: Promise<W3BoosterClient<MatchVisionSettings> | null> | null = null;

    readonly client = this.clientState.asReadonly();
    readonly state = this.matchState.asReadonly();
    readonly status = this.connectionStatus.asReadonly();
    readonly error = this.connectionError.asReadonly();
    readonly synchronized = this.stateSynchronized.asReadonly();

    async start(search: string): Promise<W3BoosterClient<MatchVisionSettings> | null> {
        const current = this.clientState();
        if (current && (current.status === 'connected' || current.status === 'reconnecting')) return current;
        if (this.startup) return this.startup;
        const operation = this.startClient(search);
        this.startup = operation;
        try { return await operation; }
        finally { if (this.startup === operation) this.startup = null; }
    }

    private async startClient(search: string): Promise<W3BoosterClient<MatchVisionSettings> | null> {
        await this.closeCurrentClient();
        const lifetime = new AbortController();
        this.lifetime = lifetime;
        this.connectionError.set('');
        this.connectionStatus.set('connecting');
        let client: W3BoosterClient<MatchVisionSettings> | null = null;

        try {
            client = createW3BoosterAppClient(connectionOptions(search, lifetime.signal));
            this.clientState.set(client);
            let reportedError: unknown = null;
            client.lifecycle.subscribe(snapshot => {
                this.matchState.set(snapshot.state);
                this.connectionStatus.set(snapshot.status);
                this.stateSynchronized.set(snapshot.isSynchronized);
                if (snapshot.error && snapshot.error !== reportedError) {
                    reportedError = snapshot.error;
                    console.warn('W3Booster SDK:', snapshot.error);
                    this.connectionError.set(connectionErrorMessage(snapshot.error));
                } else if (!snapshot.error) {
                    reportedError = null;
                    this.connectionError.set('');
                }
            }, { signal: lifetime.signal });
            client.on('issue', issue => {
                if (issue.source === 'recorder' || issue.source === 'listener') {
                    console.warn(`W3Booster SDK ${issue.source} issue:`, issue.error);
                }
            }, { signal: lifetime.signal });

            // Startup remains pending across broker reconnects until a fresh
            // complete state is available or the application lifetime ends.
            await client.start({ signal: lifetime.signal });
            if (this.lifetime !== lifetime) return null;
            const initialState = client.state.get();
            if (!initialState) throw new ConnectionError('W3Booster synchronized without match state.', [], 'STATE_TIMEOUT');
            this.matchState.set(initialState);
            this.stateSynchronized.set(true);
            return client;
        } catch (error: unknown) {
            if (this.lifetime !== lifetime || lifetime.signal.aborted || isAbortError(error)) return null;
            this.lifetime = null;
            lifetime.abort();
            await client?.disconnect();
            this.clientState.set(null);
            this.matchState.set(null);
            this.stateSynchronized.set(false);
            console.error('W3Booster SDK connection failed:', error);
            this.connectionStatus.set('error');
            this.connectionError.set(connectionErrorMessage(error));
            return null;
        }
    }

    async stop(): Promise<void> {
        await this.closeCurrentClient();
        this.connectionStatus.set('closed');
    }

    private async closeCurrentClient(): Promise<void> {
        const lifetime = this.lifetime;
        this.lifetime = null;
        const client = this.clientState();
        this.clientState.set(null);
        this.matchState.set(null);
        this.stateSynchronized.set(false);
        lifetime?.abort();
        await client?.disconnect();
    }
}

export function connectionErrorMessage(error: unknown): string {
    const problem = classifyW3BoosterError(error);
    if (problem.kind === 'permission') return 'Enable and open Match Vision from W3Booster.';
    if (problem.code === 'CONFIGURATION') return 'Match Vision is not configured in this W3Booster environment.';
    if (problem.code === 'STATE_TIMEOUT') return 'W3Booster connected, but no match data arrived.';
    if (problem.code === 'MISSING_BROWSER_API') return 'This browser cannot connect to W3Booster.';
    if (problem.kind === 'connection') return 'W3Booster is unavailable. Start W3Booster and try again.';
    return error instanceof Error ? error.message : 'Match Vision could not connect to W3Booster.';
}
