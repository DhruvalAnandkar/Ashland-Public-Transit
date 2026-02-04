import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// FIX: Default Leaflet marker icons are broken in webpack/react builds
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

const LeafletMap = ({ className }) => {
    const ashlandCoords = [40.8688, -82.3179];

    return (
        <div className={`rounded-2xl overflow-hidden shadow-inner border border-slate-200 ${className}`}>
            <MapContainer
                center={ashlandCoords}
                zoom={14}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={ashlandCoords}>
                    <Popup>
                        Ashland Transit Hub <br /> Central Station
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
};

export default LeafletMap;
