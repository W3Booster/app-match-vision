import { signal } from '@angular/core';

const STATS_KEY = 'w3booster:match-vision:show-player-stats';
interface StorageEvents {
    addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
    removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
}

/** Local presentation only: match data and overlay settings stay unchanged. */
export class MatchDisplayPreferences {
    private readonly visible = signal(true);
    readonly showPlayerStats = this.visible.asReadonly();
    private readonly onStorage = (event: StorageEvent) => {
        if ((event.key === STATS_KEY || event.key === null) &&
            (event.storageArea === null || event.storageArea === this.storage)) this.read();
    };

    constructor(
        private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
        private readonly events: StorageEvents = window
    ) {
        this.read();
        this.events.addEventListener('storage', this.onStorage);
    }

    setShowPlayerStats(value: boolean): void {
        this.visible.set(value);
        try { this.storage.setItem(STATS_KEY, String(value)); }
        catch { /* The toggle still works when browser storage is unavailable. */ }
    }

    destroy(): void { this.events.removeEventListener('storage', this.onStorage); }

    private read(): void {
        try { this.visible.set(this.storage.getItem(STATS_KEY) !== 'false'); }
        catch { this.visible.set(true); }
    }
}
