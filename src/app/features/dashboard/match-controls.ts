import { computed, signal } from '@angular/core';
import { isAbortError } from '@w3booster/sdk';
import type { MatchScoreSide, OpenWindowOptions, W3BoosterClient } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../../domain';

type MatchVisionHost = W3BoosterClient<MatchVisionSettings>['host'];
type HostClient<TMethod extends keyof MatchVisionHost> = {
    readonly host: Pick<MatchVisionHost, TMethod>;
};

/** Shared optimistic controller for the regular and compact match dashboards. */
export class MatchControls {
    private readonly lifetime = new AbortController();
    private readonly reverseOverride = signal<boolean | null>(null);
    private readonly pendingOperations = signal(0);
    private readonly actionError = signal('');
    private reverseQueue: Promise<void> = Promise.resolve();
    private reverseRevision = 0;
    private actionRevision = 0;
    readonly busy = computed(() => this.pendingOperations() > 0);
    readonly error = this.actionError.asReadonly();

    displayedReversePlayerOrder(saved: boolean): boolean {
        return this.reverseOverride() ?? saved;
    }

    reconcileReversePlayerOrder(saved: boolean): void {
        const pending = this.reverseOverride();
        if (pending !== null && pending === saved) this.reverseOverride.set(null);
    }

    async changeScore(client: HostClient<'changeMatchScore'>, side: MatchScoreSide, delta: 1 | -1): Promise<void> {
        await this.perform(
            () => client.host.changeMatchScore(side, delta, { signal: this.lifetime.signal }),
            'The match score could not be updated.'
        );
    }

    async resetScore(client: HostClient<'resetMatchScore'>): Promise<void> {
        await this.perform(
            () => client.host.resetMatchScore({ signal: this.lifetime.signal }),
            'The match score could not be reset.'
        );
    }

    async openWindow(client: HostClient<'openWindow'>, options: OpenWindowOptions): Promise<void> {
        await this.perform(
            () => client.host.openWindow(options, { signal: this.lifetime.signal }),
            'The compact Match Vision window could not be opened.'
        );
    }

    async reversePlayers(client: HostClient<'setSetting'>, matchId: string, saved: boolean): Promise<void> {
        const next = !this.displayedReversePlayerOrder(saved);
        const revision = ++this.reverseRevision;
        this.reverseOverride.set(next);
        const operation = this.reverseQueue.then(async () => {
            await client.host.setSetting(
                'observer.reversePlayerOrderMatchId',
                next ? matchId : '',
                { signal: this.lifetime.signal }
            );
        });
        this.reverseQueue = operation.catch(() => undefined);
        const savedSuccessfully = await this.perform(
            () => operation,
            'The player order could not be saved.'
        );
        if (!savedSuccessfully) {
            if (revision === this.reverseRevision) this.reverseOverride.set(null);
        }
    }

    clearError(): void { this.actionError.set(''); }
    destroy(): void { this.lifetime.abort(); }

    private async perform(action: () => Promise<unknown>, message: string): Promise<boolean> {
        const revision = ++this.actionRevision;
        this.actionError.set('');
        this.pendingOperations.update(count => count + 1);
        try {
            await action();
            return true;
        } catch (error) {
            if (isAbortError(error)) return false;
            if (revision === this.actionRevision) this.actionError.set(message);
            console.error(message, error);
            return false;
        } finally {
            this.pendingOperations.update(count => Math.max(0, count - 1));
        }
    }
}
