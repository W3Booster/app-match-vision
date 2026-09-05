import type { MatchState } from '@w3booster/sdk';

/** Match Vision policy. The host stores this document but never evaluates results. */
export interface ScoreDocument {
    revision: number;
    wins: number;
    losses: number;
    lastUpdate: number;
    automatic: boolean;
    processedResults: string[];
}

export interface RecordedResult {
    id: string;
    recordedAt: number;
    match: {
        isWon?: boolean;
        isReplay?: boolean;
        isObserver?: boolean;
        realm?: string;
        gameTime?: number;
        players?: Record<string, { team?: number; isAI?: boolean }>;
    };
}

export interface ScoreContext {
    document: ScoreDocument;
    results: RecordedResult[];
}

export type ScoreAction = { side: 'wins' | 'losses'; delta: 1 | -1 } | { reset: true } | { automatic: boolean };
const SESSION_IDLE_MS = 5 * 60 * 60 * 1000;

/** Match Vision checks the eligibility of a recorder-confirmed SDK outcome. */
export function recordedResultFromState(state: MatchState<object> | null, observedAt = Date.now()): RecordedResult | undefined {
    if (!state || state.match.status !== 'finished' || !state.match.id) return undefined;
    const result = state.match.result;
    if (!result ||
        result.playerId !== (state.match.realBroadcasterPlayerId ?? state.match.broadcasterPlayerId)) return undefined;
    if (!state.players.length || state.players.some(player => player.team !== 24 && typeof player.isAI !== 'boolean') ||
        typeof state.match.isReplay !== 'boolean' || typeof state.match.isObserver !== 'boolean' ||
        typeof state.match.realm !== 'string') return undefined;
    return {
        id: state.match.id,
        recordedAt: state.match.endedAt ? Date.parse(state.match.endedAt) : observedAt,
        match: {
            isWon: result.outcome === 'won',
            isReplay: state.match.isReplay, isObserver: state.match.isObserver,
            realm: state.match.realm, gameTime: state.match.gameTime,
            players: Object.fromEntries(state.players.map(player => [player.id, { team: player.team, isAI: player.isAI }]))
        }
    };
}

export function resultScoreSide(match: RecordedResult['match']): 'wins' | 'losses' | undefined {
    // Unknown eligibility is not evidence that this was our own human-player game.
    if (typeof match.isWon !== 'boolean' || match.isReplay !== false || match.isObserver !== false ||
        !match.players || !Object.keys(match.players).length || typeof match.realm !== 'string' ||
        !Number.isFinite(match.gameTime) || match.gameTime! < 0) return undefined;
    const players = Object.values(match.players).filter(player => player.team !== 24);
    if (!players.length || players.some(player => player.isAI !== false)) return undefined;
    if (!match.isWon && match.realm.toLowerCase().startsWith('w3champions') && match.gameTime! <= 120) return undefined;
    return match.isWon ? 'wins' : 'losses';
}

export function updateScore(context: ScoreContext, now: number, action?: ScoreAction): ScoreDocument {
    const next = { ...context.document, processedResults: [...context.document.processedResults] };
    const processed = new Set(next.processedResults);
    const expire = (time: number) => {
        if (time - next.lastUpdate > SESSION_IDLE_MS) {
            next.wins = next.losses = 0;
            next.lastUpdate = time;
        }
    };
    for (const result of [...context.results].sort((a, b) => a.recordedAt - b.recordedAt)) {
        if (processed.has(result.id)) continue;
        processed.add(result.id);
        next.processedResults.push(result.id);
        const side = resultScoreSide(result.match);
        if (next.automatic && side) {
            expire(result.recordedAt);
            next[side]++;
            next.lastUpdate = Math.max(next.lastUpdate, result.recordedAt);
        }
    }
    expire(now);
    if (action) {
        if ('automatic' in action) next.automatic = action.automatic;
        else {
            if ('reset' in action) next.wins = next.losses = 0;
            else next[action.side] = Math.max(0, next[action.side] + action.delta);
            next.lastUpdate = now;
        }
    }
    // Retain completed IDs across app reloads and concurrent surfaces. The SDK
    // retains the current terminal match, not an unbounded historical journal.
    next.processedResults = next.processedResults.slice(-1000);
    return next;
}
