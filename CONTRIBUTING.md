# Contributing to Match Vision

1. Use Node.js 22.22.3 or newer.
2. Run `npm install` and open `http://localhost:8082/?view=dashboard&demo=1`.
3. Keep platform transport and authentication inside `@w3booster/sdk`.
4. Consume SDK domain types directly; keep app-specific display choices in small, pure selectors.
5. Add or update a focused test for behavior changes.
6. Run `npm run check` before opening a pull request.

Keep pull requests small and explain visible behavior changes. Do not commit credentials, browser-source secrets, generated `dist/` files, or local development logs.

Follow the dependency direction in `ARCHITECTURE.md`: the shell may compose features, features may use domain selectors and shared Warcraft assets, but domain code must not depend on Angular components or platform implementation details.
