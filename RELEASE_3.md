# SDK 3 coordinated release

This branch requires the unpublished SDK 3 / protocol 3 runtime. Its registry
manifest remains on the last published SDK, as required by AGENTS.md. Therefore
the published-registry CI release gate deliberately stays blocked until SDK 3
is published and `npm install --save-exact @w3booster/sdk@3.0.0` updates both the
manifest and lockfile. Do not merge or deploy this branch ahead of that step.

The packed SDK CI lane pins the SDK review commit and builds/tests the complete
app, including browser regressions. Regenerate the app binding against the
coordinated production definition, verify its revision, and deploy together with
the protocol 3 platform/recorder. Existing independent example apps must also be
rebuilt with SDK 3 before that backend switch.

Changes: instance-map heroes/buildings; hero HP/mana; compact animated training
and construction countdowns; independent visibility settings; corrected legacy
PRO access; provider-aware statistics, Battle.net leagues/loading states; mirrored
stats layouts; fixed match-bar placement and independent hero controls.

Capture review screenshots from the canonical checkout running on 8082:

```sh
MV_CAPTURE_DIR=/tmp/match-vision-release node scripts/capture-release.mjs
```

The capture also requires the local static catalog on 8083. It uses demo aliases
and statistics, stops the demo timer, and fails on browser errors or broken icons.
