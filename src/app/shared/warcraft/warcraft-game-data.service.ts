import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { loadGameData } from '@w3booster/sdk/game-data';
import type { GameData } from '@w3booster/sdk/game-data';
import { MatchVisionClientService } from '../../core/match-vision-client.service';

@Injectable({ providedIn: 'root' })
export class WarcraftGameDataService {
    private readonly client = inject(MatchVisionClientService);
    readonly data = signal<GameData | null>(null);
    readonly status = signal<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

    constructor() {
        const revision = computed(() => this.client.state()?.match.gameDataId);
        effect(onCleanup => {
            const id = revision();
            this.data.set(null);
            this.status.set(id ? 'loading' : 'idle');
            if (!id) return;
            const controller = new AbortController();
            onCleanup(() => controller.abort());
            void loadGameData(id, { signal: controller.signal }).then(data => {
                if (!controller.signal.aborted) { this.data.set(data); this.status.set('ready'); }
            }).catch(error => {
                if (!controller.signal.aborted) {
                    this.status.set('unavailable');
                    console.warn('Warcraft game catalog unavailable:', error);
                }
            });
        });
    }
}
