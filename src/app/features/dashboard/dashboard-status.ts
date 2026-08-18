import type { ConnectionStatus } from '@w3booster/sdk';

/** Consistent match-data status copy for every application dashboard surface. */
export function dashboardStatusLabel(
    status: ConnectionStatus,
    matchActive: boolean,
    synchronized = true
): string {
    switch (status) {
        case 'connected': return !synchronized
            ? 'Synchronizing match data'
            : matchActive
            ? 'Match in progress'
            : 'Ready';
        case 'reconnecting': return 'Reconnecting match data';
        case 'connecting': return 'Initializing match data';
        case 'error': return 'Match data unavailable';
        case 'closed': return 'Match data disconnected';
        default: return 'Waiting for match data';
    }
}
