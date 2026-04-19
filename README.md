# Ashland Public Transit

> A civic-grade, real-time transit platform built for Ashland, Ohio.
> Rider mobile app, dispatcher & driver web portals, and a live
> Socket.IO-powered Express + MongoDB backend — all in one monorepo.

Originally developed as an Ashland University URCA senior thesis project,
this system is now a full production-style demo of how a small city can
run a reliable, accessible, on-demand transit service with live
visibility for riders, drivers, and dispatch.

---

## Table of contents

- [What's inside](#whats-inside)
- [Architecture](#architecture)
- [Feature highlights](#feature-highlights)
- [Theming (light / dark / system)](#theming-light--dark--system)
- [APT Assist — in-app AI chatbot](#apt-assist--in-app-ai-chatbot)
- [Brand system](#brand-system)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Roles & permissions](#roles--permissions)
- [Real-time events](#real-time-events-socketio)
- [API overview](#api-overview)
- [Fare calculator](#fare-calculator)
- [Repository layout](#repository-layout)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## What's inside

| Package   | Description                                                                  | Default URL             |
| --------- | ---------------------------------------------------------------------------- | ----------------------- |
| `server`  | Express + Mongoose API and Socket.IO real-time layer.                        | `http://localhost:5000` |
| `client`  | React 19 web app — public site, dispatcher console, fleet, driver, admin.    | `http://localhost:3000` |
| `mobile`  | Expo React Native rider app — booking, live tracking, QR boarding, profile. | Metro (Expo CLI)        |
| `ai-core` | Experimental AI/analytics side-projects (not required to run the platform).  | n/a                     |

---

## Architecture

```
┌────────────────────────────┐        ┌────────────────────────────┐
│  mobile  (Expo / RN)       │        │  client  (React 19 / CRA)  │
│  • Rider booking           │        │  • Public landing site     │
│  • Live tracking + QR      │        │  • Dispatcher console      │
│  • Push-style notifications│        │  • Fleet manager           │
│  • Profile / history       │        │  • Driver portal + navmap  │
└────────────┬───────────────┘        └────────────┬───────────────┘
             │  REST + Socket.IO                   │  REST + Socket.IO
             └──────────────────┬──────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │        server         │
                    │  Express 5 · Node 18+ │
                    │  JWT · bcrypt · CORS  │
                    │  Socket.IO 4          │
                    │  Stripe (scaffolded)  │
                    │  AutoCancelService    │
                    └───────────┬───────────┘
                                │  Mongoose
                    ┌───────────▼───────────┐
                    │       MongoDB         │
                    │  Users · Vehicles     │
                    │  Rides · AuditLog     │
                    └───────────────────────┘
```

---

## Feature highlights

### Rider (mobile)

- Google Places-powered pickup & drop-off autocomplete.
- Dynamic fare estimation with scheduled vs same-day surcharge, rider
  type (general / elderly / disabled / child / companion), and no-show
  policy pulled from `server/utils/fareCalculator.js`.
- Live ride tracking with driver GPS, ETA, and socket-pushed status
  transitions.
- QR-code boarding pass + ride history.
- **APT Assist** — in-app chatbot with FAQ answers and deep-links into
  Book / Track / Rides / Fares screens.
- **Light / Dark / System** theme with secure-stored preference and
  OS-change listeners.
- Complete profile: edit info, change password, saved places, payment
  methods (scaffolded), notifications, accessibility preferences.

### Dispatcher / admin (web)

- Live fleet map with every vehicle plotted in real time.
- Command center: pending bookings, in-progress rides, auto-cancel sweep
  for abandoned rides.
- **Rider 360** and **Driver 360** modals — full lifecycle view, notes,
  contact, audit trail.
- Broadcast center & walkie-talkie-style chat with individual drivers.
- Fleet manager (add/edit/archive vehicles, assign drivers).

### Driver (web)

- Driver portal with active manifest, next stop, turn-by-turn nav map.
- Live GPS publishing, status toggles (on-shift / break / off-shift).
- Push-broadcast receiver + walkie channel.
- Profile and password management.

### Public site (web)

- Cinematic landing page with bounded **3D hero stage** (`@react-three/fiber`).
- **Auto day/night palette** — the 3D scene shifts between light-sky and
  dark-city based on the viewer's local hour (06:00–18:59 = day).
- **Light / Dark / System** theme toggle in the navbar, applied to the
  entire public surface including a brand-blue bus marquee in light
  mode.
- Marketing pages: About, Services, Fares (sourced live from the fare
  calculator), Accessibility, FAQ, Contact.
- Dual staff portal menu: _Dispatcher_ and _Driver_ login targets.

---

## Theming (light / dark / system)

Both the public web site and the rider mobile app ship with a
first-class **light / dark / system** theme system. Every user-facing
surface adapts: backgrounds, typography, cards, modals, status bars,
marquee artwork, and the login hero gradient.

### Web (`client/`)

- Class-based Tailwind dark mode (`darkMode: 'class'` in
  `tailwind.config.js`).
- Global `ThemeContext` at `client/src/context/ThemeContext.js`
  persists the user's preference in `localStorage`, listens for
  OS-level changes via `window.matchMedia('(prefers-color-scheme: dark)')`,
  and applies the `dark` class on `<html>`.
- A tiny inline script in `client/public/index.html` applies the
  resolved theme **before React mounts**, eliminating FOUC.
- The landing-page **bus marquee** swaps palettes automatically —
  Ashland brand-blue in light mode, dark steel in dark mode — while the
  separate 3D hero keeps its own time-of-day palette.

> Theme scope on the web is the **public surface only**: landing,
> marketing pages, navbar, footer, book, track, and the login modal.
> The dispatcher / driver / fleet consoles intentionally stay on the
> existing operator palette.

### Mobile (`mobile/`)

- Global `ThemeContext` at `mobile/context/ThemeContext.js` with three
  modes: `light`, `dark`, `system`.
- Preference persists via `expo-secure-store`; OS changes are observed
  through `Appearance.addChangeListener`.
- Semantic color tokens in `mobile/constants/theme.js` power a
  `makeStyles(colors)` pattern — each screen receives a styles factory
  so colors stay in sync.
- Root background is pushed to the native layer via `expo-system-ui`
  and the status bar style tracks the resolved theme through
  `expo-status-bar`.
- Settings screen exposes a three-button **Appearance** picker
  (Light / Dark / System).

---

## APT Assist — in-app AI chatbot

The rider mobile app includes **APT Assist**, a lightweight in-app
assistant for FAQs and quick navigation.

- **Surface:** floating chat bubble on core rider screens +
  full-screen chat view.
- **Engine:** rule-based intent classifier in
  `mobile/utils/chatbotEngine.js`, reading from a curated knowledge
  base at `mobile/constants/chatbotKnowledge.js`. Keyword scoring +
  regex matching produce deterministic, offline-capable answers with
  zero external API cost.
- **Quick actions:** replies can deep-link into the app — e.g.
  "Book a ride," "Track my ride," "See fares," "Call dispatch" —
  by dispatching navigation events back into the screen stack.
- **LLM-ready:** `getReply()` is async with a simulated typing delay,
  so swapping in a server-side LLM endpoint later is a drop-in change.

Files:

```
mobile/constants/chatbotKnowledge.js    # FAQs, intents, actions, fallback
mobile/utils/chatbotEngine.js           # Pure classifier (no side-effects)
mobile/screens/ChatbotScreen.js         # Full-screen chat UI
mobile/components/ChatbotBubble.js      # Floating FAB + pulsing glow
```

---

## Brand system

A single brand mark is used everywhere — tab favicon, web navbar /
footer, mobile auth screen, and mobile chatbot UI.

- **Master SVGs** — `client/public/logo.svg` (square mark,
  blue→indigo gradient tile with white bus silhouette) and
  `client/public/logo-wordmark.svg` (horizontal lockup).
- **Web component** — `client/src/components/BrandLogo.js` provides a
  single reusable `<BrandLogo />` with `size`, `showWordmark`,
  `animate`, and `tone` (`auto` / `onDark` / `onLight`) props.
- **Mobile component** — `mobile/components/BrandLogo.js` mirrors the
  web component using `expo-linear-gradient` + `@expo/vector-icons`
  so the mark is crisp on any device density.
- **Favicon / PWA manifest** — `client/public/index.html` and
  `client/public/manifest.json` reference the SVG mark exclusively;
  legacy React CRA favicon assets have been removed.

---

## Tech stack

| Layer         | Libraries                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend       | Node 18+, Express 5, Mongoose 9, Socket.IO 4, JWT, bcrypt, helmet, express-rate-limit, express-mongo-sanitize, xss-clean, morgan, Stripe (scaffold) |
| Web client    | React 19, React Router 7, Tailwind CSS 3 (class-based dark mode), Framer Motion 12, Three.js + @react-three/fiber + drei, Recharts, Leaflet, @react-google-maps/api, Axios |
| Mobile client | Expo 54, React Native 0.81, Expo Router 6, react-native-reanimated 4, react-native-maps, expo-location, expo-haptics, expo-linear-gradient, expo-secure-store, expo-system-ui, @expo/vector-icons, react-native-qrcode-svg |
| Tooling       | Create React App (client), Expo CLI (mobile), ESLint, PostCSS, Capacitor (Android wrapper scaffold)                                                |

---

## Quick start

> **Prereqs:** Node.js **18+**, a running MongoDB (local or Atlas), and a Google Maps API key with _Places API (New)_, _Maps SDK for Android_, and _Maps SDK for iOS_ enabled.

```bash
# 1. Server
cd server
npm install
cp .env.example .env   # then edit (see Environment variables)
npm run dev

# 2. Web client (in a new terminal)
cd client
npm install
npm start              # → http://localhost:3000

# 3. Mobile (in a new terminal)
cd mobile
npm install
npm start              # Expo CLI will show a QR code for device preview
```

Seed an admin and a test user once the server is up:

```bash
cd server
node seed.js           # seeds demo vehicles / config
node testAdmin.js      # creates a default admin account
node testUsers.js      # creates example rider accounts
```

---

## Environment variables

### `server/.env`

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/ashland-transit
JWT_SECRET=replace-with-a-long-random-string
# Optional: Stripe (payments scaffolded, disabled by default)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### `mobile/.env` (or `mobile/app.json` → `extra` block)

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

### `client` (optional `.env`)

CRA auto-proxies during development. For production, set:

```env
REACT_APP_API_URL=https://your-api.example.com/api
REACT_APP_SOCKET_URL=https://your-api.example.com
```

---

## Scripts

Run from each package directory.

| Package  | Command              | Purpose                                  |
| -------- | -------------------- | ---------------------------------------- |
| `server` | `npm run dev`        | Node `--watch` hot-reload (port 5000).   |
| `server` | `npm start`          | Production server.                       |
| `server` | `node seed.js`       | Seed demo vehicles.                      |
| `server` | `node testAdmin.js`  | Create / reset the default admin.        |
| `server` | `node resetAdmin.js` | Reset admin credentials interactively.   |
| `client` | `npm start`          | CRA dev server (port 3000).              |
| `client` | `npm run build`      | Production bundle → `client/build/`.     |
| `client` | `npm test`           | React Testing Library / Jest.            |
| `mobile` | `npm start`          | Expo dev server + Metro.                 |
| `mobile` | `npm run android`    | Launch on Android emulator/device.       |
| `mobile` | `npm run ios`        | Launch on iOS simulator.                 |
| `mobile` | `npm run lint`       | `expo lint`.                             |

---

## Roles & permissions

Authentication is JWT-based. A single `User` document has a `role` field:

| Role         | Web portals                                   | Mobile app |
| ------------ | --------------------------------------------- | ---------- |
| `rider`      | —                                             | ✅         |
| `driver`     | Driver portal (`/driver`)                     | —          |
| `dispatcher` | Dispatcher (`/dashboard`), Fleet (`/fleet`)   | —          |
| `admin`      | All web portals + destructive admin actions   | —          |

Server middleware (`server/middleware/authMiddleware.js`) exposes:

- `protect` — require any authenticated user.
- `requireDispatcherOrAdmin`
- `requireDriver`
- `requireAdmin`

---

## Real-time events (Socket.IO)

The server uses named rooms for dispatch and driver targeting. See
`server/services/SocketService.js` for the authoritative list. Key events:

| Direction        | Event                     | Payload summary                                        |
| ---------------- | ------------------------- | ------------------------------------------------------ |
| client → server  | `driver:location`         | `{ driverId, lat, lng, heading, speed }`               |
| client → server  | `driver:status`           | `{ driverId, status }` (on-shift / break / off)        |
| client → server  | `dispatch:message`        | `{ toDriverId, text }` (walkie / broadcast)            |
| server → client  | `ride:updated`            | Ride status transitions (dispatch, rider, driver).     |
| server → client  | `fleet:snapshot`          | Periodic active-vehicle broadcast for the public site. |
| server → client  | `driver:manifest`         | Updated manifest for a driver's next stops.            |
| server → client  | `dispatch:broadcast`      | Message pushed to all drivers or a specific driver.    |

---

## API overview

Base URL: `http://localhost:5000/api`. Full route definitions live in
`server/routes/authRoutes.js` and `server/routes/rideRoutes.js`.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET  /auth/me` (auth)
- `PATCH /auth/profile` (auth)
- `PATCH /auth/change-password` (auth)

### Rides

- `POST /rides` — create rider booking.
- `GET  /rides/my-rides` (auth) — rider history.
- `GET  /rides/:id` — fetch ride.
- `PATCH /rides/:id/status` — update status (driver / dispatch).
- `PATCH /rides/:id/vehicle` — assign vehicle.
- `POST /rides/estimate-fare` — open; returns a fare breakdown.
- `POST /rides/check-capacity` — open; future-dated seat availability.
- `GET  /rides/track/:id` — open; public tracking payload.
- `GET  /rides/fare-info` — open; fare policy for marketing site.

### Fleet & staff

- `GET  /rides/fleet/live` — open; public snapshot for landing-page HUD.
- `POST /rides/fleet/driver-ping` — open; GPS fallback endpoint.
- Dispatcher- and admin-only endpoints for vehicles, drivers, broadcast,
  rider 360, driver 360 are guarded by `requireDispatcherOrAdmin`.

The public "open" endpoints above are exempt from the 200-req/15-min
rate limiter configured in `server/index.js`.

---

## Fare calculator

`server/utils/fareCalculator.js` is the single source of truth for:

- Rate tables (General, Elderly/Disabled, Child w/wo adult, Companion).
- Scheduled vs same-day differential.
- No-show fee.
- Service hours (Mon–Sat 06:00–21:00).

Both the mobile Fare Info screen and the web Fares page read from it so
published rates can never drift from the fares actually charged at
booking time. Internal tests live in `server/utils/__fareTest.js`.

---

## Repository layout

```
.
├─ ai-core/                # Experimental AI/analytics prototypes
├─ client/                 # React web app (CRA)
│  ├─ public/              # logo.svg, logo-wordmark.svg, manifest.json
│  └─ src/
│     ├─ components/       # DispatcherDashboard, DriverView, FleetManager,
│     │                    # LandingPage, Hero3D, MarketingPages, BrandLogo,
│     │                    # ThemeToggle, etc.
│     └─ context/          # ThemeContext (light / dark / system)
├─ mobile/                 # Expo React Native rider app
│  ├─ app/                 # Expo Router entry
│  ├─ screens/             # Rider flows (booking, tracking, profile,
│  │                       # ChatbotScreen, …)
│  ├─ components/          # HeroCanvas, PlacesInput, BrandLogo,
│  │                       # ChatbotBubble, …
│  ├─ constants/           # theme.js (semantic tokens),
│  │                       # chatbotKnowledge.js
│  ├─ context/             # ThemeContext
│  └─ utils/               # chatbotEngine.js
├─ server/
│  ├─ config/db.js         # Mongoose connection
│  ├─ controllers/         # authController, rideController
│  ├─ middleware/          # authMiddleware (JWT + role gates)
│  ├─ models/              # User, Vehicle, Ride, AuditLog, SystemSetting
│  ├─ routes/              # authRoutes, rideRoutes (all HTTP routes)
│  ├─ services/            # SocketService, AutoCancelService, SchedulingService
│  ├─ utils/fareCalculator.js
│  └─ index.js             # App entry (Express + Socket.IO)
├─ AGENTS.md               # Agent/contributor conventions
├─ TECHNICAL_SUMMARY.md    # URCA thesis deep-dive
└─ README.md               # You are here
```

---

## Troubleshooting

### `MongooseError: Operation buffering timed out after 10000ms`

Your `MONGO_URI` is unreachable or the DB isn't running. Start MongoDB
locally (`mongod`) or paste a valid Atlas connection string into
`server/.env`.

### Driver portal shows "Driver GPS Waiting"

- Allow the browser's location permission for the driver page.
- Make sure OS-level location services are on (Windows / macOS).
- The portal must be served over `localhost` or HTTPS — plain `http://`
  on a LAN IP will be rejected by modern browsers.

### Expo app cannot reach the server

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` to your dev
machine's LAN IP (e.g. `http://192.168.1.42:5000`). `localhost` inside
an emulator or physical device points at the device itself.

### Web client won't build after a dependency change

Delete `client/node_modules` and `client/package-lock.json`, then
`npm install` fresh. Three.js + `@react-three/*` peer versions in
particular are strict about matching.

### Hero 3D looks dark at noon / bright at night

The scene auto-selects its palette from `new Date().getHours()`. If you
want to force a mode for a demo, edit `client/src/components/LandingPage.js`
and pass `<Hero3D mode="day" />` or `<Hero3D mode="night" />`. The default
`mode="auto"` re-checks every 60 seconds.

---

## License

This project is provided as-is for educational and research purposes
under the URCA senior thesis program at Ashland University. See
`TECHNICAL_SUMMARY.md` for the original thesis scope and methodology.
