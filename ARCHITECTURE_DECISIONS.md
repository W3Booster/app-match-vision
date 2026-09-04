# Match Vision architecture decisions

This file records decisions that must survive repeated clean reviews. They may change when assumptions change or new evidence appears, but a change must update the decision, rationale, compatibility plan, and tests. Reviewers should report implementation bugs and stale assumptions; they should not reopen a documented tradeoff without new evidence.

## ADR-006: Forking source explicitly replaces local identity, not production ownership

Status: accepted, 2026-09-05.

Match Vision is both the production app and a public complex starting point. The platform exposes the same registration in its library and reference-example view. Source forks register their own app; they never reuse the official ID to acquire capabilities. `npm run app:fork -- NEW_CLIENT_ID` validates the new public definition before replacing the local generated binding and package configuration. It leaves failed fetches untouched and performs no platform writes. Tests cover identity conflicts and preflight failures. Official match-score capabilities and private deployment credentials do not transfer to forks.

## ADR-001: Consume a published SDK release and test SDK HEAD separately

Status: accepted, updated 2026-08-21.

The package manifest and lockfile consume the published `@w3booster/sdk` registry artifact. The current minimum is 1.0.2. That hotfix publishes the runtime lifetime signal, initial-finished lifecycle option, structured retry state, mode-aware team ordering, display identity, head-to-head, asset resolver, nullable team grouping, and globally serialized setting writes used by this app. A local `node_modules/@w3booster/sdk` symlink is a development convenience, not a release artifact and not evidence that clean consumers can install an SDK change.

CI therefore has two deliberate lanes:

- Published registry SDK: clean lockfile install, tests, and production build.
- Packed SDK HEAD: pack the sibling SDK checkout, resolve its tarball into a disposable CI-only package/lockfile, clean-install that graph, then run the same checks. This avoids npm's reproducible Arborist `edgesOut` crash with `--no-save --package-lock=false`. Never commit this temporary dependency change; the registry lane and release lockfile remain authoritative.

Raise the declared minimum only after the required SDK state has been published, regenerate the lockfile from the registry, and remove any temporary compatibility branches in the same change. Do not bump or roll back the dependency based solely on a local symlink. The packed-HEAD lane is an early compatibility signal, not the release source.

## ADR-002: Use the SDK 1.0.2 primitives directly

Status: accepted, 2026-08-21. Supersedes the temporary SDK 1/SDK 2 compatibility policy from 2026-08-19.

The coordinated 1.0.2 publication completed the transition. Match Vision now delegates the following shared behavior directly to the SDK:

- `headToHeadPair()` for nullable two-player presentation.
- `standardGameIcons.createAssetResolver()` for icons and country flags.
- SDK-owned serialization for all setting mutations.
- `playerDisplayIdentity()` for discriminator-safe display names.
- `runtime.signal` for client-event subscription lifetime.
- `standardGame.orderMatchTeams()` for mode-aware ordering across dashboard and overlay.
- `groupPlayersByTeam()` for persisted players whose team can be `null`.

Do not reintroduce local equivalents or version-feature-detection for these APIs while 1.0.2 remains the declared minimum. App wrappers are appropriate only when they add Match Vision policy, not to recreate an SDK primitive.

## ADR-003: Use the generated runtime lifecycle as the Angular boundary

Status: accepted, 2026-08-19.

One generated `w3boosterApp.createRuntime()` owns connection, retry, readiness, host capability discovery, resolved settings, and teardown. Match Vision adapts its atomic lifecycle store into Angular signals in one core service. Feature stores own abort-scoped subscriptions. The app does not implement transport selection, recorder sockets, protocol reduction, or custom retry loops.

The Angular connection view carries the SDK's structured initial-retry snapshot through to user-facing attempt and backoff text. It must not reduce retry progress to a generic connecting status or parse error strings.

Every successful `start()` call means fresh synchronized state is available. During a later reconnect, another caller reuses `runtime.start()` and waits for resynchronization; it must not return merely because a client object and preserved state already exist.

