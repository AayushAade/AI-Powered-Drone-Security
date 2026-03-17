import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom drone marker
const droneIcon = L.divIcon({
    html: `<div style="
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #63b3ed, #4fd1c5);
    border-radius: 50%;
    border: 2px solid rgba(99,179,237,0.8);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 0 16px rgba(99,179,237,0.7), 0 0 32px rgba(99,179,237,0.3);
    animation: none;
  ">🚁</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

// Incident pin
const incidentIcon = L.divIcon({
    html: `<div style="
    width: 28px; height: 28px;
    background: rgba(252,129,129,0.2);
    border: 2px solid #fc8181;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    box-shadow: 0 0 12px rgba(252,129,129,0.6);
  ">⚠️</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
});

// Base marker
const baseIcon = L.divIcon({
    html: `<div style="
    width: 24px; height: 24px;
    background: rgba(159,122,234,0.2);
    border: 2px solid #9f7aea;
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px;
  ">🏠</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const BASE_POSITION = [19.0900, 72.8600];
const CITY_CENTER = [19.0760, 72.8777];

export default function MapView({ dronePos, incidentCoords, droneStatus }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const droneMarker = useRef(null);
    const incidentMarker = useRef(null);
    const routeLine = useRef(null);
    const baseMarker = useRef(null);

    // Init map
    useEffect(() => {
        if (mapInstance.current) return;
        const map = L.map(mapRef.current, {
            center: CITY_CENTER,
            zoom: 13,
            zoomControl: true,
            attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // No-fly zone polygon
        const noFlyZone = L.polygon([
            [19.0680, 72.8720],
            [19.0690, 72.8810],
            [19.0630, 72.8820],
            [19.0620, 72.8730],
        ], {
            color: '#fc8181',
            fillColor: '#fc8181',
            fillOpacity: 0.08,
            weight: 1,
            dashArray: '6,4',
        }).addTo(map);
        noFlyZone.bindTooltip('🚫 No-Fly Zone', { permanent: false, direction: 'center' });

        // Base marker
        baseMarker.current = L.marker(BASE_POSITION, { icon: baseIcon })
            .addTo(map)
            .bindTooltip('🏠 Drone Base', { permanent: true, direction: 'right', className: 'map-tooltip' });

        // Drone starts at base
        droneMarker.current = L.marker(BASE_POSITION, { icon: droneIcon })
            .addTo(map)
            .bindTooltip('🚁 DRONE-1 — Idle', { permanent: false, direction: 'top' });

        mapInstance.current = map;
    }, []);

    // Update drone position
    useEffect(() => {
        if (!mapInstance.current || !dronePos) return;
        const pos = [dronePos.lat, dronePos.lng];
        droneMarker.current.setLatLng(pos);
        droneMarker.current.setTooltipContent(
            `🚁 DRONE-1 — ${droneStatus?.toUpperCase() || 'IDLE'} | Alt: ${Math.round(dronePos.altitude || 0)}m`
        );
    }, [dronePos, droneStatus]);

    // Place incident marker + route
    useEffect(() => {
        if (!mapInstance.current || !incidentCoords) return;
        const incPos = [incidentCoords.lat, incidentCoords.lng];

        // Remove old incident marker and route
        if (incidentMarker.current) mapInstance.current.removeLayer(incidentMarker.current);
        if (routeLine.current) mapInstance.current.removeLayer(routeLine.current);

        incidentMarker.current = L.marker(incPos, { icon: incidentIcon })
            .addTo(mapInstance.current)
            .bindTooltip('⚠️ Incident Site', { permanent: true, direction: 'top', className: 'map-tooltip' });

        routeLine.current = L.polyline([BASE_POSITION, incPos], {
            color: '#63b3ed',
            weight: 2,
            dashArray: '8,6',
            opacity: 0.7,
        }).addTo(mapInstance.current);

        // Fly to show both points
        mapInstance.current.flyToBounds([BASE_POSITION, incPos], { padding: [60, 60], duration: 1.5 });
    }, [incidentCoords]);

    return (
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    );
}
