# Contributing to Match Vision

1. Use Node.js 22.22.3 or newer.
2. Run `npm install` and open `http://localhost:8082/?view=dashboard&demo=1`.
   Until SDK 0.2 is published—or when changing the SDK alongside this app—run `npm run sdk:link-local` after installing dependencies.
3. Keep platform transport, authentication, retry, recorder integration, and state hydration inside `@w3booster/sdk`.
4. Consume SDK domain types directly; keep app-specific display choices in small, pure selectors.
5. Add or update a focused test for behavior changes.
6. Run `npm run check` before opening a pull request.

Run `npm run w3booster:sync` when the database-owned application settings definition changes, review the generated diff, and commit it. Installs and builds intentionally do not contact the settings endpoint; CI uses `npm run w3booster:check` when credentials are configured.

Use abort-scoped SDK lifetimes for connections and subscriptions. Do not add application-owned reconnect timers, direct WebSockets, backend selection parsing, recorder merging, or arrays of SDK unsubscribe callbacks.

Keep pull requests small and explain visible behavior changes. Do not commit credentials, browser-source secrets, generated `dist/` files, or local development logs.

Follow the dependency direction in `ARCHITECTURE.md`: the shell may compose features, features may use domain selectors and shared Warcraft assets, but domain code must not depend on Angular components or platform implementation details.
