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
            gameVersion: '3.0.0.24268',
            gameDataId: '3.0.0.24268-41304aaa2345cb33'
        }
    };
}
