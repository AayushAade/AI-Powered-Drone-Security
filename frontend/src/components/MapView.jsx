import { useEffect, useRef, useState } from 'react';
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
    width: 40px; height: 40px;
    background: rgba(0, 245, 255, 0.1);
    border: 2px solid var(--accent-cyan);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    box-shadow: 0 0 20px var(--accent-cyan-glow);
    position: relative;
  ">
    🚁
    <div style="position: absolute; width: 100%; height: 100%; border: 1px solid var(--accent-cyan); border-radius: 50%; animation: pulse 2s infinite;"></div>
  </div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

// Incident pin
const incidentIcon = L.divIcon({
    html: `<div style="
    width: 32px; height: 32px;
    background: rgba(255, 77, 77, 0.2);
    border: 2px solid var(--accent-red);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 0 20px var(--accent-red-glow);
  ">⚠️</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

// Base marker
const baseIcon = L.divIcon({
    html: `<div style="
    width: 24px; height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid white;
    border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px;
  ">💠</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const MAP_STYLES = {
    satellite: {
        name: 'TACTICAL (SATELLITE)',
        // Using high-res Google Hybrid satellite tiles which have better 3D depth and definition
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        attribution: 'Google Maps',
    },
    dark: {
        name: 'COMMAND (DARK)',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; CartoDB',
    },
    swiggy: {
        name: 'CLEAN (LIGHT)',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; CartoDB',
    },
};

const NO_FLY_ZONES = [
    { 
        name: 'Bharati Hospital', 
        coordinates: [
            [18.4590, 73.8568],
            [18.4601, 73.8568],
            [18.4601, 73.8580],
            [18.4590, 73.8580]
        ],
        center: [18.4595965, 73.8573443], // Exact coordinates provided
        type: 'Hospital' 
    },
    { 
        name: 'Katraj Zoo & Lake', 
        coordinates: [
            [18.4520, 73.8550],
            [18.4530, 73.8585],
            [18.4480, 73.8595],
            [18.4460, 73.8560]
        ],
        center: [18.4495, 73.8573],
        type: 'Restricted' 
    }
];

const BASE_POSITION = [18.4575, 73.8510];
const CITY_CENTER = [18.4575, 73.8510];

export default function MapView({ dronePos, incidentCoords, droneStatus }) {
    const [style, setStyle] = useState('satellite');
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const tileLayer = useRef(null);
    const droneMarker = useRef(null);
    const incidentMarker = useRef(null);
    const routeLine = useRef(null);
    const baseMarker = useRef(null);

    // Init map
    useEffect(() => {
        if (mapInstance.current) return;
        const map = L.map(mapRef.current, {
            center: CITY_CENTER,
            zoom: 16,
            maxZoom: 22,
            zoomControl: false,
            attributionControl: false,
        });

        tileLayer.current = L.tileLayer(MAP_STYLES.satellite.url, {
            maxZoom: 22,
            maxNativeZoom: 20
        }).addTo(map);

        // Render all No-Fly Zones
        NO_FLY_ZONES.forEach((zone) => {
            const polygon = L.polygon(zone.coordinates, {
                color: 'var(--accent-red)',
                fillColor: 'var(--accent-red)',
                fillOpacity: 0.1,
                weight: 1,
                dashArray: '4,6',
            }).addTo(map);
            
            // Add static label "NO FLY ZONE"
            L.marker(zone.center, {
                icon: L.divIcon({
                    html: `<div style="color: var(--accent-red); font-size: 8px; font-weight: 800; white-space: nowrap; opacity: 0.6;">NO FLY ZONE</div>`,
                    className: '',
                    iconSize: [60, 10],
                    iconAnchor: [30, 5]
                })
            }).addTo(map);
        });

        // Base marker
        baseMarker.current = L.marker(BASE_POSITION, { icon: baseIcon })
            .addTo(map);

        // Drone
        droneMarker.current = L.marker(BASE_POSITION, { icon: droneIcon })
            .addTo(map)
            .bindTooltip('DRONE ALPHA', { permanent: true, direction: 'right', className: 'drone-tooltip' });

        mapInstance.current = map;

        // Ensure map resizes correctly when toggled between PIP and Main View
        const resizeObserver = new ResizeObserver(() => {
            if (mapInstance.current) {
                mapInstance.current.invalidateSize();
            }
        });
        if (mapRef.current) {
            resizeObserver.observe(mapRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Handle Style Change
    useEffect(() => {
        if (tileLayer.current && mapInstance.current) {
            tileLayer.current.setUrl(MAP_STYLES[style].url);
        }
    }, [style]);

    // Update drone position
    useEffect(() => {
        if (!mapInstance.current || !dronePos) return;
        const pos = [dronePos.lat, dronePos.lng];
        droneMarker.current.setLatLng(pos);
    }, [dronePos]);

    // Place incident marker + route
    useEffect(() => {
        if (!mapInstance.current || !incidentCoords) return;
        const incPos = [incidentCoords.lat, incidentCoords.lng];

        if (incidentMarker.current) mapInstance.current.removeLayer(incidentMarker.current);
        if (routeLine.current) mapInstance.current.removeLayer(routeLine.current);

        incidentMarker.current = L.marker(incPos, { icon: incidentIcon })
            .addTo(mapInstance.current);

        // "Optimal Route" styling
        routeLine.current = L.polyline([BASE_POSITION, incPos], {
            color: 'var(--accent-cyan)',
            weight: 3,
            opacity: 0.8,
            lineJoin: 'round'
        }).addTo(mapInstance.current);
        
        // Add "OPTIMAL ROUTE" label overlay
        const midPoint = [(BASE_POSITION[0] + incPos[0]) / 2, (BASE_POSITION[1] + incPos[1]) / 2];
        L.marker(midPoint, {
            icon: L.divIcon({
                html: `<div style="background: var(--accent-cyan); color: #000; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 2px; transform: rotate(-20deg); white-space: nowrap;">OPTIMAL ROUTE</div>`,
                className: '',
                iconAnchor: [40, 5]
            })
        }).addTo(mapInstance.current);

        mapInstance.current.flyToBounds([BASE_POSITION, incPos], { padding: [100, 100], duration: 1.5 });
    }, [incidentCoords]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Map Styles Selector (Glassmorphic) */}
            <div style={{
                position: 'absolute', top: 20, right: 20, zIndex: 1000,
                display: 'flex', gap: '8px'
            }}>
                {Object.entries(MAP_STYLES).map(([key, value]) => (
                    <button
                        key={key}
                        onClick={() => setStyle(key)}
                        style={{
                            padding: '6px 12px',
                            background: style === key ? 'var(--accent-cyan)' : 'var(--bg-glass)',
                            color: style === key ? '#000' : 'white',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            backdropFilter: 'var(--glass-blur)'
                        }}
                    >
                        {value.name}
                    </button>
                ))}
            </div>

            <div 
                ref={mapRef} 
                className={style === 'satellite' ? 'tactical-map-filter' : ''}
                style={{ width: '100%', height: '100%', background: '#000' }} 
            />
        </div>
    );
}
