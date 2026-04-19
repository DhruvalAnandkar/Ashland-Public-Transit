# Ashland Public Transit — Rider Mobile App

Expo (React Native) application for Ashland Public Transit riders.
Book rides, watch your bus approach on a live map, carry a QR boarding
pass, and manage your profile — all with a fluid, animated UI.

Part of the [`Ashland-Public-Transit`](../README.md) monorepo.

---

## Highlights

- **Expo Router 6** file-based navigation (`app/`).
- **Live hero canvas** (`components/HeroCanvas.js`) — reanimated floating
  orbs, pulse rings, and a traveling-vehicle dot layered over a
  4-stop gradient. No WebGL required, so it runs smoothly on every
  Expo Go device.
- **Google Places autocomplete** for pickup / drop-off, with saved-place
  quick-pick chips.
- **Fare estimation** powered by the same shared calculator that the
  web site uses — rider type, scheduled vs same-day, no-show fee, and
  service-hour checks all match the server.
- **Live tracking** via `react-native-maps` + Socket.IO, with a fallback
  to REST polling if the socket drops.
- **QR-code boarding pass** (`react-native-qrcode-svg`).
- **Complete profile surface** — edit info, change password, saved
  places, payment methods (scaffold), notifications, accessibility.
- **Haptics** throughout (`expo-haptics`) for confirm / select / error
  cues that feel native.
- **Light / Dark / System** theme with secure-store persistence and
  live OS-change listeners.
- **APT Assist** — in-app rule-based chatbot (floating bubble + full
  chat view) that can deep-link into Book / Track / Rides / Fares.

---

## Screen map

```
app/
├─ _layout.tsx         Expo Router root
└─ index.tsx           Splash / auth gate
screens/
├─ AuthScreen.js               Login & sign-up (with hero canvas + BrandLogo)
├─ ForgotPasswordScreen.js     Password reset flow
├─ ChangePasswordScreen.js     In-app password change
├─ RiderHomeScreen.js          Home: live hero, quick actions, upcoming
├─ RiderBookingScreen.js       Multi-step booking w/ Places + fare est.
├─ RiderTrackingScreen.js      Live map, driver GPS, ETA, status
├─ RiderRidesScreen.js         Ride history
├─ TicketScreen.js             QR boarding pass
├─ ProfileScreen.js            Profile + stats (APT Assist entry point)
├─ EditProfileScreen.js
├─ SavedPlacesScreen.js
├─ PaymentMethodsScreen.js     (Stripe scaffolded)
├─ NotificationsScreen.js
├─ SettingsScreen.js           Appearance picker (Light / Dark / System)
├─ FareInfoScreen.js           Reads fare policy from /api/rides/fare-info
├─ ChatbotScreen.js            APT Assist chat UI
├─ AboutScreen.js
└─ HelpScreen.js

components/
├─ BrandLogo.js                Square mark + optional wordmark
├─ ChatbotBubble.js            Floating FAB with pulsing glow
├─ HeroCanvas.js               Login / home hero background
├─ PlacesInput.js              Google Places autocomplete
└─ ScreenHeader.js             Shared header with back/action slot

constants/
├─ theme.js                    Light & dark palettes + semantic tokens
└─ chatbotKnowledge.js         FAQ intents, keywords, actions

context/
└─ ThemeContext.js             Provider + useAppTheme hook

utils/
└─ chatbotEngine.js            Rule-based intent classifier
```

---

## Getting started

```bash
npm install
npm start                 # open Expo Dev Tools
npm run android           # launch Android emulator/device
npm run ios               # launch iOS simulator
```

### Environment

