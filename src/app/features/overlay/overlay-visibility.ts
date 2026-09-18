import type { MatchState } from '@w3booster/sdk';
import { isActiveMatch } from '@w3booster/sdk/selectors';

/** Hide both overlay surfaces during menus without interrupting collection. */
export function overlayVisible(state: MatchState): boolean {
    return isActiveMatch(state.match) && state.gameContext.menuOpen !== true;
}
