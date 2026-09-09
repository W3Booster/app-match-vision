# Match Vision architecture decisions

## 2026-09-09: SDK 3 instance maps and building production

Status: implemented on `feat/sdk3-vitals-production`; release pending SDK 3
publication and the coordinated platform contract rollout. This supersedes
ADR-009's SDK 2 source contract on this review branch.

Use `playerHeroes` and `playerBuildings` to consume SDK instance maps directly.
`id` is the match-scoped engine instance identity used for DOM tracking;
`typeId` is the Warcraft rawcode used for artwork. Keep the SDK maps intact in
player presentation wrappers, with no parallel normalized entity store.

Preserve the hero bar behavior from the initial public release (`835ec91`):
both sides show bars when abilities or XP are enabled, except the team observer
layout. HP must be positive; mana requires observed mana and positive observed
HP. Dead and unobserved heroes do not acquire fabricated bars. HP transitions
from green at 100% through yellow at 60% toward red at zero; mana is `#00aafd`.
The existing classic/reforged geometry and gradient remain unchanged.

Production queues have independent `player.productionQueuesEnabled` and
`observer.productionQueuesEnabled` settings, defaulting to true in the database
schema. The generated binding owns those defaults; the observer setting also
applies to replays. Panels sit at the left/right edges, with one building per row starting 8px below
the reserved third hero row (including inventory and bars) and continuing downward.
Shared CSS geometry keeps the reservation aligned even when fewer heroes exist. There are no repeated
visible player names. Team/player sides are assigned before empty queues are
filtered, so an idle player cannot move an opponent's queue to the wrong side.
The row has no surrounding box. Its active icon is 39px, with a small building
17px building image followed by a small arrow before the active unit. The
right-side queue mirrors this arrangement. The building never overlaps unit artwork. Queue artwork has no added CSS
borders; the building badge also crops the baked-in texture frame. Waiting icons are one-third size
(13px), filling two rows beside the active icon, inward from each screen edge.
The gold progress track touches the image directly and uses the health bar's
black frame and shading. Active production also uses the
ability cooldown's translucent black backdrop, shrinking with the remaining
fraction over 200ms; the building badge renders above it. Unknown progress does
not invent a remaining fraction. Active slots show SDK `remainingSeconds`,
rounded up, with the centered bold white text and shadow used by ability
cooldowns. Countdown text updates in place without animation. Unstarted/blocked
production (zero progress with explicitly null total and remaining timers) shows
a pause symbol; unreadable or absent observations retain `?`. Waiting slots have
no countdown.
Do not derive seconds from percentages, unit metadata, or wall-clock time.
Progress width interpolates linearly over 200ms between delivered samples without
extrapolating beyond them. Row entry/removal, slot entry/removal and icon
replacements use short CSS animations through Angular enter/leave;
unchanged snapshots reuse DOM and do not restart animations. Reduced-motion
preferences disable all queue animations and transitions. Queue positions remain
snapshot locations, so visual transitions never claim persistent job identity.
The SDK also exposes `totalSeconds` for apps that need elapsed time or percentages;
Match Vision uses the observed remaining timer directly.

The production panels group queues by player and building instance.
During play show only the broadcaster's buildings; observer/replay surfaces
show all delivered player queues using existing team/replay ordering. Preserve
repeated rawcodes as separate slots. Only the first slot shows progress and remaining seconds; null
shows an unknown marker, never zero or an estimated countdown. Slot position
identifies a location within the current building queue, not a future unit.
Empty/unavailable queues, disabled settings, and ended matches remove the panels. Components derive
from SDK snapshots and add no polling or process reads.

Release prerequisites (do not merge this staging branch before these pass):

- Publish the reviewed SDK 3 artifact, then raise the registry dependency to
  `^3.0.0` and regenerate the lockfile from the registry. Until then ADR-001
  keeps the committed dependency at the published SDK 2 version; the registry
  lane is intentionally still a failing release gate, not compatibility proof.
- Roll out the reviewed native/API SDK 3 contract. Add `buildings:read` and
  `production:read` to Match Vision's database-owned application definition and
  update grants through the platform's scope approval flow. Add the production
  boolean to both settings profiles using the official schema; preserve existing
  saved settings. New launches need
  the new grants; existing tickets must not be mistaken for new authorization.
