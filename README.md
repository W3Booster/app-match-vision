# Match Vision

W3Booster's official match visualization app and the full-featured reference for building W3Booster apps.

**Public source. MIT licensed. Ready to fork.** [Build your own app from Match Vision](docs/START_FROM_MATCH_VISION.md) walks through the code, your own registration, and the production-only capabilities that do not carry over. In W3Booster's Examples view this is the same app as in the library, with one shared installation—not a second example copy.

## Run it in two minutes

Requirements: Node.js 22.22.3 or newer.

```bash
git clone https://github.com/W3Booster/app-match-vision.git
cd app-match-vision
npm ci
npm start
```

Open [http://localhost:8082/?view=dashboard&demo=1](http://localhost:8082/?view=dashboard&demo=1). `demo=1` uses generated SDK data, so Warcraft III and the W3Booster client do not need to be running.

Run the quality checks with:

```bash
npm run check
```

## The SDK boundary

Match Vision never reads tokens, browser-source credentials, WebSockets, or localhost APIs directly. Its scopes live in the W3Booster application record. The generated application's managed runtime owns connection attempts, SDK retry, readiness, host capability discovery, subscriptions, resolved settings, and teardown:

```ts
import { w3boosterApp } from './src/app/core/w3booster-app.generated';

const runtime = w3boosterApp.createRuntime({ retry: true });
runtime.lifecycle.subscribe(snapshot => {
  renderConnection(snapshot.status, snapshot.error);
  render(snapshot.state, snapshot.settings, { fresh: snapshot.isSynchronized });
  renderHostActions(snapshot.host);
}, { signal: runtime.signal });
runtime.client.on('hero.inventory.changed', ({ player, inventory }) => {
  updateInventory(player.id, inventory);
}, { signal: runtime.signal });

await runtime.start();

// Angular destroy, React cleanup, Vue unmount, or page teardown.
// stop() aborts runtime.signal and its scoped subscriptions.
await runtime.stop();
```

Use a separately owned `AbortSignal` or retain the returned unsubscribe function when a subscription should have a shorter lifetime than the runtime.

The SDK selects the available W3Booster transport, retries transient startup failures, restores complete state from incremental updates, reconnects, and exposes domain events. Match Vision consumes the SDK's `MatchState` directly. Reusable state derivations come from `@w3booster/sdk/selectors`; [`match-selectors.ts`](src/app/domain/match-selectors.ts) contains only Match Vision-specific display choices.

The working Angular integration is [`match-vision-client.service.ts`](src/app/core/match-vision-client.service.ts). It maps the SDK's atomic, immediately subscribed application-runtime snapshot into Angular signals, including reactive host capabilities, without recreating connection state transitions locally. [`match-history.store.ts`](src/app/features/dashboard/match-history.store.ts) demonstrates feature-scoped state and event subscriptions, including how to handle an already-running initial match. Neither file implements its own retry timers or connection-lifetime registry.

Reusable lightweight game rules—including game-time formatting, preferred statistics, canonical observer ordering, and native/simplified presentation colors—come from `@w3booster/sdk/standard-game`; whole-state cooldown derivation and versioned icon URLs come from the independently loadable `/standard-game/cooldowns` and `/standard-game/icons` subpaths. Match Vision does not carry its own Warcraft object table or duplicate those rules. The trusted platform server applies W3Champions four-player FFA identity masking before state reaches either Match Vision or the SDK. Match Vision retains only its sprite-frame order, CSS, localized race copy, clock animation, and other product-specific layout choices.

Warcraft III icons and country flags resolve through SDK URL helpers backed by versioned catalogs on `https://static.w3booster.com/assets`. Match Vision does not bundle its own copies. For local launches, W3Booster advertises the matching asset origin through `assetBaseUrl`; Match Vision neither infers ports nor parses the backend selection.

The SDK calls the immutable, platform-generated public identifier `clientId`. It is deliberately unrelated to the editable app title and is not a secret. Match Vision binds it to the project once; afterward the SDK uses that stored binding for generated settings types, installations, grants, and saved settings.

## Surfaces

One build provides three app surfaces:

| URL | Purpose |
| --- | --- |
| `/?view=dashboard` | App page rendered inside W3Booster |
| `/?view=overlay` | Transparent stream or in-game overlay |
| `/?view=compact` | Compact app-owned window |

Use `client.host.openWindow({ path: '?view=compact' })` for secondary windows. It resolves after the authenticated W3Booster host acknowledges the new Electron child window and rejects when no supported host is available.

The platform compositor is intentionally a separate project. It decides which enabled overlays to stack and, for the in-game surface, aligns the transparent Electron window with Warcraft III (including DPI scaling). Match Vision remains an ordinary app inside that stack and owns all visible match UI for both the stream and in-game surfaces.

## Project map

- `src/app/core/w3booster-app.generated.ts` — typed snapshot generated from the protected database settings export
- `src/app/app.component.*` — minimal surface shell
- `src/app/core/` — SDK lifecycle, app identity, and URL surface selection
- `src/app/domain/` — app settings and pure selectors over SDK domain types
- `src/app/features/overlay/` — overlay composition and Warcraft HUD components
- `src/app/features/dashboard/` — dashboard, compact controls, and local match history
- `src/app/shared/warcraft/` — selects the SDK's Classic/Reforged hosted icon URLs

The dependency rules and rationale are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Settings and host actions

User settings arrive as a recursively partial `state.application.settings` payload. The generated `w3boosterApp.resolveSettings()` binding applies database defaults before Match Vision selects the `player` or `observer` profile. The generic W3Booster settings UI owns editing and validation; the app only consumes values.

The generated binding is committed so installs, local startup, and production builds are deterministic and work offline. Run `npm run w3booster:sync` deliberately after changing the database definition; CI runs `npm run w3booster:check` when its public settings endpoint is configured. Package lifecycle scripts do not perform network requests.

Dashboard score actions await the SDK's acknowledged `changeMatchScore()` and `resetMatchScore()` methods. Host commands are capabilities provided by the W3Booster client, not custom HTTP endpoints.

## Local platform data

For real local data, configure and start a local development session for Match Vision in W3Booster Developer Mode, then open the local app from the client. The SDK receives the temporary launch credential automatically. Published users continue using the published URL.

W3Booster selects the matching local or production platform when it creates an application launch session. The SDK consumes that platform-issued selection automatically; Match Vision does not parse backend parameters or choose a transport itself.

During observer and replay matches, the SDK also attaches to the authenticated local recorder feed automatically. Low-latency game time, HUD scale, resources, heroes, and upgrades arrive through the same immutable `client.state`; Match Vision contains no recorder socket or merge logic.

## SDK dependency

Match Vision's package and lockfile always use the npm registry version, never a checked-in local path. To develop Match Vision and the SDK together, run `npm run sdk:link-local`. This replaces only `node_modules/@w3booster/sdk` with a link to a sibling checkout; it does not change the package or lockfile. Set `W3BOOSTER_SDK_PATH` when the checkout is elsewhere, and run `npm ci` to return to the registry package.

The W3Booster application record is the sole source for client identity, scopes, surfaces, metadata, and the settings schema. Match Vision has completed the one-time `w3booster-settings init` binding: `package.json` stores its public `clientId` and generated-file location. Refresh the committed binding deliberately with `npm run w3booster:sync`; install, development, and build commands remain offline and deterministic. `npm run w3booster:check` is strict in connected CI and fails when the repository is behind the database revision. CI may select a non-default public definition endpoint with `W3BOOSTER_SETTINGS_URL`.

The repository requires published SDK 1.0.2 or newer in the 1.x line. Version 1.0.2 is the coordinated hotfix containing the lifecycle, selector, asset, grouping, and setting-mutation APIs consumed directly by Match Vision. Its lockfile records the npm registry tarball integrity, so clean installs and CI use the same reviewed SDK artifact. Use the local-link command only while deliberately developing both repositories together.

Match Vision source code is licensed under the [MIT License](LICENSE). Bundled media is covered separately by [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
