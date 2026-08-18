# Match Vision

W3Booster's official match visualization app and the full-featured reference for building W3Booster apps.

## Run it in two minutes

Requirements: Node.js 22.22.3 or newer.

```bash
npm install
npm start
```

Open [http://localhost:8082/?view=dashboard&demo=1](http://localhost:8082/?view=dashboard&demo=1). `demo=1` uses generated SDK data, so Warcraft III and the W3Booster client do not need to be running.

Run the quality checks with:

```bash
npm run check
```

## The SDK boundary

Match Vision never reads tokens, browser-source credentials, WebSockets, or localhost APIs directly. Its scopes live in the W3Booster application record. A single abort signal owns connection attempts, SDK retry, readiness, subscriptions, and teardown:

```ts
import { createW3BoosterAppClient } from './src/app/core/w3booster-app.generated';

const lifetime = new AbortController();
const client = createW3BoosterAppClient({
  retry: true,
  signal: lifetime.signal
});

client.lifecycle.subscribe(snapshot => {
  renderConnection(snapshot.status, snapshot.error);
  render(snapshot.state, { fresh: snapshot.isSynchronized });
}, { signal: lifetime.signal });
client.on('hero.inventory.changed', ({ player, inventory }) => {
  updateInventory(player.id, inventory);
}, { signal: lifetime.signal });

await client.connect();
await client.whenSynchronized({ signal: lifetime.signal });

// Angular destroy, React cleanup, Vue unmount, or page teardown:
lifetime.abort();
```

The SDK selects the available W3Booster transport, retries transient startup failures, restores complete state from incremental updates, reconnects, and exposes domain events. Match Vision consumes the SDK's `MatchState` directly. Reusable state derivations come from `@w3booster/sdk/selectors`; [`match-selectors.ts`](src/app/domain/match-selectors.ts) contains only Match Vision-specific display choices.

The working Angular integration is [`match-vision-client.service.ts`](src/app/core/match-vision-client.service.ts). It maps the SDK's atomic `client.lifecycle` snapshot into Angular signals and distinguishes transport connection, preserved stale state, and a fresh complete snapshot with `whenSynchronized()`. [`match-history.store.ts`](src/app/features/dashboard/match-history.store.ts) demonstrates feature-scoped state and event subscriptions, including how to handle an already-running initial match. Neither file implements its own retry timers or unsubscribe registry.

Reusable lightweight game rules—including game-time formatting and preferred statistics—come from `@w3booster/sdk/standard-game`; shipped object metadata, whole-state cooldown derivation, and versioned icon URLs come from the opt-in `@w3booster/sdk/standard-game/objects` subpath. Match Vision does not carry its own Warcraft object table or duplicate those rules. Its team palette, team order, race sprite order, and clock sprite animation remain local because they are visual choices, not Warcraft data.

Warcraft III icons and country flags resolve through SDK URL helpers backed by versioned catalogs on `https://static.w3booster.com/assets`. Match Vision does not bundle its own copies. For local launches, W3Booster advertises the matching asset origin through `assetBaseUrl`; Match Vision neither infers ports nor parses the backend selection.

The SDK calls the immutable, platform-generated public identifier `clientId`. It is deliberately unrelated to the editable app title and is not a secret. Match Vision binds it to the project once; afterward the SDK uses that stored binding for generated settings types, installations, grants, and saved settings.

## Surfaces

One build provides three app surfaces:

| URL | Purpose |
| --- | --- |
| `/?view=dashboard` | App page rendered inside W3Booster |
| `/?view=overlay` | Transparent stream or in-game overlay |
| `/?view=compact` | Compact app-owned window |

Use `client.host.openWindow({ path: '?view=compact' })` for secondary windows. It returns `false` in a normal browser and opens an Electron child window when hosted by W3Booster.

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

User settings arrive as a recursively partial `state.application.settings` payload. The generated `resolveW3BoosterAppSettings()` helper applies database defaults before Match Vision selects the `player` or `observer` profile. The generic W3Booster settings UI owns editing and validation; the app only consumes values.

The generated binding is committed so installs, local startup, and production builds are deterministic and work offline. Run `npm run w3booster:sync` deliberately after changing the database definition; CI runs `npm run w3booster:check` when its settings endpoint credentials are available. Package lifecycle scripts do not perform network requests.

Dashboard score actions use the SDK's acknowledged `changeMatchScoreAndWait()` and `resetMatchScoreAndWait()` methods. Host commands are capabilities provided by the W3Booster client, not custom HTTP endpoints.

## Local platform data

For real local data, configure and start a local development session for Match Vision in W3Booster Developer Mode, then open the local app from the client. The SDK receives the temporary launch credential automatically. Published users continue using the published URL.

W3Booster selects the matching local or production platform when it creates an application launch session. The SDK consumes that platform-issued selection automatically; Match Vision does not parse backend parameters or choose a transport itself.

During observer and replay matches, the SDK also attaches to the authenticated local recorder feed automatically. Low-latency game time, HUD scale, resources, heroes, and upgrades arrive through the same immutable `client.state`; Match Vision contains no recorder socket or merge logic.

## SDK dependency

Match Vision's package and lockfile always use the npm registry version, never a checked-in local path. To develop Match Vision and the SDK together, run `npm run sdk:link-local`. This replaces only `node_modules/@w3booster/sdk` with a link to a sibling checkout; it does not change the package or lockfile. Set `W3BOOSTER_SDK_PATH` when the checkout is elsewhere, and run `npm ci` to return to the registry package.

The W3Booster application record is the sole source for client identity, scopes, surfaces, metadata, and the settings schema. Match Vision has already completed the one-time `w3booster-settings init` binding: `package.json` stores its public `clientId` and generated-file location. The SDK now refreshes the committed TypeScript settings binding automatically after dependency installation and before every normal or SSL development launch and production build. It can also regenerate a missing binding from that project metadata. `npm run w3booster:check` is deliberately strict for connected CI and fails when the repository is behind the database revision; ordinary development retains the checked-in binding when the endpoint is temporarily unavailable.

The repository now declares SDK 0.2 because it uses that contract. SDK 0.2 must be published before a clean Match Vision install or release; until then, use the local-link command. Publish the SDK first, then refresh the Match Vision lockfile from npm so it records the registry tarball integrity.

Match Vision source code is licensed under the [MIT License](LICENSE). Bundled media is covered separately by [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
