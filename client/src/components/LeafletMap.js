import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// FIX: Default Leaflet marker icons are broken in webpack/react builds
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// NEW: Use a different icon/color for vehicles (CSS filter trick or separate image)
const vehicleIcon = L.divIcon({
    className: 'custom-icon',
    html: '<div style="background-color: #3b82f6; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

const LeafletMap = ({ className, vehicles = [] }) => {
    const ashlandCoords = [40.8688, -82.3179];

    return (
        <div className={`rounded-2xl overflow-hidden shadow-inner border border-slate-200 ${className}`}>
            <MapContainer
                center={ashlandCoords}
                zoom={13}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* STATION MARKER */}
                <Marker position={ashlandCoords}>
                    <Popup>
                        <strong>Ashland Transit Hub</strong> <br /> Central Station
                    </Popup>
                </Marker>

                {/* DYNAMIC VEHICLES */}
                {vehicles.map(v => (
                    <Marker
                        key={v.id}
                        position={[v.lat, v.lng]}
                        icon={vehicleIcon}
                    >
                        <Popup>
                            <strong>{v.name}</strong> <br /> {v.type} <br /> Speed: ~30mph
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default LeafletMap;
