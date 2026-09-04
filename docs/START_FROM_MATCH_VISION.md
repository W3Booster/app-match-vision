# Build your app from Match Vision

Match Vision is **public, MIT-licensed source**, not just a demo video or a closed official app. You can fork it as a complete Angular starting point: dashboard, local match history, typed settings, compact windows, and transparent stream/in-game overlays.

In W3Booster it appears both in the app library and in Examples as the **Reference implementation**. These are two discovery locations for the same app—not separate installations, settings, or ratings. Forking the source is different: your fork needs its own app registration.

## 1. See it run before registering

Fork this repository on GitHub, then clone your fork. To explore without a fork:

```sh
git clone https://github.com/W3Booster/app-match-vision.git
cd app-match-vision
npm ci
npm start
```

Use Node.js 22.22.3 or newer. Open **http://localhost:8082/?view=dashboard&demo=1**. Demo mode uses synthetic SDK data; no account, Warcraft III, or W3Booster desktop session is needed. Try `?view=overlay&demo=1` and `?view=compact&demo=1` too.

## 2. Find the code to change

| Goal | Start here |
| --- | --- |
| Change dashboard presentation | [Dashboard feature](../src/app/features/dashboard/) |
| Customize the broadcast/in-game HUD | [Overlay feature](../src/app/features/overlay/) |
| Understand SDK-to-Angular signals | [Runtime service](../src/app/core/match-vision-client.service.ts) |
| Learn durable match history | [History store](../src/app/features/dashboard/match-history.store.ts) |
| Understand profiles and display policy | [Domain code](../src/app/domain/) |
| Understand the boundaries | [Architecture](../ARCHITECTURE.md) and [decisions](../ARCHITECTURE_DECISIONS.md) |

Change a heading or component style first and verify the visible result. Keep transport, credentials, retry, and match-state reduction in the SDK. Your application owns Angular integration, presentation, and product behavior.

## 3. Give your fork its own identity

The committed binding and package configuration belong to official Match Vision. **Do not publish your fork using that client ID.** A client ID is public, but does not confer ownership, authorization, or official privileges.

1. Enable Developer Mode in W3Booster and open **Apps → Developer → Create app**.
2. Choose your own app name and configure the surfaces below.
3. Recreate the scopes and settings from the [public Match Vision definition](https://api.w3booster.com/stream/v1/app-definitions/app_7bd7c42015297f608f1e5436). Its `settingsSchema` contains the player and observer profiles used by the components; keep those fields until you deliberately adapt the consuming code. The generated TypeScript file contains resolved defaults, not the full editor schema.
4. Copy your newly created public client ID, then run:

   ```sh
   npm run app:fork -- YOUR_NEW_CLIENT_ID
   npm run check
   ```

The fork command fetches and validates your new public definition before changing local files. It replaces the binding at the configured Angular path and updates package.json. Failed fetches leave the old files intact. It never changes a database record, transfers ownership, or deploys anything. Type-check failures after a successful bind mean your new schema and the consuming components need to be aligned.

5. Commit `package.json` and `src/app/core/w3booster-app.generated.ts`. Update the name, repository link, branding, and your deployment workflow. Keep the MIT notice and review [third-party media notices](../THIRD_PARTY_NOTICES.md).

Ordinary SDK `init` deliberately rejects replacing an existing identity. `app:fork` is the explicit operation for this situation; `w3booster:sync` is for later updates to the same app.

## 4. Launch authorized live data

Keep `npm start` running from this repository. In your own app's **Test locally** settings use:

| Surface | URL |
| --- | --- |
| Application | `http://localhost:8082/?view=dashboard&demo=0` |
| Stream overlay | `http://localhost:8082/?view=overlay&demo=0` |
| In-game overlay | `http://localhost:8082/?view=overlay&demo=0` |

Start the local test and launch through W3Booster. Do not test by copying a user launch URL. The SDK receives authorization automatically; direct localhost navigation does not grant live data access. A synchronized connection waiting for a match is normal. Live errors must not fall back to demo data.

## What does not carry over

- **Match-score writes are restricted to official Match Vision.** Your new app will not gain `match-score:write`. The existing UI checks host capabilities and disables unavailable actions; keep those checks or remove the controls.
- Your users, grants, settings, ratings, and installation count are separate. Forking code copies none of them.
- App pages are sandboxed browser content. There is no general SDK filesystem, shell, or process API. Supported window and settings actions go through the authenticated host.
- MIT covers the source code, not automatic rights to third-party media or unrestricted access to platform data. Source reuse does not bypass platform plans, scopes, or commercial-use requirements.
- The production-trigger workflow is guarded to `W3Booster/app-match-vision`. A fork needs its own static hosting/deployment setup, not W3Booster's private deployment secret.

## 5. Check and publish

Run `npm run check` for tests and a production build. Use `npm run w3booster:sync` explicitly after changes to your registered definition. `npm run w3booster:check` checks its public revision in connected environments; normal installation and builds do not refresh definitions over the network.

Deploy the generated browser bundle under `dist/` to your own HTTPS host and update your registered surface URLs with `demo=0`. Use the W3Booster compositor URL for OBS. See the [publishing guide](https://website.w3booster.com/developer/publishing/).

If this is more application than you need, start with the [minimal TypeScript starter](https://github.com/W3Booster/app-starter) or a [focused example](https://github.com/W3Booster/app-examples).
