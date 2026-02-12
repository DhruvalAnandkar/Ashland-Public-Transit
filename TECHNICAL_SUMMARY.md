# Ashland Public Transit - Technical System Summary (v1.0)
**Senior Computer Science Thesis | Spring 2026**

---

## 1. System Architecture
The Ashland Public Transit system is built on a **MERN Stack (MongoDB, Express, React, Node.js)**, designed to provide a seamless, real-time experience for Dispatchers, Drivers, and Riders without the overhead of WebSockets.

### Distributed State Synchronization
Instead of complex socket connections, the system utilizes a **"Single Source of Truth"** architecture where MongoDB holds the definitive state of the fleet.
*   **Dispatcher Dashboard**: Synchronizes with the server every **10 seconds** via an optimized polling mechanism (`setInterval`). This ensures the Dispatcher always sees the latest bookings from riders and status updates from drivers.
*   **Client (Rider)**: Performs on-demand capacity checks (`GET /api/rides/check-capacity`) before submission to ensure real-time availability.
*   **Driver View**: Fetches the live manifest from the same REST API, ensuring that when a Driver marks a ride as "Completed", the Dispatcher sees it in the next poll cycle.

---

## 2. Frontend Innovation (UI/UX)
The user interface moves beyond standard Bootstrap/Material templates, implementing a custom **Glassmorphism Design System** to create a modern, reliable aesthetic.

### Glassmorphism Design System
*   **Technology**: Built with **Tailwind CSS** and **Framer Motion**.
*   **Visual Language**: Heavy use of `backdrop-blur-xl`, `bg-white/90` transparency layers, and deep drop shadows (`shadow-2xl`) to create depth.
*   **Animations**: Custom entrance animations (`animate-in fade-in zoom-in`) and smooth layout transitions (`LayoutGroup` / `motion.div`) make the application feel responsive and "alive".

### "Last 100 Feet" Feature
To address the common logistical issue of finding passengers in complex locations (e.g., apartment complexes, medical centers), the booking form includes a **"Pickup Details"** logic layer.
*   **Implementation**: A dedicated `pickupDetails` field allows users to specify visual cues (e.g., "Wearing a red hat", "Waiting by the north entrance").
*   **Dispatcher/Driver Visibility**: This data is passed through the API and rendered prominently on the Driver's manifest, reducing pickup friction.

### Interactive Mapping
*   **Zero-Cost Visualization**: Utilizes **Leaflet.js** and **OpenStreetMap (OSM)** tiles functionality entirely free of charge, avoiding Google Maps API costs.
*   **Integration**: The `LeafletMap.js` component renders the centralized Ashland Transit Hub and provides context for the service area.

---

## 3. Backend & Logic Guardrails
The backend is designed not just to store data, but to actively enforce business logic and safety constraints.

### Thread-Safe Capacity Logic (Race Condition Prevention)
To enforce the STRICT **7-van limit**, the backend implements a "Double-Check" locking mechanism in the `POST /api/rides` endpoint:
1.  **Pre-Check**: The frontend checks availability before the user hits submit.
2.  **Server Authority**: When the request reaches the server, it **re-calculates** the active fleet vs. confirmed bookings for that specific hour *before* saving.
3.  **Conflict Handling**: If `Ride.countDocuments` meets or exceeds `Vehicle.countDocuments`, the server rejects the request with a `409 Conflict` and a specific "High Demand" message, effectively handling race conditions where two users book the last seat simultaneously.

### Session Persistence
*   **Mechanism**: The Dispatcher portal is protected via a lightweight authentication system using `localStorage`.
*   **Implementation**: On successful login (Password Check), the app sets `isDispatcher = "true"` in the browser's local storage. This persists the session across page refreshes (`F5`), ensuring the Dispatcher doesn't lose their workspace during operational hours.

### Optimized Polling & Debouncing
*   **Server Load Reduction**: The Dispatcher dashboard restricts polling to 10-second intervals to minimize database reads.
*   **Debounced Input**: On the Rider Booking Form, the capacity check (`verifyCapacity`) is **debounced by 500ms**. This prevents the client from spamming the API with a request for every single keystroke while the user types a date, significantly reducing server overhead.

