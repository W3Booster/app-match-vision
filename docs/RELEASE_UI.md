# UI release gate

Run `npm run check && npm run test:release:ui` before activating a release.
Both public registry CI and the platform deployment action run this gate. It
serves the exact production `dist/match-vision/browser` bundle in Electron 15.0.0 (Chromium 94). The desktop lane asserts that
`AbortSignal.throwIfAborted` is absent and Angular's development API is unavailable.
No compatibility polyfill or production application test hook is installed.

The test owns a loopback HTTP/WebSocket host with SDK protocol snapshots, host
responses and in-memory settings/storage. These are synthetic matches, explicitly
separate from the real installed-game acceptance test. All catalog images come
from the generated, hash-checked game revision; no empty image responses or
placeholder textures count as successful loads. Every rendered Warcraft image
must decode to 64 × 64. Missing catalog/icon slots, HTTP errors, application errors
and SDK/catalog warnings fail the test. Electron's unpackaged-shell CSP notice
is the only ignored warning.

| Area | Assertions |
| --- | --- |
| Artwork | Classic/Reforged selection, real image decoding, catalog removal/restoration |
| Control groups | Icons and exact 13/24 counts, chat and observer/replay visibility |
| Heroes | New Forsaken Paladin's four skills, cooldown, health/mana, XP, items |
| Production | Building/unit icons, active/waiting queue, construction, research uses next-level art |
| Upgrades | All three level indicators and exact level-specific textures |
| Army composition | Exact counts, illusions/deaths excluded, ascending per-unit gold cost, both sides/artwork families, shared slot, two real 10-second rotations, disabled/empty fallbacks, settings defaults |
| Item bonuses | Catalog-derived Claws/Ring corner numbers and gradients, mixed ordinary/cooldown items, duplicate/replaced slots, missing catalog, settled-animation screenshots |
| Layouts | Self-play, replay/observer 1v1, 2v2, FFA; geometry matrix also checks narrow viewports |
| Settings/lifecycle | Delivered visibility settings, restoration, match end/start, reconnect with new state |
| Dashboard | Score increments/reset, automatic result, explanation dialog, persistence, reverse players, history filters, compact launch |
| Compact/background | Score and text-size controls, background connection/storage initialization without visible HUD |
| Deeper regressions | Existing geometry/progress/transitions, hero order permutations and illusion exclusion |

`tmp/release-ui/suite.json` records all four Electron steps and total runtime.
`tmp/release-ui/electron15/` contains production screenshots and JSON reports;
Public CI uploads these as diagnostic artifacts, including failure evidence.
Artifact-storage availability cannot bypass a test failure or block an otherwise
passing deployment; the platform release action runs the gate directly and uses
its job logs without an artifact handoff. The wrapper creates
and closes its own development server for the additional geometry tests, without
reusing another developer's process. Game input remains entirely outside this test.

For a Warcraft patch candidate, set `W3BOOSTER_STATIC_ROOT` to the platform's
`apps/static/public` directory and `W3BOOSTER_GAME_DATA_ID` to the generated
revision. The production smoke serves that candidate's real bytes at asset
requests. Update the reviewed demo revision before release. These variables do
not relax catalog integrity or missing-image checks. The supplemental geometry
matrix uses its own historical excerpt; it is not artwork evidence.

The real installed Windows launcher/updater, game capture, compositor positioning,
authentication provider, and native memory readers still require the platform's
owned-session acceptance test and recorder gates. UI fixtures do not prove those
external integrations.

Regression proof (2026-09-13): a disposable production build with registry SDK
4.0.1 fails this gate in Electron 15 on `signal.throwIfAborted`, before any artwork
check can pass. The same source with SDK 4.0.2 passes the production Electron gate.
`W3BOOSTER_UI_ROOT` selects a disposable built artifact for this negative check;
`W3BOOSTER_UI_LABEL` separates its evidence from the passing release reports.

A second negative control replaces one generated Forsaken Paladin icon in an
isolated static-assets directory with invalid PNG bytes. The HTTP request still
succeeds, but the production gate rejects the image during browser decoding.
`tmp/release-ui/regression-broken-art/` holds that failure evidence.

The supplementary geometry tests use JSON-only fixture cloning and convert
Chromium 94’s pre-zoom rectangles to viewport coordinates, corroborated by hit
testing. They do not change application styles or polyfill browser APIs. Every
UI session owns a temporary profile, preventing settings leaking between runs.
