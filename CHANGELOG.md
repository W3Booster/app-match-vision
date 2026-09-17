# Match Vision releases

## 1.4.0

- Smooth health, mana and active production/building progress through SDK 4.4, including replay speed changes and Human power-building. Reconnects restore current values.

- Keep production and construction below shared allied hero portraits during play, including an allied hero in slot 4 when you have only one hero. Long queues scroll within the remaining space.
- See remaining charges on multi-use inventory items: filled dots show what remains and empty dots show the normal starting capacity. The last charge stays visible.
- Counts above normal capacity use a numeric badge. Single-use items and unavailable charge observations have no indicator. Both Classic and Reforged artwork are supported.

## 1.3.1

- Upgrade to SDK 4.3.0 for resource-read invalidation and recovery. Missing economy readings remain unavailable, while observed zero values are preserved.
- Receive the improved resource recorder through the coordinated W3Booster release.

## 1.3.0

- Low-mana abilities are more clearly disabled. A continuous blue bar fills left to right on both sides toward the casting cost and disappears when enough mana is available; cooldowns stay independent.
- Ability level markers sit flush beside the right edge of the artwork.
- Army composition and upgrades stay visible in separate rows, with units above upgrades. Upgrades move up when the unit row is empty or disabled.
- Both army rows read from cheapest to most expensive left to right, including the opponent’s side.
- Missing building-upgrade timers show `?` instead of a false pause indicator.
- Enemy gameplay panels remain hidden during self-play even if enemy data is supplied.

Observed mana-recovery estimates appear when supported by the recorder. Unknown readings are not guessed. APM, local-player resources, and hero damage and healing totals remain available through the recorder/SDK for other apps.

## 1.2.0 — 2026-09-13

- See your army composition with unit counts, ordered from lowest to highest gold cost. It shares the upgrades slot, switching every ten seconds when both have content, and is enabled by default.
- Follow building upgrades with the destination artwork, progress, and a small upward arrow.
- See item cooldowns directly in the inventory, using the familiar ability countdown style.
- Tell Claws of Attack and Rings of Protection apart with their bonus values on the icon. Unit counts and item bonuses use compact corner shading and soft-shadow text.
- Find the Match Vision version in its dashboard inside W3Booster.

The release version is 1.2.0. The initial 1.0.0 label for this update was corrected before news publication.


## 2026-09-11

- Keep hero panels in Warcraft's native hero order, with deterministic instance-ID
  ordering while that information is unavailable.
- Exclude illusion copies from hero panels and production views.
- Show 1v1 research six icons per row with 3px spacing and no enclosing background
  or outline. Weapon and armor upgrades appear before other research.
- Adopt SDK 3.1.0. The application settings definition is unchanged.
