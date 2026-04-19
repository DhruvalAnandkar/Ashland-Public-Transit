# Ashland Public Transit — Server

Express 5 + MongoDB + Socket.IO backend powering the rider mobile app,
dispatcher/fleet/driver web portals, and the public landing site.

Part of the [`Ashland-Public-Transit`](../README.md) monorepo.

---

## Layout

```
server/
├─ config/
│  └─ db.js                      # Mongoose connection (singleton)
├─ controllers/
│  ├─ authController.js          # register / login / me
│  └─ rideController.js          # legacy thin wrapper (main logic in routes)
├─ middleware/
│  └─ authMiddleware.js          # protect, requireDispatcherOrAdmin,
│                                 # requireDriver, requireAdmin
├─ models/
│  ├─ User.js                    # rider / driver / dispatcher / admin
│  ├─ Vehicle.js                 # fleet vehicle
│  ├─ Ride.js                    # booking + status lifecycle
│  ├─ AuditLog.js                # immutable audit trail
│  └─ SystemSetting.js           # runtime config document
├─ routes/
│  ├─ authRoutes.js              # /api/auth/*
│  └─ rideRoutes.js              # /api/rides/* (rides + fleet + public)
├─ services/
│  ├─ SocketService.js           # Socket.IO gateway (auth + rooms + events)
│  ├─ AutoCancelService.js       # Background sweep for expired / no-show rides
│  └─ SchedulingService.js       # Scheduled-ride helpers
├─ utils/
│  ├─ fareCalculator.js          # Single source of truth for fares
│  └─ __fareTest.js              # Internal fare test harness
├─ seed.js                       # Seed demo vehicles / config
├─ testAdmin.js  / resetAdmin.js # Bootstrap the default admin account
├─ testUsers.js  / resetDriver.js
├─ resetAllDrivers.js
└─ index.js                      # App entry (HTTP + Socket.IO)
```

---

## Getting started

```bash
npm install
cp .env.example .env   # or create .env by hand — see below
npm run dev            # node --watch index.js on port 5000
```

Health check: `GET http://localhost:5000/` → `{ status: "Healthy" }`.

### Environment (`server/.env`)

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/ashland-transit
JWT_SECRET=replace-with-a-long-random-string

# Optional — Stripe is scaffolded but disabled by default
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Seed accounts

```bash
node seed.js          # demo vehicles + default system config
node testAdmin.js     # creates the default admin user
node testUsers.js     # creates example rider accounts
node resetAdmin.js    # reset admin credentials
node resetDriver.js <id>
node resetAllDrivers.js
```

---

## Security baseline

Middleware stack applied in `index.js`:

- `express.json()` for JSON bodies.
- `cors()` — currently permissive for dev; lock the origin list in prod.
- `helmet()` for standard security headers.
- `morgan('dev')` for request logs.
- `express-rate-limit` — **2000 req / 15 min** in dev, **200 req / 15 min**
  in production. A small allowlist of open read endpoints (live fleet,
  fare info, public tracking) is exempt so the landing page stays snappy.
- Mongo-sanitize + xss-clean are available in `package.json` and should
  be wired in before production launch.

Authentication uses short-lived **JWT** bearer tokens. Passwords are
hashed with **bcryptjs** (cost 10). Role gates are enforced server-side
— never trust client-sent roles.

---

## Route index

Base URL: `/api`.

### `authRoutes.js` (`/api/auth`)

| Method | Path                 | Auth    | Purpose                            |
| ------ | -------------------- | ------- | ---------------------------------- |
| POST   | `/register`          | public  | Create a rider account             |
| POST   | `/login`             | public  | Exchange email/password for JWT    |
| POST   | `/forgot-password`   | public  | Send reset link / code             |
| POST   | `/reset-password`    | public  | Complete password reset            |
| GET    | `/me`                | bearer  | Current user + computed stats      |
| PATCH  | `/profile`           | bearer  | Update profile fields              |
| PATCH  | `/change-password`   | bearer  | Change password (old → new)        |

