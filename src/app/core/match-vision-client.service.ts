import { Injectable, signal } from '@angular/core';
import { connect, ConnectionError, PermissionRequiredError } from '@w3booster/sdk';
import type { ConnectionStatus, MatchState, W3BoosterClient } from '@w3booster/sdk';
import { connectionOptions } from './match-vision.config';
import type { MatchVisionSettings } from '../domain/match-vision-settings';

@Injectable({ providedIn: 'root' })
export class MatchVisionClientService {
    private readonly clientState = signal<W3BoosterClient<MatchVisionSettings> | null>(null);
    private readonly matchState = signal<MatchState<MatchVisionSettings> | null>(null);
    private readonly connectionStatus = signal<ConnectionStatus>('idle');
    private readonly connectionError = signal('');
    private subscriptions: Array<() => void> = [];
    private generation = 0;

    readonly client = this.clientState.asReadonly();
    readonly state = this.matchState.asReadonly();
    readonly status = this.connectionStatus.asReadonly();
    readonly error = this.connectionError.asReadonly();

    async start(search: string): Promise<W3BoosterClient<MatchVisionSettings> | null> {
        const generation = ++this.generation;
        await this.closeCurrentClient();
        this.connectionError.set('');
        this.connectionStatus.set('connecting');

        try {
            const client = await connect(connectionOptions(search));
            if (generation !== this.generation) {
                await client.disconnect();
                return null;
            }

            this.clientState.set(client);
            this.connectionStatus.set(client.status);
            this.subscriptions = [
                client.state.subscribe(state => this.matchState.set(state)),
                client.on('status', status => this.connectionStatus.set(status)),
                client.on('error', error => {
                    console.warn('W3Booster SDK:', error);
                    this.connectionError.set(connectionErrorMessage(error));
                })
            ];
            return client;
        } catch (error: unknown) {
            if (generation !== this.generation) return null;
            console.error('W3Booster SDK connection failed:', error);
            this.connectionStatus.set('error');
            this.connectionError.set(connectionErrorMessage(error));
            return null;
        }
    }

    async stop(): Promise<void> {
        this.generation++;
        await this.closeCurrentClient();
        this.connectionStatus.set('closed');
    }

    private async closeCurrentClient(): Promise<void> {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
        const client = this.clientState();
        this.clientState.set(null);
        this.matchState.set(null);
        await client?.disconnect();
    }
}

export function connectionErrorMessage(error: unknown): string {
    if (error instanceof PermissionRequiredError) return 'Enable and open Match Vision from W3Booster.';
    if (error instanceof ConnectionError) return 'W3Booster is unavailable. Start W3Booster and try again.';
    return error instanceof Error ? error.message : 'Match Vision could not connect to W3Booster.';
}
