import { createDemoState } from '@w3booster/sdk/testing';
import type { W3BoosterAppSettings } from './w3booster-app.generated';

// This synthetic scene uses a reviewed catalog, independent of the installed game.
// Update this identity when refreshing the demo during the Warcraft patch workflow.
export function createMatchVisionDemo() {
    const state = createDemoState<W3BoosterAppSettings>();
    return {
        ...state,
        match: {
            ...state.match,
            gameVersion: '2.0.4.23745',
            gameDataId: '2.0.4.23745-423f276dcc5a21de'
        }
    };
}
