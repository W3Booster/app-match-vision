import { signal } from '@angular/core';
import type { MatchScoreSide, W3BoosterClient } from '@w3booster/sdk';
import type { MatchVisionSettings } from '../../domain';

/** Shared optimistic controller for the regular and compact match dashboards. */
export class MatchControls {
    private readonly reverseOverride = signal<boolean | null>(null);
    private reverseQueue: Promise<void> = Promise.resolve();
    private reverseRevision = 0;

    displayedReversePlayerOrder(saved: boolean): boolean {
        return this.reverseOverride() ?? saved;
    }

    reconcileReversePlayerOrder(saved: boolean): void {
        const pending = this.reverseOverride();
        if (pending !== null && pending === saved) this.reverseOverride.set(null);
    }

    async changeScore(client: W3BoosterClient<MatchVisionSettings>, side: MatchScoreSide, delta: 1 | -1): Promise<void> {
        try { await client.host.changeMatchScoreAndWait(side, delta); }
        catch (error) { console.error('Could not update the match score:', error); }
    }

    async resetScore(client: W3BoosterClient<MatchVisionSettings>): Promise<void> {
        try { await client.host.resetMatchScoreAndWait(); }
        catch (error) { console.error('Could not reset the match score:', error); }
    }

    async reversePlayers(client: W3BoosterClient<MatchVisionSettings>, matchId: string, saved: boolean): Promise<void> {
        const next = !this.displayedReversePlayerOrder(saved);
        const revision = ++this.reverseRevision;
        this.reverseOverride.set(next);
        const operation = this.reverseQueue.then(async () => {
            await client.host.setSetting('observer.reversePlayerOrderMatchId', next ? matchId : '');
        });
        this.reverseQueue = operation.catch(() => undefined);
        try {
            await operation;
        } catch (error) {
            if (revision === this.reverseRevision) this.reverseOverride.set(null);
            console.error('Could not reverse the player order:', error);
        }
    }
}
