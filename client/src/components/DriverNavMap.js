import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    GoogleMap,
    useJsApiLoader,
    MarkerF,
    DirectionsRenderer,
} from "@react-google-maps/api";
import { Navigation, Clock, MapPin } from "lucide-react";

const GMAPS_LIBS = ["geometry", "places"];
const DEFAULT_CENTER = { lat: 38.4783, lng: -82.6380 }; // Ashland, KY

/**
 * Driver-facing nav map.
 * - Shows driver marker (self), pickup, dropoff.
 * - Draws a route either to the pickup (Confirmed) or to the dropoff (En-Route).
 * - Returns live ETA/distance via onEta callback when Directions resolves.
 */
const DriverNavMap = ({
    driverPos,
    pickupLatLng,
    dropoffLatLng,
    pickupLabel = "Pickup",
    dropoffLabel = "Dropoff",
    phase = "to_pickup", // "to_pickup" | "to_dropoff" | "idle"
    onEta,
    height = 320,
}) => {
    const { isLoaded } = useJsApiLoader({
        id: "google-map-script-driver",
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        libraries: GMAPS_LIBS,
    });

    const [directions, setDirections] = useState(null);
    const etaSentRef = useRef(0);

    const origin = phase === "to_dropoff" ? pickupLatLng : driverPos;
    const destination = phase === "to_dropoff" ? dropoffLatLng : pickupLatLng;

    // Request directions when inputs meaningfully change.
    useEffect(() => {
        if (!isLoaded || !window.google?.maps || !origin || !destination) {
            setDirections(null);
            return;
        }
        const svc = new window.google.maps.DirectionsService();
        svc.route(
            {
                origin,
                destination,
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === "OK" && result) {
                    setDirections(result);
                    const leg = result.routes?.[0]?.legs?.[0];
                    if (leg && onEta) {
                        const now = Date.now();
                        if (now - etaSentRef.current > 5000) {
                            etaSentRef.current = now;
                            onEta({
                                distanceText: leg.distance?.text,
                                distanceMeters: leg.distance?.value,
                                durationText: leg.duration?.text,
                                durationSeconds: leg.duration?.value,
                            });
                        }
                    }
                } else {
                    setDirections(null);
                }
            },
        );
        // Re-run when the coarse location changes (every ~30m).
    }, [
        isLoaded,
        origin?.lat,
        origin?.lng,
        destination?.lat,
        destination?.lng,
        phase,
        onEta,
    ]);

    const center = useMemo(
        () => driverPos || pickupLatLng || dropoffLatLng || DEFAULT_CENTER,
        [driverPos, pickupLatLng, dropoffLatLng],
    );

    if (!isLoaded) {
        return (
            <div
                className="rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center"
                style={{ height }}
            >
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Loading map…
                </span>
            </div>
        );
    }

    return (
        <div className="rounded-2xl overflow-hidden border border-slate-200 relative">
            <GoogleMap
                mapContainerStyle={{ width: "100%", height }}
                center={center}
                zoom={14}
                options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    gestureHandling: "greedy",
                }}
            >
                {driverPos && (
                    <MarkerF
                        position={driverPos}
                        icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: "#2563eb",
                            fillOpacity: 1,
                            strokeColor: "#fff",
                            strokeWeight: 3,
                        }}
                        label={{
                            text: "YOU",
                            color: "#2563eb",
                            fontSize: "10px",
                            fontWeight: "900",
                        }}
                    />
                )}
                {pickupLatLng && (
                    <MarkerF
                        position={pickupLatLng}
                        label={{
                            text: "P",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: "900",
                        }}
                        icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 11,
                            fillColor: "#10b981",
                            fillOpacity: 1,
                            strokeColor: "#fff",
                            strokeWeight: 2,
                        }}
                        title={pickupLabel}
                    />
                )}
                {dropoffLatLng && (
                    <MarkerF
                        position={dropoffLatLng}
                        label={{
                            text: "D",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: "900",
                        }}
                        icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 11,
                            fillColor: "#ef4444",
                            fillOpacity: 1,
                            strokeColor: "#fff",
                            strokeWeight: 2,
                        }}
                        title={dropoffLabel}
                    />
                )}
                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: phase === "to_dropoff" ? "#ef4444" : "#2563eb",
                                strokeWeight: 5,
                                strokeOpacity: 0.85,
                            },
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );
};

export default DriverNavMap;