Create `mobile/.env`:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5000/api
EXPO_PUBLIC_SOCKET_URL=http://<your-lan-ip>:5000
```

> On a physical device or emulator, `localhost` points at the device —
> use your dev machine's **LAN IP** instead.

Alternatively, declare the same keys under `expo.extra` in `app.json`.

### Google API requirements

- **Places API (New)** — required for autocomplete.
- **Maps SDK for Android** — required for Android map rendering.
- **Maps SDK for iOS** — required for iOS map rendering.

For development you can leave the key unrestricted. For production,
lock it per-app (SHA-1 / bundle id) and proxy any web-service calls
through the backend.

---

## Scripts

| Command              | What it does                                |
| -------------------- | ------------------------------------------- |
| `npm start`          | Expo dev server (Metro + tunnel/LAN).       |
| `npm run android`    | `expo start --android`.                     |
| `npm run ios`        | `expo start --ios`.                         |
| `npm run web`        | `expo start --web` (limited support).       |
| `npm run lint`       | `expo lint`.                                |
| `npm run reset-project` | Moves starter files to `app-example/` and scaffolds a blank `app/`. |

---

## Real-time behavior

The rider app subscribes to the same Socket.IO events the dispatch
console uses:

- `ride:updated` — status changes (pending → assigned → en-route → …).
- `driver:location` — live GPS packets for the assigned driver, used to
  smooth-interpolate the marker on the tracking screen.
- `dispatch:broadcast` — in-app notification banner.

If the socket disconnects (mobile flaky network), the tracking screen
transparently falls back to `GET /rides/:id` every 10s.

---

## Theming (light / dark / system)

Every core screen adapts to the active theme through a centralized
token system.

| Piece                 | Location                                                    |
| --------------------- | ----------------------------------------------------------- |
| Palettes + tokens     | `constants/theme.js` (`light` and `dark`)                   |
| Provider / hook       | `context/ThemeContext.js` → `useAppTheme()`                 |
| Persistence           | `expo-secure-store` (preference survives reinstalls)        |
| OS change listener    | `Appearance.addChangeListener` (live-updates "system" mode) |
| Root background       | `expo-system-ui` so the native backdrop matches             |
| Status bar            | `expo-status-bar` style tracks the resolved theme           |
| Appearance picker     | `screens/SettingsScreen.js` → Light / Dark / System buttons |

Screens consume colors via a `makeStyles(colors)` factory:

```js
import { useAppTheme } from "../context/ThemeContext";

export default function MyScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // …
}
```

---

## APT Assist (in-app chatbot)

A lightweight assistant for FAQs, fare lookups, and quick navigation.

- **Surface** — `ChatbotBubble` (floating FAB) is rendered over core
  rider screens; tapping opens `ChatbotScreen` (full-screen chat UI
  with bubbles, typing indicator, starter prompts, and quick replies).
- **Engine** — `utils/chatbotEngine.js` runs a rule-based classifier
  against `constants/chatbotKnowledge.js`. Each intent declares
  keywords, regex patterns, one or more canned answers, and optional
  `actions` such as `{ type: "navigate", screen: "BOOK" }` or
  `{ type: "call", phone: DISPATCH_PHONE }`.
- **Deep-linking** — actions bubble back to `app/index.tsx` via
  `handleChatbotNavigate`, which uses the existing screen stack (`push`,
  `pop`, `resetTo`) so no new navigation library is needed.
- **LLM swap-in** — `getReply()` is async and awaits a small typing
  delay, so replacing the engine with a server-side LLM endpoint later
  is a one-function change.

---

## Brand logo

`components/BrandLogo.js` renders the Ashland Public Transit mark
(blue→indigo gradient tile with a white `Ionicons` bus glyph) and an
optional wordmark. It mirrors the web `BrandLogo` component so the
brand reads consistently across platforms. Used on the auth screen and
available for any splash or marketing surface.

---

## Accessibility

- Type scale targets iOS & Android system accessibility settings.
- All interactive elements have `accessibilityLabel` + `accessibilityRole`.
- Haptic feedback is paired with a visible state change — never used
  as the only affordance.
- Color contrast meets WCAG AA across both light surfaces and the dark
  hero gradients.

---

## Troubleshooting

- **"Unable to reach server"** — double-check `EXPO_PUBLIC_API_URL` is
  your dev machine's LAN IP and that the device and laptop are on the
  same network.
- **Map shows gray tiles** — verify the Google Maps SDK is enabled and
  the API key is present (check Expo Dev Tools → logs).
- **Autocomplete returns nothing** — Places API is either disabled or
  key-restricted. Try an unrestricted key while debugging.
- **Reanimated worklet errors** — clear Metro cache:
  `npx expo start -c`.
