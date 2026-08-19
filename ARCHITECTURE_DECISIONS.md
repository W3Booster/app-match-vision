# Match Vision architecture decisions

This file records decisions that must survive repeated clean reviews. They may change when assumptions change or new evidence appears, but a change must update the decision, rationale, compatibility plan, and tests. Reviewers should report implementation bugs and stale assumptions; they should not reopen a documented tradeoff without new evidence.

## ADR-001: Consume published SDK 1 and test SDK HEAD separately

Status: accepted, 2026-08-19.

The package manifest and lockfile remain on the published SDK 1 contract until SDK 2 is actually published. The minimum is SDK 1.0.1 because 1.0.0 points its default cloud connection at a retired endpoint. A local `node_modules/@w3booster/sdk` symlink is a development convenience, not a release artifact and not evidence that clean consumers can install SDK 2.

CI therefore has two deliberate lanes:

- Minimum registry SDK: clean lockfile install, tests, and production build.
- Packed SDK HEAD: pack the sibling SDK checkout, install the tarball without changing the lockfile, then run the same checks.

After SDK 2 is published, raise the declared minimum, regenerate the lockfile from the registry, remove the temporary compatibility branches listed below, and keep the two-lane strategy if supporting a version range remains useful. Do not bump or roll back the dependency based solely on a local symlink.

## ADR-002: Keep explicit SDK 1 compatibility until that coordinated upgrade

Status: accepted, 2026-08-19.

The following code is intentionally redundant when linked to SDK 2:

- `overlay-presentation.ts` forms a nullable two-player tuple locally until the published dependency includes `headToHeadPair()`.
- `warcraft-assets.service.ts` binds the resolved base URL and resolves country flags separately until the unified SDK asset resolver is published.
- `MatchControls` serializes reverse-order writes so SDK 1 cannot reorder rapid UI intent; SDK 2 additionally serializes all setting mutations globally.
- `matchVisionPlayerDisplayIdentity()` strips discriminators from both account and in-game names so behavior is identical under SDK 1 and SDK 2.
- The core service feature-detects SDK 2's runtime lifetime signal and keeps an explicit issue-listener unsubscribe only for SDK 1.

Every compatibility behavior is exercised by application tests that run in both CI lanes. Remove these pieces together with the SDK 2 registry upgrade, not one review at a time.

## ADR-003: Use the generated runtime lifecycle as the Angular boundary

Status: accepted, 2026-08-19.

One generated `w3boosterApp.createRuntime()` owns connection, retry, readiness, host capability discovery, resolved settings, and teardown. Match Vision adapts its atomic lifecycle store into Angular signals in one core service. Feature stores own abort-scoped subscriptions. The app does not implement transport selection, recorder sockets, protocol reduction, or custom retry loops.

Every successful `start()` call means fresh synchronized state is available. During a later reconnect, another caller reuses `runtime.start()` and waits for resynchronization; it must not return merely because a client object and preserved state already exist.

Resolved application settings come from the runtime lifecycle snapshot and generated defaults, not from a second app-maintained settings model. The SDK `MatchState` remains authoritative for match/player/overlay data.

The Angular bridge remains app code because its signal shape, logging, and user-facing error copy are application policy. Do not move Angular DI or signals into SDK core.

## ADR-004: Keep presentation and persistence policy in Match Vision

Status: accepted, 2026-08-19.

The SDK owns protocol, lifecycle, immutable stores, Warcraft rules, shared selectors, and reusable asset semantics. Match Vision owns player username/nationality overrides, player/observer profile precedence, reverse choice keyed to a match ID, history persistence and retention, localized labels, sprite and CSS geometry, avatar-cover rules, and optimistic UI feedback.

App-domain wrappers may preserve a stable Match Vision vocabulary and memoized identity. A small wrapper is not by itself proof that the SDK lacks an API. Promote behavior only when another consumer needs the same semantics or protocol/security correctness requires consistency.

## ADR-005: Preserve authoritative state and derive immutable views

Status: accepted, 2026-08-19.

Presentation overrides never rewrite SDK `Player` or `MatchState` fields. Domain selectors return immutable view values, reuse SDK memoized structures where possible, and tolerate incomplete scoped data. Observer rendering requires a complete two-player tuple. Match history reconciles both lifecycle events and already-finished state so an authoritative `endedAt` is not lost during startup or reconnection.

If the first authoritative state seen for a match is already finished, history creates the entry from that state before applying its end timestamp; reconciliation must not assume a locally observed running phase.

Reverse order is scoped by match ID so a saved choice cannot leak into the next match. It applies consistently to two-team and multi-team/FFA observer layouts.

Team ordering has two intentional presentation modes: observer/replay surfaces use the SDK's canonical map/team ordering, while ordinary player surfaces keep the broadcaster's team first. Do not route player overlays through observer-only ordering merely to share a wrapper.
