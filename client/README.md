# Ashland Public Transit — Web Client

React 19 application that serves as the public marketing site **and**
the staff console for Ashland Public Transit. Bootstrapped with Create
React App, styled with Tailwind CSS 3, animated with Framer Motion 12,
and rendered with Three.js via `@react-three/fiber` + `drei`.

Part of the [`Ashland-Public-Transit`](../README.md) monorepo.

---

## Surfaces

| Route           | Audience                | Purpose                                                                  |
| --------------- | ----------------------- | ------------------------------------------------------------------------ |
| `/`             | Public                  | Cinematic landing page with live fleet snapshot and 3D hero.             |
| `/about`        | Public                  | Community focus, mission, service footprint.                             |
| `/services`     | Public                  | Service types (scheduled, same-day, accessible, companions).             |
| `/fares`        | Public                  | Fare table rendered from the shared fare calculator.                     |
| `/accessibility`| Public                  | Accessibility commitments, ADA coverage, PCA policy.                     |
| `/faq`          | Public                  | FAQ accordion.                                                           |
| `/contact`      | Public                  | Phone, email, address, contact form.                                     |
| `/book`         | Public / rider          | Web booking form with fare estimation.                                   |
| `/track`        | Public / rider          | Live ride tracking (Leaflet + socket).                                   |
| `/dashboard`    | Dispatcher / admin      | Command center (rides, alerts, broadcast, walkie, rider 360).            |
| `/fleet`        | Dispatcher / admin      | Fleet manager — vehicles, drivers, assignments, audit log.               |
| `/driver`       | Driver / admin          | Driver portal — manifest, GPS push, status toggles, nav map, walkie.     |

Role-based routing lives in `src/App.js` via `RoleProtectedRoute`.

---

## Landing page & 3D hero

The landing page (`src/components/LandingPage.js`) uses a **bounded**
two-column layout so copy never competes with art:

- **Left column** — eyebrow badge, headline, subtitle, CTAs, trust grid.
- **Right column** — a `rounded-3xl` stage containing `<Hero3D />` plus
  four glassy HUD overlays (live status, fleet count, Route ASH-04
  card, telemetry grid).

Below the hero, a horizontal **bus marquee** animates infinitely on a
dashed road line — the signature motif of the brand.

### `Hero3D` day / night mode

`src/components/Hero3D.js` exposes a `mode` prop:

```jsx
<Hero3D />                   // mode="auto" — picks day (06:00-18:59) or night
<Hero3D mode="day" />        // force daylight palette
<Hero3D mode="night" />      // force night palette
```

In `auto` mode, the scene re-evaluates the time of day once per minute,
so palette transitions happen naturally if a viewer sits through
sunset or sunrise. The palette controls background, fog, asphalt,
windows, headlights (dim by day / bright at night), street-lamp bulbs
(off by day / on at night), skyline building lights, and a sun/moon
sphere in the sky.

---

## Component tour

| File                                             | Responsibility                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `components/LandingPage.js`                      | Public hero, sections, marquee, live map, testimonials, CTA.       |
| `components/Hero3D.js`                           | WebGL scene (bus, road, skyline, sun/moon, route arc, GPS dot).    |
| `components/SiteNavbar.js` / `SiteFooter.js`     | Public shell, staff dropdown (Dispatcher / Driver), brand links.   |
| `components/MarketingPages.js`                   | About, Services, Fares, Accessibility, FAQ, Contact.               |
| `components/BookingForm.js`                      | Public booking with fare estimate + capacity check.                |
| `components/TrackRide.js`                        | Live ride tracker (Leaflet + socket).                              |
| `components/LoginModal.js`                       | Dual-role staff login modal.                                       |
| `components/DispatcherDashboard.js`              | Dispatcher command center.                                         |
| `components/Rider360Modal.js` / `Driver360Modal` | Full lifecycle modals for riders and drivers.                      |
| `components/FleetManager.js`                     | Vehicle & driver CRUD, assignments, toast notifications.           |
| `components/BroadcastCenter.js` / `WalkiePanel`  | Real-time messaging to drivers.                                    |
| `components/DriverView.js` / `DriverNavMap.js`   | Driver portal + turn-by-turn map.                                  |
| `components/LiveFleetMap.js` / `LeafletMap.js`   | Leaflet maps for dispatch + public.                                |
| `components/Toast.js`                            | Toast notification primitive (`{ message, type, onClose }`).       |
| `services/api.js`                                | Axios instance + typed API helpers.                                |

---

## Getting started

```bash
npm install
npm start          # http://localhost:3000
```

During development CRA proxies `/api` to the server on port 5000 via
`src/services/api.js`. For deployment, set `REACT_APP_API_URL` and
`REACT_APP_SOCKET_URL` in a `.env` file at the `client/` root.

### Scripts

| Command         | What it does                                           |
| --------------- | ------------------------------------------------------ |
| `npm start`     | CRA dev server, hot reload on port 3000.               |
| `npm run build` | Production bundle in `build/`.                         |
| `npm test`      | React Testing Library / Jest watcher.                  |
| `npm run eject` | CRA eject (irreversible — not recommended).            |

---

## Styling & animation

- **Tailwind CSS 3** — utility-first; configuration in `tailwind.config.js`.
- **Framer Motion 12** — declarative animations, scroll reveals. Scroll
  sections use `viewport={{ amount: 0.2, margin: "-80px" }}` (not `once`)
  so animations replay going up as well as down.
- **Three.js / @react-three/fiber / drei** — the hero stage. Uses ACES
  filmic tone mapping and sRGB output for cinematic color.
- **Lucide React** — icon set.
- **Recharts** — dispatcher KPI charts.

Glass-panel, aurora, and grid-overlay utilities live in `src/index.css`.

---

## Accessibility

- The 3D canvas is `aria-hidden="true"` — all critical copy lives in
  real DOM alongside it.
- Color contrast targets WCAG AA across the landing page and portals.
- Forms use native labels + `aria-*` attributes; the booking flow is
  operable end-to-end with keyboard only.

---

## Deployment notes

- CRA produces a static bundle. Any static host (Vercel, Netlify,
  S3+CloudFront, GitHub Pages) works. Set the `REACT_APP_*` env vars
  at build time.
- A Capacitor wrapper (`@capacitor/*`) is scaffolded for packaging the
  dispatcher / driver UI into an Android app if needed — it is not
  required for normal web deployment.

---

## Troubleshooting

- **Blank 3D stage** — your browser may not support WebGL. `Hero3D`
  falls back to `null` in that case; the stage background still renders.
- **Leaflet tiles not loading** — check that the host is allowed to
  reach `tile.openstreetmap.org`. For production, swap to a paid tile
  provider in `LeafletMap.js`.
- **CORS errors in dev** — make sure the server is running on port 5000
  and `cors()` is enabled (it is by default in `server/index.js`).