- Regenerate the binding with `npm run w3booster:sync`, verify
  `npm run w3booster:check`, then pass both clean registry and packed SDK lanes.
  Do not hand-edit the generated scopes/revision or ship an app-local adapter.
- Restore the packed CI checkout to SDK HEAD after the reviewed SDK commit is
  merged. The temporary pin makes the feature branch's integration reproducible.

Local end-to-end verification used the reviewed native DLL, local MongoDB/API,
SDK 3 and the desktop compositor during a running replay. Both players delivered
hero HP/mana and building queues. The new settings were generated from the local
database; changing the observer toggle through the desktop settings UI removed
and restored the live overlay queues. The checked-in revision is this staged
contract, not a claim that the production database has already been updated.

Validation: pure queue regression tests plus Chromium rendering checks cover
classic/reforged, player/observer, duel/team/FFA, replay selection, visibility
settings, health colors, dead/missing/zero pools, repeated slots, unknown and
changing progress, cancellation, lifecycle cleanup, and viewport bounds.

## 2026-09-08: Compact matchups separate opposing teams

Two-team compact matches and match history on both dashboards use equal left/right team columns
with a dedicated centered versus column. Mirror the opponent's alignment, keep
teammates stacked together, and put statistics below names so full BattleTags
remain readable. Preserve the existing domain team order, including replay
selection taking priority over manual reversal.

Race and name stay on the same line. Colored HU, Orc, UD, NE, and RDM tags sit
on the inner side: after left-side names and before right-side names. Copy icons scale below the text
height and do not increase row height. Keep the layout flat, without player or
team card backgrounds/borders. The regular dashboard uses a centered content
width capped at 1100px so matchup columns do not spread across wide monitors.

FFA and matches with three or more teams use independent groups in a wrapping
grid, without versus separators that would imply pairings. FFA has one group per
player; multi-team games keep all teammates in the same labeled group.

## ADR-009: SDK 2 is the single current prerelease contract

Status: accepted, 2026-09-05; supersedes the SDK 1 compatibility statements below.

The registry minimum is SDK 2.0.0 (published on `next`). Match Vision uses required
`gameContext` and the SDK's declared `match.result`. Generic storage commands use
parsers for both document reads and commit acknowledgements; unparsed generic
results are `unknown`. The obsolete score methods in MatchControls are removed.
The generated binding comes from the database after migration 003 removed the
retired scope. Platform and deployed app updates must be coordinated.

Preserve `scripts/migrate-legacy-score.mjs`, retained history-data migration,
corruption handling, and user/app storage isolation. Pre-v2 production data must
survive the v2 release. The registry and packed SDK HEAD verification lanes remain.


This file records decisions that must survive repeated clean reviews. They may change when assumptions change or new evidence appears, but a change must update the decision, rationale, compatibility plan, and tests. Reviewers should report implementation bugs and stale assumptions; they should not reopen a documented tradeoff without new evidence.

## ADR-008: Match Vision owns scoring through generic platform primitives

Status: accepted, 2026-09-05; supersedes ADR-007's official-only score host controls.

The app consumes the recorder outcome from SDK `state.match.result` and player
facts from SDK state. There is no separate result channel or recorder parser.
The API retains the current finished match so initial hydration and reconnects
can reconcile it. A result may arrive after the first finished snapshot; the app
therefore observes state hydration, not only the first ended lifecycle event.
Incomplete eligibility stays pending until hydrated; absent results never count.

The app owns all scoring: its own human-player wins/losses, the W3Champions
loss-at-most-120-seconds exclusion, the automatic toggle, reset after five idle
hours, manual adjustments and retained processed match IDs. Dashboard, compact
and background routes use the same controller; overlay routes only render.

Generic SDK host commands read and compare-and-swap the app's opaque document:
`application.storage.get` returns `{revision,data}` and
`application.storage.commit` accepts `{expectedRevision,data}` and returns
`{committed}`. App fields are `matchScore` and `automaticScore`. No client handler
knows those fields. A losing writer rereads and recomputes; lost acknowledgements
cannot count a completed result twice. State streams deliver the stored data to
all overlay surfaces. Persistence is per desktop profile/user/app, not cloud sync.

