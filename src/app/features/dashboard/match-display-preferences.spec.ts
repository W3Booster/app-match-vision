import { describe, expect, it, vi } from 'vitest';
import { MatchDisplayPreferences } from './match-display-preferences';

function fixture() {
    const values = new Map<string, string>();
    const listeners = new Set<(event: StorageEvent) => void>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const events = { addEventListener: (_type: 'storage', fn: (event: StorageEvent) => void) => { listeners.add(fn); },
        removeEventListener: (_type: 'storage', fn: (event: StorageEvent) => void) => { listeners.delete(fn); } };
    return { storage, events, listeners, preferences: new MatchDisplayPreferences(storage, events) };
}

describe('MatchDisplayPreferences', () => {
    it('defaults to visible stats and retains the toggle after reopening a surface', () => {
        const f = fixture();
        expect(f.preferences.showPlayerStats()).toBe(true);
        f.preferences.setShowPlayerStats(false);
        f.preferences.destroy();
        expect(f.listeners.size).toBe(0);
        const reopened = new MatchDisplayPreferences(f.storage, f.events);
        expect(reopened.showPlayerStats()).toBe(false);
        reopened.setShowPlayerStats(true);
        expect(new MatchDisplayPreferences(f.storage, f.events).showPlayerStats()).toBe(true);
    });

    it('synchronizes open compact and dashboard windows and ignores unrelated storage', () => {
        const f = fixture();
        const compact = new MatchDisplayPreferences(f.storage, f.events);
        f.preferences.setShowPlayerStats(false);
        const key = 'w3booster:match-vision:show-player-stats';
        for (const listener of f.listeners) listener({ key: 'other', storageArea: null } as StorageEvent);
        expect(compact.showPlayerStats()).toBe(true);
        for (const listener of f.listeners) listener({ key, storageArea: f.storage } as StorageEvent);
        expect(compact.showPlayerStats()).toBe(false);
        f.preferences.destroy(); compact.destroy();
        expect(f.listeners.size).toBe(0);
    });

    it('keeps the toggle usable when storage access is blocked', () => {
        const storage = { getItem: vi.fn(() => { throw new Error('unavailable'); }), setItem: vi.fn(() => { throw new Error('unavailable'); }) };
        const preferences = new MatchDisplayPreferences(storage, { addEventListener() {}, removeEventListener() {} });
        expect(preferences.showPlayerStats()).toBe(true);
        preferences.setShowPlayerStats(false);
        expect(preferences.showPlayerStats()).toBe(false);
    });

    it('opens the surface when the browser denies access to localStorage itself', () => {
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
        try {
            const preferences = new MatchDisplayPreferences(undefined, { addEventListener() {}, removeEventListener() {} });
            preferences.setShowPlayerStats(false);
            expect(preferences.showPlayerStats()).toBe(false);
            preferences.destroy();
        } finally {
            if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
            else Reflect.deleteProperty(globalThis, 'localStorage');
        }
    });
});