---

## 4. Reliability & Error Handling
Reliability is key for a public transit system. The application moves away from intrusive browser defaults to a custom, non-blocking notification system.

### Custom Toast Notification System
*   **Replacement**: All `alert()` and `window.confirm()` calls have been replaced with a custom `Toast.js` component.
*   **Architecture**: Uses a centralized state array (`toasts`) to stack notifications (Success, Error, Info) in the top-right corner. These auto-dismiss after a few seconds, keeping the UI clean and professional.

### Data Validation Strategies
*   **Temporal Guardrails**: The API and Frontend share logic to strictly **prevent past-date bookings**.
    *   *Frontend*: `if (selectedDate < now)` immediately locks the "Submit" button.
    *   *Backend*: The API rejects any payload with a `scheduledTime` in the past with a `400 Bad Request`.
*   **Fleet Validations**: The system automatically accounts for vehicles marked as "In Shop" or "Inactive", ensuring riders can never book a broken-down van.

---

## 5. API Structure for Team Handoff
The system exposes a clean, RESTful API structure ready for the Driver App team to integrate with.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/rides` | Fetches the full ride manifest (sorted by time). |
| **POST** | `/api/rides` | Creates a new ride request (Public). Includes Capacity Check. |
| **GET** | `/api/rides/check-capacity`| **Dynamic Logic**: Returns `isFull`, `isBusy`, and fleet usage stats for a specific hour. |
| **PATCH** | `/api/rides/:id/status` | Updates ride status (`Confirmed`, `En-Route`, `Completed`, `Cancelled`). |
| **PATCH** | `/api/rides/:id/vehicle` | Assigns a specific asset (e.g., "Van 1") to a ride. |
| **GET** | `/api/vehicles` | Returns the status of the entire fleet (Active vs. In-Shop). |
| **GET** | `/api/rides/track/:ticketId`| **Public Safe**: Returns limited ride details for the passenger tracking page (Ticket ID lookup). |

---

## 6. Advanced Features (Phase 2 Expansion)
As of Feb 2026, the system includes advanced operational modules to support "Smart Dispatching":

### Dynamic Fare Engine
*   **Logic**: A sophisticated pricing algorithm (`fareCalculator.js`) now handles multiple passenger types (Standard, Senior, Student, Veteran) and applies conditional logic:
    *   **User-Type Discounts**: Veterans ride free; Seniors/Students receive subsidized rates.
    *   **Same-Day Surcharge**: Automatic $1.00 fee applied to "Standard" bookings made less than 24 hours in advance.
    *   **Group Rates**: "Plus One" passengers ride at 50% off the base fare (excluding free tiers).

### Digital Boarding Pass (Mobile Ticketing)
*   **Technology**: Uses `qrcode.react` to generate high-density QR codes for confirmed rides.
*   **Flow**:
    1.  Rider books a trip -> Status: "Pending".
    2.  Dispatcher Confirms -> Status: "Confirmed".
    3.  Rider checks "Track Your Ride" -> Digital Boarding Pass appears.
    4.  **Payload**: The QR Code embeds a JSON object with `{ ticketId, passengerName, status }` for future driver scanning integration.

### Executive Analytics Dashboard
*   **Visualization**: Integrated `recharts` to provide the Transit Director with actionable intelligence.
    *   **Peak Traffic Graph**: Bar chart visualization of hourly fleet usage to identify bottlenecks.
    *   **Revenue Tracker**: Real-time aggregation of potential and collected fares.
    *   **Fleet Health**: Instant summary of Active vs. In-Shop vehicles.
*   **Report Mode**: A dedicated "Reports" tab allows the Dispatcher to switch between operational (Manifest) and strategic (Analytics) views.

### System Configuration (Dispatcher Control)
*   **Auto-Accept Toggle**: A global setting stored in the database (`SystemSetting` model) allows the Dispatcher to toggle "Auto-Accept" mode.
    *   **Manual Mode (Default)**: Rides enter as "Pending Review" and require human approval.
    *   **Auto Mode**: Rides are instantly "Confirmed" if capacity checks pass, streamlining off-peak operations.