SDK 2 declares and validates match outcomes. The app checks whether a delivered
outcome is eligible for its scoring rules. Check the registry and packed SDK HEAD lanes.

Register `backgroundPath: '?view=background'` to count while another app is open.
Legacy import is a one-time rollout action using `scripts/migrate-legacy-score.mjs`
in the desktop host's storage context, with the correct authenticated user and
saved automatic preference. It never overwrites an existing app document or
removes the old score. Background execution and API/client/app changes need a
coordinated rollout; builds do not perform it.

## ADR-007: Separate shared game context from Match Vision score

Status: accepted, 2026-09-05.

Match Vision consumes shared gameContext for scale, chat-input visibility and team colors, and application.data.matchScore for its counter. Overlay components take game context and score as separate inputs. No overlay scope is required by the new platform. Host write capability remains restricted to the official app; the stored score is not reset.

The published minimum SDK is 2.0.0. Match Vision uses the SDK's `GameContext` and `gameContext()` directly; the SDK rejects retired context shapes. The app-specific score reader reads only application.data.matchScore. Missing app data remains missing; there is no legacy score fallback. Deploy the API and app contract together.

## ADR-006: Forking source explicitly replaces local identity, not production ownership

Status: accepted, 2026-09-05.

Match Vision is both the production app and a public complex starting point. The platform exposes the same registration in its library and reference-example view. Source forks register their own app; they never reuse the official ID to acquire capabilities. `npm run app:fork -- NEW_CLIENT_ID` validates the new public definition before replacing the local generated binding and package configuration. It leaves failed fetches untouched and performs no platform writes. Tests cover identity conflicts and preflight failures. Official match-score capabilities and private deployment credentials do not transfer to forks.

## ADR-001: Consume a published SDK release and test SDK HEAD separately

Status: accepted, updated 2026-08-21.

The package manifest and lockfile consume the published `@w3booster/sdk` registry artifact. The current minimum is 2.0.0, which requires unconditional game context and the current protocol. Earlier 1.0.2 published the runtime lifetime signal, initial-finished lifecycle option, structured retry state, mode-aware team ordering, display identity, head-to-head, asset resolver, nullable team grouping, and globally serialized setting writes used by this app. A local `node_modules/@w3booster/sdk` symlink is a development convenience, not a release artifact and not evidence that clean consumers can install an SDK change.

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

History persists the optional confirmed local-player result independently of automatic
score eligibility. Later result updates enrich the same entry and survive reloads;
missing results never imply a loss. Both dashboards show the result and player races.
Only the current match can remain live. Hydration or a new match closes other
unfinished entries with an observed end time; an authorized no-match snapshot
closes all of them. Disconnects and snapshots without match access do not establish
an end. This also repairs retained history that missed earlier end events, without
inventing their outcomes.

Reverse order is scoped by match ID so a saved choice cannot leak into the next match. It applies consistently to two-team and multi-team/FFA observer layouts.

Team ordering has intentional mode-specific behavior: 1v1 observer/replay surfaces use map position, while ordinary player and team-observer surfaces keep the broadcaster's team first and FFA preserves team order. Explicit 1v1 with exactly two visible players creates one side per player even if both team IDs are absent. An explicit FFA likewise has one side per visible player when team IDs are missing; reversal reverses those sides instead of a collapsed `null` group. Dashboard and overlay both delegate to the SDK's mode-aware `standardGame.orderMatchTeams()`; do not maintain separate app ordering branches that can diverge.

The 1v1 observer/replay hero panels select the same complete player pair as the
top bar, independently of broadcaster identity. Replay viewers can occupy an
observer slot absent from the scoped players. Requiring that viewer to be a
participant hides both hero panels even when their data is present. Keep the
actual broadcaster identity for native avatar-cover calculations and ordinary
player views; selecting spectator display sides does not invent a broadcaster.

During replay playback, a broadcasterPlayerId matching a participating player
is the currently selected Warcraft player. Pin that player to the left, ahead
of map position and the saved reverse setting, so the overlay matches the native
hero panel. Apply this app-owned priority to the top bar, hero panels, and
dashboard/team layouts. Check the current player ID rather than isObserver,
which may describe the slot at replay startup. An absent or observer-slot ID
retains the canonical ordering and manual reverse choice. Preserve the saved
setting so it applies again when the viewer returns to an observer slot.
