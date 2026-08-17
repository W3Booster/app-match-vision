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

Match Vision never reads tokens, browser-source credentials, WebSockets, or localhost APIs directly. Its scopes live in `w3booster.app.json`, so application code only supplies its identity:

```ts
const client = await connect('app_7bd7c42015297f608f1e5436');

client.state.subscribe(state => render(state));
client.on('hero.inventory.changed', ({ player, inventory }) => {
  updateInventory(player.id, inventory);
});
```

The SDK selects the available W3Booster transport, restores the complete state from incremental updates, reconnects, and exposes domain events. Match Vision consumes the SDK's `MatchState` directly. Reusable state derivations come from `@w3booster/sdk/selectors`; [`match-selectors.ts`](src/app/domain/match-selectors.ts) contains only Match Vision-specific display choices.

Reusable shipped game knowledge and rules come from `@w3booster/sdk/standard-game`, including cooldown state, weapon/armor upgrades, mode statistics, hero progression, the day/night clock, and versioned icon URLs. Match Vision does not carry its own Warcraft object table or duplicate those rules. Its team palette, team order, race sprite order, and clock sprite animation remain local because they are visual choices, not Warcraft data.

Warcraft III icons resolve through the SDK's versioned `https://assets.w3booster.com/wc3/standard-game/v1/` asset base in production and local development. Append `assetBaseUrl=<origin>` only when testing an alternate asset deployment.

The client ID is an immutable, platform-generated public identifier. It is deliberately unrelated to the editable app title and is not a secret. Installations, grants, and saved settings use the database application record rather than deriving identity from the title.

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

- `w3booster.app.json` — public app metadata and surfaces
- `src/app/app.component.*` — minimal surface shell
- `src/app/core/` — SDK lifecycle, app identity, and URL surface selection
- `src/app/domain/` — app settings and pure selectors over SDK domain types
- `src/app/features/overlay/` — overlay composition and Warcraft HUD components
- `src/app/features/dashboard/` — dashboard, compact controls, and local match history
- `src/app/shared/warcraft/` — selects the SDK's Classic/Reforged hosted icon URLs

The dependency rules and rationale are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Settings and host actions

User settings arrive in `state.application.settings`. Match Vision selects the `player` or `observer` profile directly from that SDK state. The generic W3Booster settings UI owns editing and validation; the app only consumes values.

Dashboard actions use `client.host.command(...)`. Host commands are capabilities provided by the W3Booster client, not custom HTTP endpoints.

## Local platform data

For real local data, configure and start a local development session for Match Vision in W3Booster Developer Mode, then open the local app from the client. The SDK receives the temporary launch credential automatically. Published users continue using the published URL.

W3Booster selects the matching local or production platform when it creates an application launch session. The SDK consumes that platform-issued selection automatically; Match Vision does not parse backend parameters or choose a transport itself.

## SDK dependency

Match Vision uses the published `@w3booster/sdk` package. Installing the project with `npm ci` provides the same versioned API and types used by other W3Booster applications.

Match Vision source code is licensed under the [MIT License](LICENSE). Bundled media is covered separately by [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
