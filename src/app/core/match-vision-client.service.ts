import { computed, Injectable, signal } from '@angular/core';
import { classifyW3BoosterError, isAbortError, UNAVAILABLE_HOST_SNAPSHOT } from '@w3booster/sdk';
import type { ConnectionRetrySnapshot, HostLifecycleSnapshot } from '@w3booster/sdk';
import { createSelectorStore } from '@w3booster/sdk/store';
import { connectionOptions } from './match-vision.config';
import { w3boosterApp } from './w3booster-app.generated';
import type { W3BoosterAppClient, W3BoosterAppRuntime, W3BoosterAppRuntimeSnapshot } from './w3booster-app.generated';

@Injectable({ providedIn: 'root' })
export class MatchVisionClientService {
    private readonly connection = signal<MatchVisionConnection>({
        client: null,
        status: 'idle',
        state: null,
        isSynchronized: false,
        retry: null,
        error: null,
        errorMessage: '',
        settings: w3boosterApp.settingsDefaults,
        host: UNAVAILABLE_HOST_SNAPSHOT
    });
    private runtime: W3BoosterAppRuntime | null = null;
    private unsubscribeRuntime: (() => void) | null = null;
    private startup: Promise<W3BoosterAppClient | null> | null = null;
    private generation = 0;

    readonly client = computed(() => this.connection().client);
    readonly state = computed(() => this.connection().state);
    readonly status = computed(() => this.connection().status);
    readonly error = computed(() => this.connection().errorMessage);
    readonly synchronized = computed(() => this.connection().isSynchronized);
    readonly retry = computed(() => this.connection().retry);
    readonly settings = computed(() => this.connection().settings);
    readonly host = computed(() => this.connection().host);

    async start(search: string): Promise<W3BoosterAppClient | null> {
        if (this.startup) return this.startup;
        const connection = this.connection();
        if (connection.client && connection.isSynchronized) return connection.client;
        if (this.runtime) {
            const runtime = this.runtime;
            const generation = this.generation;
            const operation = this.resumeRuntime(runtime, generation);
            this.startup = operation;
            try { return await operation; }
            finally { if (this.startup === operation) this.startup = null; }
        }
        const generation = ++this.generation;
        const operation = this.startClient(search, generation);
        this.startup = operation;
        try { return await operation; }
        finally { if (this.startup === operation) this.startup = null; }
    }

    private async resumeRuntime(
        runtime: W3BoosterAppRuntime,
        generation: number
    ): Promise<W3BoosterAppClient | null> {
        try {
            const client = await runtime.start();
            if (this.runtime !== runtime || this.generation !== generation) return null;
            return client;
        } catch (error: unknown) {
            if (this.runtime !== runtime || this.generation !== generation || isAbortError(error)) return null;
            console.error('W3Booster SDK connection failed:', error);
            return null;
        }
    }

    private async startClient(search: string, generation: number): Promise<W3BoosterAppClient | null> {
        await this.closeCurrentClient();
        if (this.generation !== generation) return null;
        const options = connectionOptions(search);
        if (options.demo && typeof options.demo === 'object') {
            const { createMatchVisionDemo } = await import('./match-vision-demo');
            options.demo = { ...options.demo, state: createMatchVisionDemo() };
            if (this.generation !== generation) return null;
        }
        const runtime = w3boosterApp.createRuntime(options);
        this.runtime = runtime;

        try {
            let reportedError: unknown = null;
            const connectionStore = createSelectorStore(runtime.lifecycle, connectionView);
            this.unsubscribeRuntime = connectionStore.subscribe(connection => {
                if (connection.error && connection.error !== reportedError) {
                    reportedError = connection.error;
                    console.warn('W3Booster SDK:', connection.error);
                } else if (!connection.error) {
                    reportedError = null;
                }
                this.connection.set(connection);
            });
            runtime.client.on('issue', issue => {
                if (issue.source === 'recorder' || issue.source === 'listener') {
                    console.warn(`W3Booster SDK ${issue.source} issue:`, issue.error);
                }
            }, { signal: runtime.signal });

            // Startup remains pending across broker reconnects until a fresh
            // complete state is available or the application lifetime ends.
            const connectedClient = await runtime.start();
            if (this.runtime !== runtime || this.generation !== generation) return null;
            return connectedClient;
        } catch (error: unknown) {
            if (this.runtime !== runtime || this.generation !== generation || isAbortError(error)) return null;
            this.runtime = null;
            this.unsubscribeRuntime?.();
            this.unsubscribeRuntime = null;
            await runtime.stop();
            console.error('W3Booster SDK connection failed:', error);
            this.connection.set({
                client: null,
                status: 'error',
                state: null,
                isSynchronized: false,
                retry: null,
                error,
                errorMessage: connectionErrorMessage(error),
                settings: w3boosterApp.settingsDefaults,
                host: UNAVAILABLE_HOST_SNAPSHOT
            });
            return null;
        }
    }

    async stop(): Promise<void> {
        const generation = ++this.generation;
        this.startup = null;
        await this.closeCurrentClient();
        if (this.generation !== generation) return;
        this.connection.set({
            client: null,
            status: 'closed',
            state: null,
            isSynchronized: false,
            retry: null,
            error: null,
            errorMessage: '',
            settings: w3boosterApp.settingsDefaults,
            host: UNAVAILABLE_HOST_SNAPSHOT
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
        await runtime?.stop();
    }
}

interface MatchVisionConnection {
    readonly client: W3BoosterAppClient | null;
    readonly status: W3BoosterAppRuntimeSnapshot['status'];
    readonly state: W3BoosterAppRuntimeSnapshot['state'];
    readonly isSynchronized: boolean;
    readonly retry: MatchVisionConnectionRetry | null;
    readonly error: unknown | null;
    readonly errorMessage: string;
    readonly settings: W3BoosterAppRuntimeSnapshot['settings'];
    readonly host: HostLifecycleSnapshot;
}

export type MatchVisionConnectionRetry = ConnectionRetrySnapshot;

function connectionView(
    snapshot: W3BoosterAppRuntimeSnapshot
): MatchVisionConnection {
    return {
        client: snapshot.client,
        status: snapshot.status,
        state: snapshot.state,
        isSynchronized: snapshot.isSynchronized,
        retry: snapshot.retry,
        error: snapshot.error,
        settings: snapshot.settings,
        host: snapshot.host,
        errorMessage: snapshot.error ? connectionErrorMessage(snapshot.error) : ''
    };
}

export function connectionErrorMessage(error: unknown): string {
    const problem = classifyW3BoosterError(error);
    if (problem.kind === 'permission') return 'Enable and open Match Vision from W3Booster.';
    if (problem.code === 'APPLICATION_DEFINITION_MISMATCH') {
        return 'Match Vision is outdated for this W3Booster environment. Regenerate and redeploy its application binding.';
    }
    if (problem.code === 'CONFIGURATION') return 'Match Vision is not configured in this W3Booster environment.';
    if (problem.code === 'STARTUP_TIMEOUT') return 'W3Booster did not start before the connection deadline.';
    if (problem.code === 'STATE_TIMEOUT') return 'W3Booster connected, but no match data arrived.';
    if (problem.code === 'MISSING_BROWSER_API') return 'This browser cannot connect to W3Booster.';
    if (problem.kind === 'connection') return 'W3Booster is unavailable. Start W3Booster and try again.';
    return error instanceof Error ? error.message : 'Match Vision could not connect to W3Booster.';
}
