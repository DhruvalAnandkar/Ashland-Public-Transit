# Ashland Public Transit - Distributed Fleet Management System

URCA Senior Thesis project focused on rural transit reliability, live dispatch visibility, and accessible rider booking across web and mobile.

## Overview

This monorepo contains three coordinated apps:

- `server`: Express + MongoDB API and Socket.IO real-time layer.
- `client`: Web app for dispatcher, fleet manager, and driver operations.
- `mobile`: Expo React Native rider app for booking, tracking, QR boarding pass, and ride history.

The platform supports:

- Google Places-powered pickup and drop-off suggestions in mobile booking.
- Dynamic fare estimation and same-day surcharge logic.
- Live driver location broadcasts to dispatch and rider tracking screens.
- Ticket-based ride tracking and QR code boarding flow.

## Tech Stack

- Node.js, Express, MongoDB (Mongoose)
- React (web), Expo React Native (mobile)
- Socket.IO (bi-directional live updates)
- Google Maps + Places APIs
- Framer Motion, Recharts, Leaflet/Google Maps integrations

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)
- Google Maps API key with required APIs enabled

### Install

```bash
# server
cd server
npm install

# web client
cd ../client
npm install

# mobile app
cd ../mobile
npm install
```

### Server Environment

Create `server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

### Mobile Environment

Set key in `mobile/.env` (or use `mobile/app.json` platform map key fields):

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### Run

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm start

# terminal 3
cd mobile
npm start
```

Default URLs:

- Web client: `http://localhost:3000`
- API + Socket server: `http://localhost:5000`
- Expo Metro: shown by Expo CLI

## Google API Requirements

For mobile place search + map rendering, enable these APIs in Google Cloud:

- Places API (New) - required
- Maps SDK for Android - required for Android map rendering
- Maps SDK for iOS - required for iOS map rendering

Recommended:

- Keep key restrictions minimal while debugging.
- For production, move Places web-service calls to backend proxy and lock keys per app/service.

## Live Driver Location Notes

- Driver web view uses browser geolocation to publish live GPS.
- Rider mobile tracking subscribes to socket updates and falls back to periodic API polling.
- If driver page shows `Driver GPS Waiting`, verify:
  - Browser location permission is allowed
  - Windows/macOS location services are enabled
  - Driver app runs on `localhost` or HTTPS origin

## Key API Endpoints

Base: `http://localhost:5000/api`

- `POST /rides` - create rider booking
- `GET /rides/:id` - fetch ride by id
- `GET /rides/my-rides` - rider history (auth)
- `PATCH /rides/:id/status` - update ride status
- `PATCH /rides/:id/vehicle` - assign vehicle
- `POST /rides/fleet/driver-location` - driver GPS fallback update

## Repository Notes

- `client/requirements.txt` and `server/requirements.txt` are dependency snapshots for quick review.
- Source of truth for installable packages remains each app's `package.json`.
