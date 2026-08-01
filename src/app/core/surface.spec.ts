import { describe, expect, it } from 'vitest';
import { surfaceFromSearch } from './surface';

describe('Match Vision surfaces', () => {
    it('uses the overlay surface by default', () => {
        expect(surfaceFromSearch('')).toBe('overlay');
        expect(surfaceFromSearch('?view=overlay')).toBe('overlay');
    });

    it('recognizes app-owned dashboard and compact surfaces', () => {
        expect(surfaceFromSearch('?view=dashboard')).toBe('dashboard');
        expect(surfaceFromSearch('?view=compact')).toBe('compact');
    });
});
