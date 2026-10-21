import type { MatchState } from '@w3booster/sdk';
import { isActiveMatch } from '@w3booster/sdk/selectors';

/** Hide incompatible native layouts and menus without interrupting collection. */
export function overlayVisible(state: MatchState): boolean {
    // Feature detection also compiles against the minimum published SDK.
    const advanced = 'advancedObserverMode' in state.gameContext && state.gameContext.advancedObserverMode === true;
    return isActiveMatch(state.match) && state.gameContext.menuOpen !== true && !advanced;
}
