import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import { io } from 'socket.io-client';
import { Rnd } from 'react-rnd';
import { ShieldAlert, Crosshair, Battery, Clock, Video, PlaneTakeoff, BellRing, Activity } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icons
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Custom Drone Icon (Green)
const droneIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom Alert Icon (Red)
const alertIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function App() {
  const [drones, setDrones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [liveCCTVFrame, setLiveCCTVFrame] = useState(null);

  // UI Admin Toggles
  const [showCCTV, setShowCCTV] = useState(true);
  const [showDroneCam, setShowDroneCam] = useState(true);

  const mapRef = useRef(null);

  // Center of Pune for starting map view
  const mapCenter = [18.4590, 73.8577];

  useEffect(() => {
    // Connect to Node.js Backend
    const socket = io('http://localhost:3000');

    socket.on('initial_state', (data) => {
      setDrones(data.drones);
      setAlerts(data.alerts);
    });

    socket.on('telemetry_update', (updatedDrones) => {
      setDrones(updatedDrones);
    });

    // Receive live YOLO video frames from backend (Drone)
    socket.on('video_frame', (data) => {
      setLiveFrame(data.image);
    });

    // Receive live YOLO video frames from backend (CCTV)
    socket.on('cctv_frame', (data) => {
      setLiveCCTVFrame(data.image);
    });

    socket.on('new_alert', (alert) => {
      setAlerts(prev => [alert, ...prev]);
      if (mapRef.current) {
        mapRef.current.flyTo([alert.lat, alert.lng], 16);
      }
    });

    return () => socket.disconnect();
  }, []);

  // --- Admin Functions ---
  const handleSystemReset = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/reset', { method: 'POST' });
      if (res.ok) {
        setAlerts([]);
        setSelectedAlert(null);
        if (mapRef.current) mapRef.current.flyTo(mapCenter, 14);
      }
    } catch (err) {
      console.error("Failed to reset system:", err);
    }
  };

  const handleStartDroneCam = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/start-drone', { method: 'POST' });
      if (!res.ok) {
        console.error("Failed to start drone camera process.");
      }
    } catch (err) {
      console.error("Network error starting drone camera:", err);
    }
  };

  const handleStartCCTVCam = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/start-cctv', { method: 'POST' });
      if (!res.ok) {
        console.error("Failed to start CCTV camera process.");
      }
    } catch (err) {
      console.error("Network error starting CCTV camera:", err);
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-white font-sans overflow-hidden">

      {/* LEFT SIDEBAR: ACTIVE ALERTS */}
      <div className="w-1/4 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <ShieldAlert size={24} className="text-blue-400" />
              Urban Command Center
            </h1>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
              <Activity size={12} className="text-emerald-400 animate-pulse" />
              AI System Online • Live Monitoring
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Active Incidents ({alerts.length})</h2>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              <Crosshair size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No active incidents</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div
                key={alert.id}
                onClick={() => {
                  setSelectedAlert(alert);
                  if (mapRef.current) mapRef.current.flyTo([alert.lat, alert.lng], 17);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:bg-zinc-800 
                  ${selectedAlert?.id === alert.id ? 'border-indigo-500 bg-zinc-800/80 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-zinc-800 bg-zinc-900'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <h3 className="font-semibold text-sm text-zinc-100">{alert.type}</h3>
                  </div>
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 font-mono mb-3 bg-black/30 p-2 rounded border border-zinc-800/50">
                  [{alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}]
                </div>

                {/* Look for drone responding to this alert */}
                {drones.find(d => d.target?.alertId === alert.id) ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 p-2 rounded-md border border-emerald-400/20">
                    <PlaneTakeoff size={14} />
                    Drone En Route • ETA: {drones.find(d => d.target?.alertId === alert.id).eta}s
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-yellow-500/80">
                    <Clock size={14} /> Awaiting Dispatch...
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* STATIONARY CCTV FEED OVERLAY */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex justify-between items-center mb-2">
            <span>Stationary Sensors (CCTV)</span>
            {liveCCTVFrame && showCCTV ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                ACTIVE
              </span>
            ) : (
              <span className="text-[10px] text-zinc-600 font-mono flex items-center gap-1">
                OFFLINE
              </span>
            )}
          </h2>
          <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black aspect-video relative group">
            {liveCCTVFrame && showCCTV ? (
              <img
                src={`data:image/jpeg;base64,${liveCCTVFrame}`}
                alt="CCTV Trigger Feed"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-2">
                <Video size={20} className="opacity-50" />
                <span className="text-[10px] font-mono tracking-widest uppercase">
                  {showCCTV ? "Waiting for signal..." : "Feed Disabled"}
                </span>
              </div>
            )}
            {/* Overlay timestamp */}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur text-[9px] text-emerald-400 font-mono rounded border border-zinc-700/50 flex items-center gap-1">
              REC // Triage Cam 01
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT MAIN AREA: MAP & DRONE FLEET */}
      <div className="w-3/4 h-full flex flex-col relative">

        {/* TOP FLEET STATUS & ADMIN BAR */}
        <div className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-6">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mr-4">Fleet Status</div>
            {drones.map(drone => (
              <div key={drone.id} className="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                <div className={`w-2 h-2 rounded-full ${drone.status === 'IDLE' ? 'bg-blue-500' : drone.status === 'DISPATCHED' ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
                <div>
                  <div className="text-xs font-bold text-zinc-200">{drone.id}</div>
                  <div className="text-[10px] text-zinc-500 font-medium">{drone.status}</div>
                </div>
                <div className="ml-4 pl-4 border-l border-zinc-800 flex items-center gap-1">
                  <Battery size={14} className={drone.battery > 50 ? 'text-emerald-500' : 'text-red-500'} />
                  <span className="text-xs font-mono text-zinc-400">{Math.round(drone.battery)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Admin Controls Area */}
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-6 ml-auto">
            <button
              onClick={handleStartCCTVCam}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Video size={14} /> LAUNCH CCTV CAM
            </button>
            <button
              onClick={handleStartDroneCam}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Video size={14} /> LAUNCH DRONE CAM
            </button>
            <div className="w-px h-6 bg-zinc-800 mx-1"></div>
            <button
              onClick={() => setShowCCTV(!showCCTV)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-2 transition-all 
                ${showCCTV ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
            >
              <Video size={14} /> CCTV Feed: {showCCTV ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowDroneCam(!showDroneCam)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-2 transition-all 
                ${showDroneCam ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
            >
              <PlaneTakeoff size={14} /> Drone Cam: {showDroneCam ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={handleSystemReset}
              className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-md text-xs font-bold hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <ShieldAlert size={14} /> FAST RESET
            </button>
          </div>
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-1 relative bg-zinc-900 p-2">
          <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-zinc-800/50">
            <MapContainer
              center={mapCenter}
              zoom={14}
              className="dark-map" /* Custom CSS class for dark mode map */
              zoomControl={false}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* GEOFENCE DEMO: Hospital No-Fly Zone */}
              <Circle
                center={[18.5200, 73.8550]}
                radius={300}
                pathOptions={{ color: 'red', fillColor: '#ef4444', fillOpacity: 0.2, dashArray: '4' }}
              />

              {/* RENDER INCIDENT PINS */}
              {alerts.map(alert => (
                <Marker key={alert.id} position={[alert.lat, alert.lng]} icon={alertIcon}>
                  <Popup className="custom-popup">
                    <strong>{alert.type}</strong><br />
                    Severity: {alert.severity}
                  </Popup>
                </Marker>
              ))}

              {/* RENDER DRONES AND THEIR ROUTES */}
              {drones.map(drone => (
                <React.Fragment key={drone.id}>
                  <Marker position={[drone.lat, drone.lng]} icon={droneIcon}>
                    <Popup>
                      <strong>{drone.id}</strong><br />
                      Battery: {Math.round(drone.battery)}%<br />
                      Status: {drone.status}
                    </Popup>
                  </Marker>

                  {/* Draw line to target if dispatched */}
                  {drone.status === 'DISPATCHED' && drone.target && (
                    <Polyline
                      positions={[
                        [drone.lat, drone.lng],
                        [drone.target.lat, drone.target.lng]
                      ]}
                      pathOptions={{ color: '#10b981', dashArray: '5, 10', weight: 3, opacity: 0.7 }}
                    />
                  )}
                </React.Fragment>
              ))}
            </MapContainer>
          </div>

          {/* SIMULATED LIVE CAMERA FEED MODAL (Appears when drone is on scene or alert clicked) */}
          {selectedAlert && (
            <Rnd
              default={{
                x: 20,
                y: 20,
                width: 380,
                height: 280,
              }}
              minWidth={250}
              minHeight={200}
              bounds="parent"
              enableResizing={{
                top: false, right: false, bottom: false, left: false,
                topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
              }}
              resizeHandleStyles={{
                bottomRight: { width: '20px', height: '20px', zIndex: 1001, cursor: 'nwse-resize' },
                bottomLeft: { width: '20px', height: '20px', zIndex: 1001, cursor: 'nesw-resize' },
                topRight: { width: '20px', height: '20px', zIndex: 1001, cursor: 'nesw-resize' },
                topLeft: { width: '20px', height: '20px', zIndex: 1001, cursor: 'nwse-resize' }
              }}
              dragHandleClassName="draggable-handle"
              className="z-[1000] absolute"
              style={{ position: 'absolute' }}
            >
              <div className="w-full h-full bg-zinc-900 border border-zinc-700 shadow-2xl rounded-xl flex flex-col overflow-hidden relative">
                <div className="draggable-handle bg-zinc-800 px-3 py-2 flex items-center justify-between border-b border-zinc-700 cursor-move shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 pointer-events-none">
                    <Video size={14} className="text-red-400" />
                    Live Drone Feed: YOLO Object Tracking
                  </div>
                  <button onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setSelectedAlert(null)} className="text-zinc-500 hover:text-white cursor-pointer z-50">&times;</button>
                </div>
                <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden pointer-events-none">
                  {/* LIVE IP CAMERA FEED STREAMED FROM PYTHON -> NODE -> REACT */}
                  {liveFrame && showDroneCam ? (
                    <img
                      src={`data:image/jpeg;base64,${liveFrame}`}
                      className="w-full h-full object-cover"
                      alt="Live Tracker"
                    />
                  ) : (
                    <div className="text-xs text-zinc-600 font-mono animate-pulse flex flex-col items-center gap-2">
                      <Video size={20} className="opacity-50" />
                      {showDroneCam ? "Waiting for video signal..." : "DRONE OPTICS DISABLED"}
                    </div>
                  )}
                </div>
              </div>
            </Rnd>
          )}

        </div>
      </div>
    </div>
  );
}
