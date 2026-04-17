import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF } from "@react-google-maps/api";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin, Phone, Clock, Users, Truck, Navigation,
  X, Radio, Coffee, Power, AlertTriangle, User
} from "lucide-react";
import { io } from "socket.io-client";
import config from "../config";

const GMAPS_LIBS = ["geometry"];

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d4a574" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1e3a2f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a4a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a5a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#0e1a2b" }] },
];

const STATUS_COLORS = {
  Active: "#22c55e",
  "En-Route": "#3b82f6",
  "On Break": "#f59e0b",
  Idle: "#94a3b8",
  "Off Duty": "#6b7280",
  Suspended: "#ef4444",
};

const STATUS_ICONS = {
  Active: Radio,
  "En-Route": Navigation,
  "On Break": Coffee,
  Idle: User,
  "Off Duty": Power,
  Suspended: AlertTriangle,
};

const ASHLAND_CENTER = { lat: 40.8688, lng: -82.3179 };

const LiveFleetMap = () => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: GMAPS_LIBS,
  });

  const [driverLocations, setDriverLocations] = useState({});
  const [fleetDrivers, setFleetDrivers] = useState([]);
  const [activeRides, setActiveRides] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mapCenter] = useState(ASHLAND_CENTER);
  const [rideCoords, setRideCoords] = useState({});
  const geocodeCache = useRef({});
  const socketRef = useRef(null);

  // Fetch fleet drivers from REST API on mount
  const fetchFleetData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [driversRes, ridesRes] = await Promise.all([
        fetch(`${config.API_URL}/api/rides/fleet/drivers`, { headers }),
        fetch(`${config.API_URL}/api/rides/fleet/active-rides`, { headers }),
      ]);
      if (driversRes.ok) {
        const drivers = await driversRes.json();
        setFleetDrivers(drivers);
        const locs = {};
        drivers.forEach((d) => {
          if (d.currentLocation && d.currentLocation.coordinates[0] !== 0) {
            locs[d.username] = {
              coordinates: d.currentLocation.coordinates,
              status: d.status || "Idle",
              vehicleName: d.assignedVehicle ? d.assignedVehicle.name : "",
              currentRideId: d.activeRide ? d.activeRide._id : null,
              driverId: d._id,
              fullName: d.fullName || d.username,
              phoneNumber: d.phoneNumber || "",
            };
          }
        });
        setDriverLocations((prev) => ({ ...prev, ...locs }));
      }
      if (ridesRes.ok) {
        const rides = await ridesRes.json();
        setActiveRides(rides);
      }
    } catch (err) {
      console.error("Fleet data fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(fetchFleetData, 30000);
    return () => clearInterval(interval);
  }, [fetchFleetData]);

  // Socket.io: listen for live GPS pings
  useEffect(() => {
    const socket = io(config.SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_dispatcher_room");
    });

    socket.on("live_driver_location", (data) => {
      if (!data.driverUsername) return;
      setDriverLocations((prev) => ({
        ...prev,
        [data.driverUsername]: {
          coordinates: data.coordinates || [0, 0],
          status: data.status || "Active",
          vehicleName: data.vehicleName || prev[data.driverUsername]?.vehicleName || "",
          currentRideId: data.currentRideId || prev[data.driverUsername]?.currentRideId || null,
          driverId: data.driverId || prev[data.driverUsername]?.driverId || null,
          fullName: prev[data.driverUsername]?.fullName || data.driverUsername,
          phoneNumber: prev[data.driverUsername]?.phoneNumber || "",
          timestamp: data.timestamp,
        },
      }));
    });

    socket.on("driver_status_updated", (data) => {
      if (!data.driverUsername) return;
      setDriverLocations((prev) => ({
        ...prev,
        [data.driverUsername]: {
          ...prev[data.driverUsername],
          status: data.status,
        },
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Geocode ride pickup addresses for map pins
  const geocodeAddress = useCallback(
    (address) => {
      if (!isLoaded || !address) return;
      if (geocodeCache.current[address]) {
        setRideCoords((prev) => ({ ...prev, [address]: geocodeCache.current[address] }));
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: address + ", Ashland, OH" }, (results, status) => {
        if (status === "OK" && results[0]) {
          const loc = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          };
          geocodeCache.current[address] = loc;
          setRideCoords((prev) => ({ ...prev, [address]: loc }));
        }
      });
    },
    [isLoaded],
  );

  useEffect(() => {
    if (!isLoaded) return;
    const uniqueAddresses = [...new Set(activeRides.map((r) => r.pickup))];
    uniqueAddresses.forEach((addr) => {
      if (!geocodeCache.current[addr]) {
        geocodeAddress(addr);
      } else {
        setRideCoords((prev) => ({ ...prev, [addr]: geocodeCache.current[addr] }));
      }
    });
  }, [activeRides, isLoaded, geocodeAddress]);

  // Build driver-to-ride connections for polylines
  const connections = useMemo(() => {
    const lines = [];
    Object.entries(driverLocations).forEach(([username, driverData]) => {
      if (!driverData.coordinates || driverData.coordinates[0] === 0) return;
      const driverRide = activeRides.find((r) => {
        const driverInfo = fleetDrivers.find((d) => d.username === username);
        return (
          driverInfo &&
          driverInfo.assignedVehicle &&
          r.assignedVehicle === driverInfo.assignedVehicle.name &&
          ["Confirmed", "En-Route"].includes(r.status)
        );
      });
      if (driverRide && rideCoords[driverRide.pickup]) {
        lines.push({
          key: `${username}-${driverRide._id}`,
          path: [
            { lat: driverData.coordinates[1], lng: driverData.coordinates[0] },
            rideCoords[driverRide.pickup],
          ],
        });
      }
    });
    return lines;
  }, [driverLocations, activeRides, fleetDrivers, rideCoords]);

  const onlineCount = Object.values(driverLocations).filter(
    (d) => d.status === "Active" || d.status === "En-Route",
  ).length;

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading Fleet Map</p>
        </div>
      </div>
    );
  }

  const getDriverMarker = (status, initial) => {
    const color = STATUS_COLORS[status] || "#94a3b8";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 0C9 0 0 9 0 20c0 15 20 28 20 28s20-13 20-28C40 9 31 0 20 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="20" cy="18" r="10" fill="white" opacity="0.95"/><text x="20" y="22" text-anchor="middle" fill="${color}" font-size="13" font-weight="bold" font-family="Arial,sans-serif">${initial}</text></svg>`;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(40, 48),
      anchor: new window.google.maps.Point(20, 48),
    };
  };

  const riderMarker = (() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 23 15 23s15-11.8 15-23C30 6.7 23.3 0 15 0z" fill="#ef4444" stroke="white" stroke-width="2"/><circle cx="15" cy="14" r="6" fill="white" opacity="0.95"/><circle cx="15" cy="14" r="3" fill="#ef4444"/></svg>`;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(30, 38),
      anchor: new window.google.maps.Point(15, 38),
    };
  })();

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 220px)" }}>
      {/* STATS OVERLAY */}
      <div className="absolute top-4 left-4 z-10 flex gap-3">
        <div className="bg-slate-900/80 backdrop-blur-xl text-white px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl">
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider">{onlineCount} Online</span>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-xl text-white px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl">
          <MapPin size={14} className="text-red-400" />
          <span className="text-xs font-black uppercase tracking-wider">{activeRides.length} Active Rides</span>
        </div>
      </div>

      {/* DRIVER LEGEND */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-xl text-white p-3 rounded-xl border border-white/10 shadow-2xl">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Driver Status</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] font-bold text-slate-300">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GOOGLE MAP */}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "16px" }}
        center={mapCenter}
        zoom={13}
        options={{
          styles: DARK_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {/* DRIVER MARKERS */}
        {Object.entries(driverLocations).map(([username, data]) => {
          if (!data.coordinates || data.coordinates[0] === 0) return null;
          return (
            <MarkerF
              key={`driver-${username}`}
              position={{ lat: data.coordinates[1], lng: data.coordinates[0] }}
              icon={getDriverMarker(data.status, username.charAt(0).toUpperCase())}
              title={`${username} — ${data.status}`}
              onClick={() => setSelectedItem({ type: "driver", username, ...data })}
              zIndex={10}
            />
          );
        })}

        {/* RIDER PICKUP MARKERS */}
        {activeRides.map((ride) => {
          const coords = rideCoords[ride.pickup];
          if (!coords) return null;
          return (
            <MarkerF
              key={`ride-${ride._id}`}
              position={coords}
              icon={riderMarker}
              title={`${ride.passengerName} — ${ride.pickup}`}
              onClick={() => setSelectedItem({ type: "ride", ...ride, pickupLatLng: coords })}
              zIndex={5}
            />
          );
        })}

        {/* DRIVER → RIDER CONNECTING LINES */}
        {connections.map((conn) => (
          <PolylineF
            key={conn.key}
            path={conn.path}
            options={{
              strokeColor: "#3b82f6",
              strokeOpacity: 0.7,
              strokeWeight: 3,
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                  offset: "0",
                  repeat: "15px",
                },
              ],
            }}
          />
        ))}
      </GoogleMap>

      {/* SIDE PANEL */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute right-4 top-4 bottom-4 w-[340px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-2xl z-20 overflow-hidden flex flex-col"
          >
            {/* PANEL HEADER */}
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                {selectedItem.type === "driver" ? (
                  <><Truck size={16} className="text-blue-400" /> Driver Details</>
                ) : (
                  <><MapPin size={16} className="text-red-400" /> Ride Details</>
                )}
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* PANEL BODY */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedItem.type === "driver" ? (
                <>
                  {/* DRIVER INFO */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg"
                      style={{ backgroundColor: STATUS_COLORS[selectedItem.status] || "#94a3b8" }}
                    >
                      {selectedItem.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-black text-lg">{selectedItem.fullName || selectedItem.username}</p>
                      <p className="text-slate-400 text-xs font-bold">@{selectedItem.username}</p>
                    </div>
                  </div>

                  {/* STATUS BADGE */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = STATUS_ICONS[selectedItem.status] || User;
                      return <Icon size={14} style={{ color: STATUS_COLORS[selectedItem.status] }} />;
                    })()}
                    <span
                      className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: (STATUS_COLORS[selectedItem.status] || "#94a3b8") + "22",
                        color: STATUS_COLORS[selectedItem.status] || "#94a3b8",
                      }}
                    >
                      {selectedItem.status}
                    </span>
                  </div>

                  {/* DETAILS GRID */}
                  <div className="space-y-3">
                    {selectedItem.phoneNumber && (
                      <div className="flex items-center gap-3 text-slate-300">
                        <Phone size={14} className="text-slate-500" />
                        <span className="text-sm font-bold">{selectedItem.phoneNumber}</span>
                      </div>
                    )}
                    {selectedItem.vehicleName && (
                      <div className="flex items-center gap-3 text-slate-300">
                        <Truck size={14} className="text-slate-500" />
                        <span className="text-sm font-bold">{selectedItem.vehicleName}</span>
                      </div>
                    )}
                    {selectedItem.coordinates && (
                      <div className="flex items-center gap-3 text-slate-300">
                        <Navigation size={14} className="text-slate-500" />
                        <span className="text-xs font-mono">
                          {selectedItem.coordinates[1]?.toFixed(5)}, {selectedItem.coordinates[0]?.toFixed(5)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ACTIVE RIDE CARD */}
                  {(() => {
                    const driverInfo = fleetDrivers.find((d) => d.username === selectedItem.username);
                    if (driverInfo && driverInfo.activeRide) {
                      const ride = driverInfo.activeRide;
                      return (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Current Assignment</p>
                          <p className="text-white font-bold">{ride.passengerName}</p>
                          <div className="text-xs text-slate-400 space-y-1">
                            <p className="flex items-center gap-2"><MapPin size={12} className="text-emerald-400" /> {ride.pickup}</p>
                            <p className="flex items-center gap-2"><MapPin size={12} className="text-red-400" /> {ride.dropoff}</p>
                            <p className="flex items-center gap-2"><Clock size={12} /> {new Date(ride.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            <p className="flex items-center gap-2"><Users size={12} /> {ride.passengers} passengers — ${ride.fare?.toFixed(2)}</p>
                          </div>
                          <span className={`inline-block text-[9px] font-black px-2 py-1 rounded-full uppercase ${ride.status === "En-Route" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                            {ride.status}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <p className="text-slate-500 text-xs font-bold uppercase">No Active Assignment</p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  {/* RIDE INFO */}
                  <div>
                    <p className="text-white font-black text-lg">{selectedItem.passengerName}</p>
                    <span className={`inline-block text-[9px] font-black px-3 py-1 rounded-full uppercase mt-1 ${
                      selectedItem.status === "Confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                      selectedItem.status === "En-Route" ? "bg-blue-500/20 text-blue-400 animate-pulse" :
                      selectedItem.status === "Pending" ? "bg-amber-500/20 text-amber-400 animate-pulse" :
                      "bg-slate-500/20 text-slate-400"
                    }`}>
                      {selectedItem.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-slate-300">
                      <MapPin size={14} className="text-emerald-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Pickup</p>
                        <p className="text-sm font-bold">{selectedItem.pickup}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-slate-300">
                      <MapPin size={14} className="text-red-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Dropoff</p>
                        <p className="text-sm font-bold">{selectedItem.dropoff}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <Clock size={14} className="text-slate-500" />
                      <span className="text-sm font-bold">
                        {new Date(selectedItem.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {selectedItem.phoneNumber && (
                      <div className="flex items-center gap-3 text-slate-300">
                        <Phone size={14} className="text-slate-500" />
                        <span className="text-sm font-bold">{selectedItem.phoneNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-slate-300">
                      <Users size={14} className="text-slate-500" />
                      <span className="text-sm font-bold">{selectedItem.passengers} passengers</span>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Fare</p>
                      <p className="text-white font-black text-xl">${selectedItem.fare?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Vehicle</p>
                      <p className="text-slate-300 font-bold text-sm">{selectedItem.assignedVehicle || "Unassigned"}</p>
                    </div>
                  </div>

                  {selectedItem.ticketId && (
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Ticket</p>
                      <p className="text-white font-black text-lg tracking-widest">{selectedItem.ticketId}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveFleetMap;
