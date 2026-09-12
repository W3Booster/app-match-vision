# Match Vision architecture

Match Vision is one W3Booster application with three surfaces. It consumes the public SDK exactly like a third-party app and contains no platform transport, authentication, compositor, Electron, or recorder implementation.

The durable rationale for choices made during SDK/application reviews is recorded in `ARCHITECTURE_DECISIONS.md`. Update that record when changing a decision so later reviews do not oscillate between designs.

## Dependency direction

```text
App shell
  -> Core SDK lifecycle
  -> Dashboard feature
  -> Overlay feature

Features -> Domain presentation -> @w3booster/sdk types
Features -> @w3booster/sdk/selectors
Features -> @w3booster/sdk/standard-game
Features -> @w3booster/sdk/assets
Features -> Shared asset URL service
```

- `app.component.*` selects a surface and owns the application lifetime. It contains no match presentation logic.
- `core/` gives the SDK one abort-scoped application lifetime and waits for synchronized state. It does not implement transport selection, retry timers, or rendering.
- `domain/` contains Match Vision settings and pure, immutable selectors. There is no duplicate state model or state adapter.
- `features/overlay/` owns the visible HUD. `overlay-presentation.ts` derives a view model; components render it.
- `features/dashboard/` owns app controls. Match-history persistence is isolated in `MatchHistoryStore`.
- `@w3booster/sdk/selectors` owns reusable, framework-free derivations from live state.
- `@w3booster/sdk/standard-game` owns lightweight standard-rules helpers, canonical game-time formatting, and preferred-statistics selection; the optional `/game-data` entry loads exact-revision generated object definitions, artwork and cooldown configuration. `WarcraftGameDataService` owns loading and revision changes; the asset service delegates lookups to the catalog.
- The platform database owns the application contract. A deliberate `npm run w3booster:sync` refreshes the committed `w3booster-app.generated.ts` binding; install, development startup, and builds remain deterministic and make no network request.
- `@w3booster/sdk/assets` owns reusable URLs for shared media such as account country flags.
- `shared/warcraft/` selects the hosted asset origin and maps SDK helpers into Angular; Match Vision-specific visibility and layout remain in the overlay feature.

## Platform boundary

The compositor hosts enabled overlay apps and aligns the in-game Electron window with Warcraft III. Match Vision owns all pixels rendered inside its iframe. Host actions such as opening the compact window and reading/committing opaque app storage go through `client.host`; application code never calls platform HTTP endpoints directly.

## State rules

1. SDK `MatchState` is the source of truth.
2. Selectors never mutate SDK state.
3. Presentation state is derived, not synchronized through component setters.
4. Resolved app settings come from the generated application runtime lifecycle and its database-default resolver; Match Vision does not maintain a second settings model.
5. Shared context is read from `state.gameContext`; Match Vision’s counter comes from `state.application.data.matchScore`. Temporary domain readers support the previous normalized runtime during the rolling SDK/API migration.
6. Trust-sensitive identity policy, including W3Champions four-player FFA masking, is enforced by the platform server before scoped state reaches the SDK or application.

## Lifecycle rules

1. One SDK application runtime owns the client connection, retry loop, readiness wait, host capability discovery, resolved settings, and teardown; one atomic runtime subscription feeds Angular's status, state, freshness, error, and host signals.
2. Feature stores use their own abort signal, so replacing or destroying a feature removes all of its listeners atomically.
3. `open()` means a transport is open; `whenReady()` may return preserved state, while `whenSynchronized()` means a fresh complete state is safe to render.
4. Permission, configuration, and protocol errors are surfaced by the SDK. Application code does not classify failures for a custom retry loop.
5. `runtime.stop()` is the awaited teardown boundary and is safe to call repeatedly.
