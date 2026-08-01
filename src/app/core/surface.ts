export type MatchVisionSurface = 'overlay' | 'dashboard' | 'compact';

export function surfaceFromSearch(search: string): MatchVisionSurface {
    const view = new URLSearchParams(search).get('view');
    return view === 'dashboard' || view === 'compact' ? view : 'overlay';
}
