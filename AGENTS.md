# Agent & Contributor Guidelines

This file defines the conventions any automated agent (Cursor, Claude,
Copilot, etc.) or human contributor should follow when working inside
this monorepo. Read it before making changes.

---

## 1. Monorepo layout

- `server/` — Express + MongoDB + Socket.IO backend. Entry: `index.js`.
- `client/` — React 19 web app (Create React App). Entry: `src/App.js`.
- `mobile/` — Expo React Native rider app. Entry: `app/_layout.tsx`.
- `ai-core/` — Experimental; not required for the platform to run.

Cross-package refactors must update **all three** apps if they touch a
shared contract (API shape, socket event, fare rule).

---

## 2. Source-of-truth rules

These rules exist so data never drifts between apps. Violate them only
with an explicit callout in the PR description.

1. **Fare math lives in `server/utils/fareCalculator.js`.**
   Both the mobile Fare Info screen and the web Fares page must read
   from `/api/rides/fare-info`. Never hardcode rates in the clients.
2. **Socket event names are defined in `server/services/SocketService.js`.**
   Clients must import or mirror the constants, never invent new ones.
3. **Role gates are enforced on the server.**
   Client-side route guards (e.g. `RoleProtectedRoute`) are UX hints,
   not security. Every privileged endpoint must call `protect` +
   a `require*` middleware.
4. **IDs are Mongo ObjectId strings.** Do not expose numeric surrogates.

---

## 3. Code style

- **Language targets:** Node 18+, React 19, React Native 0.81. Use
  modern syntax (optional chaining, `??`, top-level `await` where valid).
- **Formatting:** two-space indentation, semicolons, trailing commas in
  multi-line arrays and objects.
- **Imports:** absolute within a package when CRA/Expo supports it;
  otherwise relative.
- **File names:** `PascalCase` for React components, `camelCase` for
  modules, `kebab-case` for CSS files.
- **Don't add one-line narration comments.** Only comment to explain
  _why_ something non-obvious exists.

### React / Framer Motion

- Scroll-triggered animations use
  `viewport={{ amount: 0.2, margin: "-80px" }}` so they fire in both
  directions. Avoid `once: true` unless the animation is specifically a
  one-shot reveal.
- Keep the 3D hero (`client/src/components/Hero3D.js`) inside a bounded
  stage. Never render it as a page-wide background overlay.
- Toast / notification primitives expect
  `{ message, type, onClose }` — when raising a toast in a parent
  component, always destructure and forward these explicitly.

### Tailwind

- Use design tokens (slate / blue) already established on the landing
  page. Don't introduce new accent palettes without updating the whole
  brand sweep.

### Server

- Keep `index.js` small. Heavy logic lives in `services/` (Socket,
  AutoCancel, Scheduling) and `routes/*.js`.
- Every new route must be documented in the route table in
  `server/README.md`.
- Every new socket event must be listed in the real-time table in the
  root `README.md`.

---

## 4. Real-time etiquette

- Dispatcher-targeted events go to the `dispatch` room.
- Driver-targeted events go to `driver:<id>`.
- Ride-scoped events go to `ride:<id>` (rider + driver + dispatch).
- Do not broadcast raw GPS packets to the public; only the `fleet:snapshot`
  aggregate is open.

---

## 5. Environments & secrets

- Never commit real secrets. `server/.env` is gitignored by convention.
- When adding a new env var, document it in both the root `README.md`
  _and_ the package's own README.
- For mobile, all runtime env vars must be prefixed `EXPO_PUBLIC_` or
  declared under `expo.extra` in `app.json`.

---

## 6. Testing & verification

- Before opening a PR, at minimum:
  - Run `npm run lint` in any package you touched (where configured).
  - Boot the affected app locally and smoke-test the modified flow.
- When modifying fare logic, run `node server/utils/__fareTest.js`.
- When modifying real-time code, verify at least one dispatch → driver
  and driver → rider round trip through the socket.

---

## 7. Safe-change checklist for agents

When you're an AI agent making non-trivial edits:

1. Read the relevant README(s) first (root + the package you're in).
2. Confirm the change doesn't violate any source-of-truth rule above.
3. If you modify the 3D hero, preserve the `mode="auto"` day/night
   behavior unless the user explicitly asks otherwise.
4. If you add a dependency, update the matching `package.json` and call
   it out in the PR description.
5. After substantive edits, run the lint / type-check tools that exist
   for the package.
6. Never commit without explicit user approval.

---

## 8. Commit messages

- Imperative mood, present tense: _"Add driver walkie channel"_.
- Reference the package when relevant: _"server: fix auto-cancel race"_.
- Do not include decorative emojis unless the user requested them.