### `rideRoutes.js` (`/api/rides`) — highlights

**Public / open** (rate-limit exempt):

| Method | Path                        | Purpose                                    |
| ------ | --------------------------- | ------------------------------------------ |
| POST   | `/estimate-fare`            | Fare breakdown for a trip request          |
| POST   | `/check-capacity`           | Future-dated seat availability             |
| GET    | `/fare-info`                | Published fare policy for the public site  |
| GET    | `/track/:id`                | Public ride tracking payload               |
| GET    | `/fleet/live`               | Active vehicle snapshot for landing HUD    |
| POST   | `/fleet/driver-ping`        | GPS fallback when Socket.IO is unavailable |

**Rider** (bearer token):

| Method | Path              | Purpose                          |
| ------ | ----------------- | -------------------------------- |
| POST   | `/`               | Create a booking                 |
| GET    | `/my-rides`       | Ride history for the caller      |
| GET    | `/:id`            | Fetch a single ride              |
| POST   | `/:id/cancel`     | Rider-initiated cancellation     |

**Driver / dispatcher / admin** (role-gated):

| Method | Path                       | Required role               |
| ------ | -------------------------- | --------------------------- |
| PATCH  | `/:id/status`              | driver or dispatcher+       |
| PATCH  | `/:id/vehicle`             | dispatcher+                 |
| GET    | `/admin/overview`          | dispatcher+                 |
| GET    | `/admin/users`             | dispatcher+                 |
| GET    | `/admin/users/:id/profile` | dispatcher+ (Rider 360)     |
| GET    | `/admin/drivers/:id`       | dispatcher+ (Driver 360)    |
| POST   | `/admin/broadcast`         | dispatcher+                 |

See `routes/rideRoutes.js` for the authoritative, commented route table.

---

## Real-time layer

`services/SocketService.js` owns the Socket.IO server, authentication,
rooms, and event fan-out. Rooms in use:

- `dispatch` — all dispatchers + admins.
- `driver:<id>` — per-driver private room (used for walkie).
- `ride:<id>` — scoped to a specific ride (rider + driver + dispatch).

Key events are documented in the top-level README.

---

## Background services

- **`AutoCancelService`** (`services/AutoCancelService.js`) — runs on a
  timer after `SocketService.init` and automatically:
  - Cancels **pending** rides whose scheduled pickup window expired.
  - Flags **no-show** rides when the driver arrives but the rider never
    boards within the grace window.
  - Emits `ride:updated` so every connected client reconciles instantly.
- **`SchedulingService`** — helper utilities for scheduled / future
  bookings (capacity checks, time-slot rounding).

---

## Fare calculator (`utils/fareCalculator.js`)

A single, pure module that the estimate endpoint, the booking endpoint,
and the public `/api/rides/fare-info` route all call. It encapsulates:

- Base fare per rider type (General, Elderly/Disabled, Child, Companion).
- Scheduled vs same-day multiplier.
- No-show fee.
- Service hours (Mon–Sat 06:00–21:00).

Rates must never be duplicated elsewhere in the codebase. The mobile
Fare Info screen and web Fares page render from the same data.

---

## Testing

A minimal fare harness lives at `utils/__fareTest.js` and can be run
directly with Node once dependencies are installed:

```bash
node utils/__fareTest.js
```

The repo does not currently ship Jest/supertest integration tests —
adding them is on the roadmap.

---

## Deployment checklist

- [ ] Move secrets out of `.env` into the platform's secret store.
- [ ] Lock `cors()` to the actual production origins.
- [ ] Enable `express-mongo-sanitize()` and `xss-clean()` in `index.js`.
- [ ] Set `NODE_ENV=production` so the rate limiter tightens automatically.
- [ ] Swap the dev JWT secret for a long random string.
- [ ] Put the API behind HTTPS (required for browser geolocation in the
      driver web portal).
- [ ] Configure a managed MongoDB (Atlas) with backups.
- [ ] If enabling Stripe, register the webhook endpoint and rotate
      `STRIPE_WEBHOOK_SECRET`.
