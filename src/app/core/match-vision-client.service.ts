import { computed, Injectable, signal } from '@angular/core';
import { classifyW3BoosterError, ConnectionError, isAbortError } from '@w3booster/sdk';
import type { HostLifecycleSnapshot, W3BoosterClient } from '@w3booster/sdk';
import type { ApplicationRuntime, ApplicationRuntimeSnapshot } from '@w3booster/sdk/app';
import { connectionOptions } from './match-vision.config';
import type { MatchVisionSettings } from '../domain/match-vision-settings';
import { w3boosterApp } from './w3booster-app.generated';
import type { W3BoosterAppSettings } from './w3booster-app.generated';

const UNAVAILABLE_HOST: HostLifecycleSnapshot = Object.freeze({
    available: false,
    capabilities: Object.freeze([]),
    capabilityStatus: 'unavailable'
});

@Injectable({ providedIn: 'root' })
export class MatchVisionClientService {
    private readonly connection = signal<MatchVisionConnection>({
        client: null,
        status: 'idle',
        state: null,
        isSynchronized: false,
        error: null,
        errorMessage: '',
        host: UNAVAILABLE_HOST
    });
    private runtime: ApplicationRuntime<W3BoosterAppSettings> | null = null;
    private unsubscribeRuntime: (() => void) | null = null;
    private unsubscribeIssues: (() => void) | null = null;
    private startup: Promise<W3BoosterClient<MatchVisionSettings> | null> | null = null;

    readonly client = computed(() => this.connection().client);
    readonly state = computed(() => this.connection().state);
    readonly status = computed(() => this.connection().status);
    readonly error = computed(() => this.connection().errorMessage);
    readonly synchronized = computed(() => this.connection().isSynchronized);
    readonly host = computed(() => this.connection().host);

    async start(search: string): Promise<W3BoosterClient<MatchVisionSettings> | null> {
        const current = this.connection().client;
        if (current && (current.status === 'connected' || current.status === 'reconnecting')) return current;
        if (this.startup) return this.startup;
        const operation = this.startClient(search);
        this.startup = operation;
        try { return await operation; }
        finally { if (this.startup === operation) this.startup = null; }
    }

    private async startClient(search: string): Promise<W3BoosterClient<MatchVisionSettings> | null> {
        await this.closeCurrentClient();
        const runtime = w3boosterApp.createRuntime(connectionOptions(search));
        this.runtime = runtime;
        this.connection.set({
            client: runtime.client,
            status: 'connecting',
            state: null,
            isSynchronized: false,
            error: null,
            errorMessage: '',
            host: runtime.client.host.lifecycle.get()
        });

        try {
            let reportedError: unknown = null;
            this.unsubscribeRuntime = runtime.lifecycle.subscribe(snapshot => {
                if (snapshot.error && snapshot.error !== reportedError) {
                    reportedError = snapshot.error;
                    console.warn('W3Booster SDK:', snapshot.error);
                } else if (!snapshot.error) {
                    reportedError = null;
                }
                this.connection.set(connectionView(snapshot));
            });
            this.unsubscribeIssues = runtime.client.on('issue', issue => {
                if (issue.source === 'recorder' || issue.source === 'listener') {
                    console.warn(`W3Booster SDK ${issue.source} issue:`, issue.error);
                }
            });

            // Startup remains pending across broker reconnects until a fresh
            // complete state is available or the application lifetime ends.
            const connectedClient = await runtime.start();
            if (this.runtime !== runtime) return null;
            const initialState = connectedClient.state.get();
            if (!initialState) throw new ConnectionError('W3Booster synchronized without match state.', [], 'STATE_TIMEOUT');
            this.connection.set(connectionView(runtime.lifecycle.get()));
            return connectedClient;
        } catch (error: unknown) {
            if (this.runtime !== runtime || isAbortError(error)) return null;
            this.runtime = null;
            this.unsubscribeRuntime?.();
            this.unsubscribeRuntime = null;
            this.unsubscribeIssues?.();
            this.unsubscribeIssues = null;
            await runtime.stop();
            console.error('W3Booster SDK connection failed:', error);
            this.connection.set({
                client: null,
                status: 'error',
                state: null,
                isSynchronized: false,
                error,
                errorMessage: connectionErrorMessage(error),
                host: UNAVAILABLE_HOST
            });
            return null;
        }
    }

    async stop(): Promise<void> {
        await this.closeCurrentClient();
        this.connection.set({
            client: null,
            status: 'closed',
            state: null,
            isSynchronized: false,
            error: null,
            errorMessage: '',
            host: UNAVAILABLE_HOST
        });
    }

    private async closeCurrentClient(): Promise<void> {
        const runtime = this.runtime;
        this.runtime = null;
        this.connection.update(current => ({
            ...current,
            client: null,
            state: null,
            isSynchronized: false
        }));
        this.unsubscribeRuntime?.();
        this.unsubscribeRuntime = null;
        this.unsubscribeIssues?.();
        this.unsubscribeIssues = null;
        await runtime?.stop();
    }
}

interface MatchVisionConnection {
    readonly client: W3BoosterClient<MatchVisionSettings> | null;
    readonly status: ApplicationRuntimeSnapshot<W3BoosterAppSettings>['status'];
    readonly state: ApplicationRuntimeSnapshot<W3BoosterAppSettings>['state'];
    readonly isSynchronized: boolean;
    readonly error: unknown | null;
    readonly errorMessage: string;
    readonly host: HostLifecycleSnapshot;
}

function connectionView(
    snapshot: ApplicationRuntimeSnapshot<W3BoosterAppSettings>
): MatchVisionConnection {
    return {
        client: snapshot.client,
        status: snapshot.status,
        state: snapshot.state,
        isSynchronized: snapshot.isSynchronized,
        error: snapshot.error,
        host: snapshot.host,
        errorMessage: snapshot.error ? connectionErrorMessage(snapshot.error) : ''
    };
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
