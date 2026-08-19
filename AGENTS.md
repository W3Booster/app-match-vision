# Match Vision contributor guidance

Read `ARCHITECTURE.md` and `ARCHITECTURE_DECISIONS.md` before proposing architectural changes. The decision record captures tradeoffs made during repeated SDK/application reviews. Revisit a decision only when its assumptions changed or new evidence appears; do not reverse it merely because another direction is also plausible.

Match Vision is an independent public repository and consumes `@w3booster/sdk` as a third-party frontend would. Keep its package and lockfile on published registry artifacts. Use `npm run sdk:link-local` only for deliberate cross-repository development, and verify both the minimum registry SDK and packed SDK HEAD lanes for SDK-related changes.
