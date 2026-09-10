# SDK 3 release

Match Vision uses the published `@w3booster/sdk@3.0.0` and protocol 3.
The platform deploy workflow regenerates/checks its database-owned binding.
Deploy the matching platform, native recorder, compositor, and client together.

Release screenshots use real recorder snapshots and verified public Top Replays:

```sh
MV_CAPTURE_SNAPSHOT=/path/to/replay-observation.json \
MV_CAPTURE_REPLAY_URL=https://warcraft3.info/replays/140746 \
MV_CAPTURE_DIR=/tmp/match-vision-release node scripts/capture-release.mjs
```

Run the canonical checkout on 8082 and the static catalog on 8083. The capture
verifies participants, rejects excluded players and fixture aliases, and renders
real data in dashboard, compact, and self-play match-bar panels.
