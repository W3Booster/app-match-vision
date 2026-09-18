import type { MatchState } from '@w3booster/sdk';
import { isActiveMatch } from '@w3booster/sdk/selectors';

/** Menu visibility is presentation state; OBS remains visible and collection continues. */
export function overlayVisible(state: MatchState): boolean {
    // Additive field: keep the published minimum SDK lane compatible until release.
    const context = state.gameContext as typeof state.gameContext & { readonly menuOpen?: boolean };
    return isActiveMatch(state.match) &&
        !(state.application?.surface === 'ingameOverlay' && context.menuOpen === true);
}
