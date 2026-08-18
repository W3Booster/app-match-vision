import { computed, signal } from '@angular/core';
import { canUseHostCapability } from '@w3booster/sdk';
import type { HostCapability, HostLifecycleSnapshot, MatchScoreSide, OpenWindowOptions, W3BoosterClient } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../../domain';

/** Shared optimistic controller for the regular and compact match dashboards. */
export class MatchControls {
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

    async changeScore(client: W3BoosterClient<MatchVisionSettings>, side: MatchScoreSide, delta: 1 | -1): Promise<void> {
        await this.perform(
            () => client.host.changeMatchScore(side, delta),
            'The match score could not be updated.'
        );
    }

    async resetScore(client: W3BoosterClient<MatchVisionSettings>): Promise<void> {
        await this.perform(
            () => client.host.resetMatchScore(),
            'The match score could not be reset.'
        );
    }

    async openWindow(client: W3BoosterClient<MatchVisionSettings>, options: OpenWindowOptions): Promise<void> {
        await this.perform(
            () => client.host.openWindow(options),
            'The compact Match Vision window could not be opened.'
        );
    }

    async reversePlayers(client: W3BoosterClient<MatchVisionSettings>, matchId: string, saved: boolean): Promise<void> {
        const next = !this.displayedReversePlayerOrder(saved);
        const revision = ++this.reverseRevision;
        this.reverseOverride.set(next);
        const operation = this.reverseQueue.then(async () => {
            await client.host.setSetting('observer.reversePlayerOrderMatchId', next ? matchId : '');
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

    private async perform(action: () => Promise<unknown>, message: string): Promise<boolean> {
        const revision = ++this.actionRevision;
        this.actionError.set('');
        this.pendingOperations.update(count => count + 1);
        try {
            await action();
            return true;
        } catch (error) {
            if (revision === this.actionRevision) this.actionError.set(message);
            console.error(message, error);
            return false;
        } finally {
            this.pendingOperations.update(count => Math.max(0, count - 1));
        }
    }
}

export function hostActionAvailable(
    host: HostLifecycleSnapshot,
    capability: HostCapability
): boolean {
    return canUseHostCapability(host, capability);
}