`runtime.stop()` aborts `runtime.signal`. Client-event subscriptions owned by the runtime lifetime pass `{ signal: runtime.signal }`; independently owned subscriptions retain and call their returned unsubscribe function. Documentation must show one of those ownership mechanisms and must not imply that an unscoped listener is stopped automatically.

Resolved application settings come from the runtime lifecycle snapshot and generated defaults, not from a second app-maintained settings model. The SDK `MatchState` remains authoritative for match/player/overlay data.

The Angular bridge remains app code because its signal shape, logging, and user-facing error copy are application policy. Do not move Angular DI or signals into SDK core.

## ADR-004: Keep presentation and persistence policy in Match Vision

Status: accepted, 2026-08-19.

The SDK owns protocol, lifecycle, immutable stores, Warcraft rules, shared selectors, and reusable asset semantics. Match Vision owns player username/nationality overrides, player/observer profile precedence, reverse choice keyed to a match ID, history persistence and retention, localized labels, sprite and CSS geometry, avatar-cover rules, and optimistic UI feedback.

Broadcaster username/nationality overrides are selected by application surface: player surfaces apply them to the known broadcaster in 1v1 and team modes, while observer/replay surfaces do not. Visible player count is incomplete scoped data and must not decide whether the override applies.

App-domain wrappers may preserve a stable Match Vision vocabulary only when they add application policy or memoized view composition. Call an existing SDK primitive directly when no application behavior is added. Promote behavior only when another consumer needs the same semantics or protocol/security correctness requires consistency.

## ADR-005: Preserve authoritative state and derive immutable views

Status: accepted, 2026-08-19.

Presentation overrides never rewrite SDK `Player` or `MatchState` fields. Domain selectors return immutable view values, reuse SDK memoized structures where possible, and tolerate incomplete scoped data. Observer rendering requires a complete two-player tuple. Match history reconciles both lifecycle events and already-finished state so an authoritative `endedAt` is not lost during startup or reconnection.

If the first authoritative state seen for a match is already finished, history creates the entry from that state before applying its end timestamp; reconciliation must not assume a locally observed running phase.

An active history entry is an idempotent upsert, not insert-only. A later hydrated snapshot may fill its map, players, and authoritative start time without changing the original observed fallback time or replacing a richer player snapshot with a poorer one. Players retain their stable IDs; enrichment merges name, race, and team independently so gaining one field cannot erase another known field. This reconciliation writes only when persisted content changes. Missing player team IDs remain `null`; they must never be coerced to team 0 because that would invent a side and merge unrelated unknown players into it.

History written by an older app version may lack player IDs. During its first hydrated reconciliation, each id-less legacy slot is claimed positionally at most once and gains the stable ID; it must not be appended again as a duplicate. Subsequent updates use stable identity.

`match.endedAt` is authoritative when supplied but optional in the SDK contract. The lifecycle subscription opts into the current finished match. A first hydrated `finished` snapshot is always recorded; when it lacks `endedAt`, history uses the first local observation time and marks its source as observed, exactly like an ended lifecycle event fallback. Repeated publications of that same terminal snapshot must not move the fallback forward or write storage again; a later authoritative timestamp upgrades it. Raw-state reconciliation remains as an idempotent hydration safeguard, not as a version compatibility path.

Reverse order is scoped by match ID so a saved choice cannot leak into the next match. It applies consistently to two-team and multi-team/FFA observer layouts.

Team ordering has intentional mode-specific behavior: 1v1 observer/replay surfaces use map position, while ordinary player and team-observer surfaces keep the broadcaster's team first and FFA preserves team order. Explicit 1v1 with exactly two visible players creates one side per player even if both team IDs are absent. An explicit FFA likewise has one side per visible player when team IDs are missing; reversal reverses those sides instead of a collapsed `null` group. Dashboard and overlay both delegate to the SDK's mode-aware `standardGame.orderMatchTeams()`; do not maintain separate app ordering branches that can diverge.
