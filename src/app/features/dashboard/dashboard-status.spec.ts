import { describe, expect, it } from 'vitest';
import { dashboardStatusLabel } from './dashboard-status';

describe('dashboard status copy', () => {
    it('uses the same connected copy for every dashboard surface', () => {
        expect(dashboardStatusLabel('connected', false)).toBe('Ready');
        expect(dashboardStatusLabel('connected', true)).toBe('Match in progress');
    });

    it('describes the match-data lifecycle rather than the recorder lifecycle', () => {
        expect(dashboardStatusLabel('connecting', false)).toBe('Initializing match data');
        expect(dashboardStatusLabel('reconnecting', false)).toBe('Reconnecting match data');
        expect(dashboardStatusLabel('error', false)).toBe('Match data unavailable');
    });

    it('keeps connected but stale state visibly distinct from synchronized data', () => {
        expect(dashboardStatusLabel('connected', true, false)).toBe('Synchronizing match data');
        expect(dashboardStatusLabel('connected', true, true)).toBe('Match in progress');
    });
});
