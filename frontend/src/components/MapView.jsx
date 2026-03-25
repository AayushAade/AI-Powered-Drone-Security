import { useEffect, useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { Plane, AlertTriangle, Crosshair } from 'lucide-react';
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
    background: rgba(0, 245, 255, 0.08);
    border: 2px solid #00F5FF;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #00F5FF;
    box-shadow: 0 0 24px rgba(0, 245, 255, 0.3), inset 0 0 8px rgba(0, 245, 255, 0.1);
    position: relative;
  ">
    ${renderToString(<Plane size={24} fill="#00F5FF" />)}
    <div style="position: absolute; width: 100%; height: 100%; border: 1px solid #00F5FF; border-radius: 50%; animation: pulse 2s infinite;"></div>
  </div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

// Incident pin
const incidentIcon = L.divIcon({
    html: `<div style="
    width: 32px; height: 32px;
    background: rgba(255, 77, 77, 0.15);
    border: 2px solid #ff4d4d;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #ff4d4d;
    box-shadow: 0 0 20px rgba(255, 77, 77, 0.35);
  ">${renderToString(<AlertTriangle size={18} />)}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

// Base marker
const baseIcon = L.divIcon({
    html: `<div style="
    width: 24px; height: 24px;
    background: rgba(223, 255, 0, 0.08);
    border: 1px solid rgba(223, 255, 0, 0.4);
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: #DFFF00;
  ">${renderToString(<Crosshair size={14} />)}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const getMapStyleUrl = (styleId, theme) => {
    if (styleId === 'satellite') return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    return theme === 'light' 
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
};

const MAP_OPTIONS = [
    { id: 'satellite', name: 'SATELLITE' },
    { id: 'default', name: 'DEFAULT' }
];

const NO_FLY_ZONES = [
    { 
        name: 'Bharati Hospital', 
        coordinates: [
            [18.4590, 73.8568],
            [18.4601, 73.8568],
            [18.4601, 73.8580],
            [18.4590, 73.8580]
        ],
        center: [18.4595965, 73.8573443],
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
    const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
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

        // The tileLayer is deliberately omitted here. 
        // We rely on the second useEffect to inject the tileLayer based on state.

        // Render all No-Fly Zones
        NO_FLY_ZONES.forEach((zone) => {
            const polygon = L.polygon(zone.coordinates, {
                color: '#ff4d4d',
                fillColor: '#ff4d4d',
                fillOpacity: 0.08,
                weight: 1,
                dashArray: '4,6',
            }).addTo(map);
            
            L.marker(zone.center, {
                icon: L.divIcon({
                    html: `<div style="color: #ff4d4d; font-size: 8px; font-weight: 800; white-space: nowrap; opacity: 0.5; letter-spacing: 1px; font-family: 'Plus Jakarta Sans', sans-serif;">NO FLY ZONE</div>`,
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

    // Theme Listener
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    // Handle Style/Theme Change
    useEffect(() => {
        if (!mapInstance.current) return;

        if (tileLayer.current) {
            mapInstance.current.removeLayer(tileLayer.current);
        }

        const url = getMapStyleUrl(style, theme);
        
        tileLayer.current = L.tileLayer(url, {
            maxZoom: 22,
            maxNativeZoom: style === 'satellite' ? 20 : 19,
            subdomains: style === 'satellite' ? 'abc' : 'abcd',
            attribution: '© OpenStreetMap contributors © CARTO'
        }).addTo(mapInstance.current);

        if (style === 'satellite') {
            mapRef.current.classList.add('tactical-map-filter');
        } else {
            mapRef.current.classList.remove('tactical-map-filter');
        }

    }, [style, theme]);

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

        routeLine.current = L.polyline([BASE_POSITION, incPos], {
            color: '#00F5FF',
            weight: 2.5,
            opacity: 0.7,
            lineJoin: 'round',
            dashArray: '8,8'
        }).addTo(mapInstance.current);
        
        const midPoint = [(BASE_POSITION[0] + incPos[0]) / 2, (BASE_POSITION[1] + incPos[1]) / 2];
        L.marker(midPoint, {
            icon: L.divIcon({
                html: `<div style="background: #00F5FF; color: #0a0e1a; font-size: 8px; font-weight: 800; padding: 3px 8px; border-radius: 9999px; transform: rotate(-20deg); white-space: nowrap; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.5px; box-shadow: 0 0 12px rgba(0, 245, 255, 0.4);">OPTIMAL ROUTE</div>`,
                className: '',
                iconAnchor: [40, 5]
            })
        }).addTo(mapInstance.current);

        mapInstance.current.flyToBounds([BASE_POSITION, incPos], { padding: [100, 100], duration: 1.5 });
    }, [incidentCoords]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Map Style Selector */}
            <div style={{
                position: 'absolute', top: 16, right: 16, zIndex: 1000,
                display: 'flex', gap: '6px'
            }}>
                {MAP_OPTIONS.map((opt) => (
                    <button
                        key={opt.id}
                        className={`map-style-btn ${style === opt.id ? 'active' : ''}`}
                        onClick={() => setStyle(opt.id)}
                    >
                        {opt.name}
                    </button>
                ))}
            </div>

            <div 
                ref={mapRef} 
                style={{ width: '100%', height: '100%', background: '#0a0e1a' }} 
            />
        </div>
    );
}
