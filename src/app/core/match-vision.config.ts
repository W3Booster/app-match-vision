import { w3boosterApp, type W3BoosterAppConnectOptions } from './w3booster-app.generated';

/** Build application-owned SDK options. The SDK handles platform backend hints itself. */
export function connectionOptions(search: string): W3BoosterAppConnectOptions {
    const parameters = new URLSearchParams(search);
    const demo = parameters.has('demo');

    return {
        demo: demo ? { settings: w3boosterApp.settingsDefaults } : false,
        // The regular dashboard fills its host viewport and owns scrolling.
        // Other surfaces keep SDK content-height reporting enabled.
        autoResize: parameters.get('view') === 'dashboard' ? false : undefined,
        // Let the SDK retry transient startup failures. Authorization,
        // configuration, and protocol failures still surface immediately.
        retry: demo ? false : true
    };
}
