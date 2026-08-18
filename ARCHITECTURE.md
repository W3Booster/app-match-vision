# Match Vision architecture

Match Vision is one W3Booster application with three surfaces. It consumes the public SDK exactly like a third-party app and contains no platform transport, authentication, compositor, Electron, or recorder implementation.

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
- `@w3booster/sdk/standard-game` owns lightweight standard-rules helpers, canonical game-time formatting, and preferred-statistics selection; `@w3booster/sdk/standard-game/objects` owns the optional shipped object metadata, icon URLs, and whole-state cooldown derivation.
- The platform database owns the application contract. A deliberate `npm run w3booster:sync` refreshes the committed `w3booster-app.generated.ts` binding; install, development startup, and builds remain deterministic and make no network request.
- `@w3booster/sdk/assets` owns reusable URLs for shared media such as account country flags.
- `shared/warcraft/` selects the hosted asset origin and maps SDK helpers into Angular; Match Vision-specific visibility and layout remain in the overlay feature.

## Platform boundary

The compositor hosts enabled overlay apps and aligns the in-game Electron window with Warcraft III. Match Vision owns all pixels rendered inside its iframe. Host actions such as opening the compact window or changing the match score go through `client.host`; application code never calls platform HTTP endpoints directly.

## State rules

1. SDK `MatchState` is the source of truth.
2. Selectors never mutate SDK state.
3. Presentation state is derived, not synchronized through component setters.
4. App settings come only from `state.application.settings` and are completed with the generated database-default resolver.
5. Recorder overlay runtime values are normalized by the SDK and read from `state.overlay.runtime`; recorder-specific wire fields never enter application code.

## Lifecycle rules

1. One SDK application runtime owns the client connection, retry loop, readiness wait, host capability discovery, resolved settings, and teardown; one atomic runtime subscription feeds Angular's status, state, freshness, error, and host signals.
2. Feature stores use their own abort signal, so replacing or destroying a feature removes all of its listeners atomically.
3. `connect()` means a transport is open; `whenReady()` may return preserved state, while `whenSynchronized()` means a fresh complete state is safe to render.
4. Permission, configuration, and protocol errors are surfaced by the SDK. Application code does not classify failures for a custom retry loop.
5. `runtime.stop()` is the awaited teardown boundary and is safe to call repeatedly.
