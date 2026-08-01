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
Features -> Shared Warcraft assets
```

- `app.component.*` selects a surface and owns the application lifetime. It contains no match presentation logic.
- `core/` connects and disconnects the SDK and interprets launch parameters. It does not render UI.
- `domain/` contains Match Vision settings and pure, immutable selectors. There is no duplicate state model or state adapter.
- `features/overlay/` owns the visible HUD. `overlay-presentation.ts` derives a view model; components render it.
- `features/dashboard/` owns app controls. Match-history persistence is isolated in `MatchHistoryStore`.
- `@w3booster/sdk/selectors` owns reusable, framework-free derivations from live state.
- `@w3booster/sdk/standard-game` owns reusable shipped Warcraft III object metadata and standard-rules helpers.
- `shared/warcraft/` only maps that SDK knowledge to versioned hosted asset URLs.

## Platform boundary

The compositor hosts enabled overlay apps and aligns the in-game Electron window with Warcraft III. Match Vision owns all pixels rendered inside its iframe. Host actions such as opening the compact window or changing the match score go through `client.host`; application code never calls platform HTTP endpoints directly.

## State rules

1. SDK `MatchState` is the source of truth.
2. Selectors never mutate SDK state.
3. Presentation state is derived, not synchronized through component setters.
4. App settings come only from `state.application.settings`.
5. Recorder overlay runtime values are typed by the SDK and read from `state.overlay.misc`.
