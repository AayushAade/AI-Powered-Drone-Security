import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import { io } from 'socket.io-client';
import { Rnd } from 'react-rnd';
import { ShieldAlert, Crosshair, Battery, Clock, Video, PlaneTakeoff, BellRing, Activity, ChevronDown, ChevronUp, Flame, BarChart3, Zap, Play, Square, MapPin, PersonStanding, Users, Briefcase, Car, AlertTriangle, FileText, X, Settings, Layout, Layers, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const droneIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const alertIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// ─── Heatmap Layer ──────────────────────────────────────────────────────────
function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heatData = points.map(p => [p.lat, p.lng, 0.8]);
    const heat = L.heatLayer(heatData, {
      radius: 35, blur: 25, maxZoom: 17,
      gradient: { 0.2: '#2563eb', 0.4: '#7c3aed', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#dc2626' }
    }).addTo(map);
    return () => { map.removeLayer(heat); };
  }, [points, map]);
  return null;
}

// ─── Click-to-place Incident on Map ─────────────────────────────────────────
function MapClickHandler({ selectedIncidentType, onMapClick }) {
  useMapEvents({
    click(e) {
      if (selectedIncidentType) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// ─── Incident type configs for simulation buttons ───────────────────────────
const INCIDENT_CONFIGS = [
  { type: 'Fallen Person Detected', severity: 'CRITICAL', icon: PersonStanding, color: 'red', shortLabel: 'Fall' },
  { type: 'Crowd Gathering Detected', severity: 'High', icon: Users, color: 'orange', shortLabel: 'Crowd' },
  { type: 'Abandoned Bag Detected', severity: 'High', icon: Briefcase, color: 'amber', shortLabel: 'Bag' },
  { type: 'SOS - Hands Raised', severity: 'CRITICAL', icon: AlertTriangle, color: 'red', shortLabel: 'SOS' },
  { type: 'Suspicious Vehicle Stop', severity: 'Medium', icon: Car, color: 'yellow', shortLabel: 'Vehicle' },
  { type: 'Unauthorized Zone Entry', severity: 'High', icon: ShieldAlert, color: 'orange', shortLabel: 'Intrusion' },
];

export default function App() {
  const [drones, setDrones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [liveFrame, setLiveFrame] = useState(null);
  const [liveCCTVFrame, setLiveCCTVFrame] = useState(null);
  const [showWarningOverlay, setShowWarningOverlay] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerConnection = useRef(null);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const aiCaptureInterval = useRef(null);

  // UI Toggles
  const [showCCTV, setShowCCTV] = useState(true);
  const [showDroneCam, setShowDroneCam] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [autoSimRunning, setAutoSimRunning] = useState(false);
  const [aiReports, setAiReports] = useState([]);
  const [showReportPanel, setShowReportPanel] = useState(false);

  // Simulation: click-to-place mode
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);

  const mapRef = useRef(null);
  const mapCenter = [18.4850, 73.8550];

  useEffect(() => {
    const socket = io('http://localhost:3000');
    socket.on('initial_state', (d) => { setDrones(d.drones); setAlerts(d.alerts); });
    socket.on('telemetry_update', (d) => setDrones(d));
    socket.on('video_frame', (d) => setLiveFrame(d.image));
    socket.on('cctv_frame', (d) => setLiveCCTVFrame(d.image));
    socket.on('new_alert', (alert) => {
      setAlerts(prev => [alert, ...prev]);
      setShowWarningOverlay(alert);
      setTimeout(() => setShowWarningOverlay(null), 4000);
      if (mapRef.current) mapRef.current.flyTo([alert.lat, alert.lng], 15);
    });
    socket.on('ai_report', (report) => {
      setAiReports(prev => [report, ...prev]);
      setShowReportPanel(true);
    });

    // --- WebRTC Viewer Logic ---
    socketRef.current = socket;

    socket.on('webrtc_offer', async (data) => {
      console.log('[WebRTC] Offer received from mobile drone. (Re)creating peer connection...');
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      setupPeerConnection();
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('webrtc_answer', { target: 'broadcaster', answer });
        console.log('[WebRTC] Answer sent back to broadcaster.');
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    socket.on('webrtc_ice_candidate', async (data) => {
      try {
        if (peerConnection.current && data.candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    });

    const setupPeerConnection = () => {
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc_ice_candidate', { target: 'broadcaster', candidate: event.candidate });
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', peerConnection.current?.connectionState);
      };

      peerConnection.current.ontrack = (event) => {
        console.log('[WebRTC] ✅ Remote track received! Video should now display.');
        setRemoteStream(event.streams[0]);
        startAiCapture();
        if (viewerPollInterval) clearInterval(viewerPollInterval);
      };
    };

    const startAiCapture = () => {
      if (aiCaptureInterval.current) clearInterval(aiCaptureInterval.current);
      aiCaptureInterval.current = setInterval(() => {
        if (videoRef.current && socketRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0);
          const base64Image = canvas.toDataURL('image/jpeg', 0.5);
          socketRef.current.emit('video_frame', {
            camera_id: 'Drone-WebRTC',
            image: base64Image
          });
        }
      }, 5000);
    };

    let viewerPollInterval = null;

    socket.on('connect', () => {
      console.log('[Dashboard] ✅ Connected to backend:', socket.id);
      socket.emit('viewer_joined');
      viewerPollInterval = setInterval(() => {
        if (!remoteStream) {
          console.log('[Dashboard] Polling: emitting viewer_joined...');
          socket.emit('viewer_joined');
        } else {
          clearInterval(viewerPollInterval);
        }
      }, 3000);
    });

    return () => {
      socket.disconnect();
      if (peerConnection.current) peerConnection.current.close();
      if (aiCaptureInterval.current) clearInterval(aiCaptureInterval.current);
      if (viewerPollInterval) clearInterval(viewerPollInterval);
    };
  }, []);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = drones.filter(d => d.status !== 'IDLE').length;
    const avgBat = drones.length > 0 ? Math.round(drones.reduce((s, d) => s + d.battery, 0) / drones.length) : 0;
    const critical = alerts.filter(a => a.severity === 'CRITICAL').length;
    return { total: alerts.length, active, avgBat, critical };
  }, [drones, alerts]);

  // ─── Simulation Handlers ─────────────────────────────────────────────────
  const handleMapClick = async (lat, lng) => {
    if (!selectedIncidentType) return;
    const config = INCIDENT_CONFIGS.find(c => c.type === selectedIncidentType);
    try {
      await fetch('http://localhost:3000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: config.type, lat, lng, severity: config.severity }),
      });
    } catch (err) { console.error(err); }
    setSelectedIncidentType(null);
  };

  const handleQuickTrigger = async (config) => {
    const lat = 18.44 + Math.random() * 0.12;
    const lng = 73.82 + Math.random() * 0.08;
    try {
      await fetch('http://localhost:3000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: config.type, lat, lng, severity: config.severity }),
      });
    } catch (err) { console.error(err); }
  };

  const toggleAutoSim = async () => {
    const next = !autoSimRunning;
    try {
      await fetch('http://localhost:3000/api/auto-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      setAutoSimRunning(next);
    } catch (err) { console.error(err); }
  };

  const handleSystemReset = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/reset', { method: 'POST' });
      if (res.ok) {
        setAlerts([]);
        setAiReports([]);
        setShowReportPanel(false);
        if (autoSimRunning) {
          await fetch('http://localhost:3000/api/auto-simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false })
          });
          setAutoSimRunning(false);
        }
        if (mapRef.current) mapRef.current.flyTo(mapCenter, 13);
      }
    } catch (err) { console.error(err); }
  };

  const handleStartCCTVCam = async () => { try { await fetch('http://localhost:3000/api/start-cctv', { method: 'POST' }); } catch (err) { console.error(err); } };
  const handleStopCCTVCam = async () => { try { const r = await fetch('http://localhost:3000/api/stop-cctv', { method: 'POST' }); if (r.ok) setLiveCCTVFrame(null); } catch (err) { console.error(err); } };

  // ─── Colors and Helpers ──────────────────────────────────────────────────
  const severityColor = (s) => {
    if (s === 'CRITICAL') return 'bg-red-500/10 text-red-500 border-red-500/30';
    if (s === 'High') return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
  };
  const droneStatusColor = (s) => {
    if (s === 'IDLE') return 'bg-blue-500';
    if (s === 'DISPATCHED') return 'bg-emerald-500 animate-pulse';
    if (s === 'ON_SCENE') return 'bg-emerald-400';
    if (s === 'RETURNING') return 'bg-purple-500 animate-pulse';
    return 'bg-slate-500';
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden scanline">

      {/* ─── LEFT SIDEBAR: CONTROL & ANALYTICS ────────────────────────────── */}
      <div className="w-[380px] h-full glass-panel border-r border-white/5 flex flex-col relative z-30 shrink-0">

        {/* Brand Header */}
        <div className="p-6 border-b border-white/5 bg-slate-950/40">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-black bg-gradient-to-r from-emerald-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2.5 tracking-tight uppercase">
              <ShieldAlert size={28} className="text-emerald-500" />
              Urban Command
            </h1>
            <div className="p-2 glass-card rounded-lg text-slate-400 hover:text-white cursor-pointer transition">
              <Settings size={18} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 glass-card rounded-xl p-3 flex items-center gap-2.5">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">System Status</p>
                <p className="text-xs font-bold text-emerald-400">AI NETWORK ONLINE</p>
              </div>
            </div>
            <div className="flex-1 glass-card rounded-xl p-3 flex items-center gap-2.5">
              <PlaneTakeoff size={18} className="text-indigo-400" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Fleet Active</p>
                <p className="text-xs font-bold text-white uppercase">{stats.active}/{drones.length} Units</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SIMULATION & ACTION CENTER ─────────────────────────────────── */}
        <div className="p-6 space-y-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <Zap size={14} className="text-amber-400" /> Action Center
            </h2>
            <button
              onClick={toggleAutoSim}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${autoSimRunning
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800'
                }`}
            >
              {autoSimRunning ? <><Square size={10} fill="currentColor" /> Stop Simulation</> : <><Play size={10} fill="currentColor" /> Autonomous Mode</>}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {INCIDENT_CONFIGS.map((config) => {
              const Icon = config.icon;
              const isSelected = selectedIncidentType === config.type;
              return (
                <button
                  key={config.type}
                  onClick={() => handleQuickTrigger(config)}
                  onContextMenu={(e) => { e.preventDefault(); setSelectedIncidentType(isSelected ? null : config.type); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all relative overflow-hidden group ${isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                    }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                    <Icon size={16} />
                  </div>
                  <span className="relative z-10">{config.shortLabel}</span>
                  {isSelected && <div className="absolute top-0 right-0 p-1"><Zap size={8} fill="white" /></div>}
                </button>
              );
            })}
          </div>
          {selectedIncidentType && (
            <div className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-center animate-pulse flex items-center justify-center gap-2">
              <MapPin size={14} /> GPS PLACEMENT MODE ACTIVE
            </div>
          )}
        </div>

        {/* ─── LIVE INCIDENT FEED ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <Activity size={14} className="text-red-500" /> Active Incidents
            </h2>
            <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-full text-slate-400">{alerts.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scroll">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                <Crosshair size={32} className="mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Scanning Active Grids</p>
                <p className="text-[10px] text-slate-700 mt-2">Simulation Idle</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const drone = drones.find(d => d.target?.alertId === alert.id);
                return (
                  <div
                    key={alert.id}
                    onClick={() => { if (mapRef.current) mapRef.current.flyTo([alert.lat, alert.lng], 16); }}
                    className="group p-4 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-all relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                        <h3 className="font-bold text-[13px] text-white tracking-tight">{alert.type}</h3>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${severityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock size={12} />
                        <span className="text-[10px] font-mono tracking-wider">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                      {drone ? (
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                          <PlaneTakeoff size={12} className="text-emerald-400" />
                          <span className="text-[10px] font-black text-emerald-400">{drone.id} {drone.status === 'ON_SCENE' ? 'ARRIVED' : 'IN TRANSIT'}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 uppercase italic">Dispatch Pending...</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── CCTV FIXED STATION ─────────────────────────────────────────── */}
        <div className="p-6 bg-slate-950/60 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <Navigation size={14} className="text-emerald-400" /> Fixed Station Alpha
            </h2>
            <div className="flex gap-2">
              <button onClick={handleStartCCTVCam} className="p-2 glass-card rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition"><Zap size={14} /></button>
              <button onClick={handleStopCCTVCam} className="p-2 glass-card rounded-lg text-red-500 hover:bg-red-500/20 transition"><X size={14} /></button>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900 aspect-video relative group shadow-2xl">
            {liveCCTVFrame && showCCTV ? (
              <img src={`data:image/jpeg;base64,${liveCCTVFrame}`} alt="CCTV Feed" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 bg-slate-950/80">
                <Video size={32} className="opacity-20 mb-2" />
                <span className="text-[10px] font-black tracking-[0.3em] uppercase opacity-40">Connecting Node...</span>
              </div>
            )}
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 backdrop-blur-md text-[9px] font-black text-white rounded border border-white/10 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
              CCTV-043-B
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT: MAP & DATA VISUALIZATION ───────────────────────── */}
      <div className="flex-1 h-full flex flex-col relative">

        {/* ─── HUD TOP BAR ────────────────────────────────────────────────── */}
        <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between pointer-events-none">
          <div className="flex flex-col gap-2 pointer-events-auto">
            <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Incidents</span>
                <span className="text-xl font-black text-white">{stats.total}</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Critical Priority</span>
                <span className="text-xl font-black text-red-500">{stats.critical}</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Average Battery</span>
                <span className={`text-xl font-black ${stats.avgBat > 50 ? 'text-emerald-400' : 'text-amber-500'}`}>{stats.avgBat}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <button onClick={() => setShowHeatmap(!showHeatmap)} className={`glass-panel px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showHeatmap ? 'neon-text-emerald border-emerald-500/50' : 'text-slate-400'}`}>
              <Flame size={14} /> Intelligence Heatmap
            </button>
            <button onClick={handleSystemReset} className="glass-panel px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10 transition-all">
              <ShieldAlert size={14} /> Purge System
            </button>
          </div>
        </div>

        {/* ─── MAP INTERFACE ──────────────────────────────────────────────── */}
        <div className="flex-1 relative z-10 p-4">
          <div className="w-full h-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] relative">
            <MapContainer center={mapCenter} zoom={13} zoomControl={false} ref={mapRef}>
              <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <MapClickHandler selectedIncidentType={selectedIncidentType} onMapClick={handleMapClick} />
              {showHeatmap && alerts.length > 0 && <HeatmapLayer points={alerts.map(a => ({ lat: a.lat, lng: a.lng }))} />}

              {alerts.map(alert => (
                <Marker key={alert.id} position={[alert.lat, alert.lng]} icon={alertIcon}>
                  <Popup className="glass-popup">
                    <div className="text-xs font-bold text-slate-100 p-1">
                      <div className="text-red-500 mb-1 font-black uppercase tracking-widest text-[9px]">{alert.severity}</div>
                      {alert.type}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {drones.map(drone => (
                <Marker key={drone.id} position={[drone.lat, drone.lng]} icon={droneIcon}>
                  <Popup>
                    <div className="text-xs font-bold text-slate-100 p-1">
                      <div className="text-emerald-400 mb-1 font-black uppercase tracking-widest text-[9px]">{drone.status}</div>
                      UNIT {drone.id} • BAT {Math.round(drone.battery)}%
                    </div>
                  </Popup>
                </Marker>
              ))}

              {drones.map(drone => (
                (drone.status === 'DISPATCHED' || drone.status === 'RETURNING') && drone.target && (
                  <Polyline
                    key={`path-${drone.id}`}
                    positions={[[drone.lat, drone.lng], [drone.target.lat, drone.target.lng]]}
                    pathOptions={{ color: drone.status === 'RETURNING' ? '#a78bfa' : '#10b981', dashArray: '8, 12', weight: 2, opacity: 0.6 }}
                  />
                )
              ))}
            </MapContainer>

            {/* Drone Aerial Optics Embedded (Bottom Right) */}
            {showDroneCam && (
              <div className="absolute bottom-10 right-10 z-[500] w-[340px] glass-panel rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] border-white/10">
                <div className="bg-white/[0.03] backdrop-blur-md px-5 py-3 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                    <span className="text-[11px] font-black tracking-[0.2em] text-white uppercase italic">Aerial Recon Unit</span>
                  </div>
                  <button onClick={() => setShowDroneCam(false)} className="text-slate-500 hover:text-white transition"><X size={16} /></button>
                </div>
                <div className="bg-black aspect-video flex items-center justify-center relative">
                  {remoteStream && showDroneCam ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(video) => {
                        videoRef.current = video;
                        if (video) video.srcObject = remoteStream;
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : liveFrame ? (
                    <img src={liveFrame} className="w-full h-full object-cover" alt="Drone Camera" />
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <Activity size={32} className="text-indigo-500 opacity-30 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Downlink Synchronizing...</span>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-2">
                      <Zap size={10} className="text-emerald-400" />
                      <span className="text-[10px] font-black text-emerald-400 tracking-wider">WEBRTC • 4K ULTRA</span>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 text-[9px] font-mono text-white/40 tracking-widest italic bg-black/40 px-2 py-1 rounded">
                    ENCR_AES_256
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── HUD BOTTOM BAR: TELEMETRY ───────────────────────────────────── */}
        <div className="h-28 px-10 flex items-center gap-6 z-20">
          {drones.map(d => (
            <div key={d.id} className="glass-panel px-5 py-3 rounded-2xl flex items-center gap-4 min-w-[200px] border-white/5 hover:border-white/20 transition-all cursor-crosshair">
              <div className={`p-2.5 rounded-xl ${d.status === 'IDLE' ? 'bg-slate-800' : 'bg-emerald-500/20'}`}>
                <PlaneTakeoff size={20} className={d.status === 'IDLE' ? 'text-slate-500' : 'text-emerald-400'} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black text-white tracking-tighter">UNIT {d.id}</span>
                  <span className={`text-[9px] font-black uppercase ${d.status === 'IDLE' ? 'text-slate-500' : 'neon-text-emerald'}`}>{d.status}</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${d.battery > 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${d.battery}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Power</span>
                  <span className="text-[8px] font-black text-slate-300 font-mono italic">{Math.round(d.battery)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── AI SITUATIONAL ANALYTICS (Overlay Drawer) ────────────────────── */}
      {showReportPanel && aiReports.length > 0 && (
        <div className="fixed inset-y-6 right-6 z-[9999] w-[480px] glass-panel border border-white/10 rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col transform transition-all duration-500 animate-in slide-in-from-right overflow-hidden border-indigo-500/20">
          <div className="px-8 py-6 bg-indigo-600/10 border-b border-white/5 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                <FileText size={24} className="text-indigo-400" />
                AI INTELLIGENCE REPORT
              </h2>
              <p className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-[0.2em] mt-1">Neural Vision Protocol Activated</p>
            </div>
            <button onClick={() => setShowReportPanel(false)} className="p-2 glass-card rounded-xl text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
            {aiReports.map((report, idx) => (
              <div key={idx} className="glass-card rounded-3xl overflow-hidden border border-white/5 hover:border-white/10 transition-all">
                {report.frameImage ? (
                  <div className="relative aspect-video group">
                    <img src={`data:image/jpeg;base64,${report.frameImage}`} className="w-full h-full object-cover" alt="Drone Frame" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/20" />
                    <div className="absolute top-4 left-4">
                      <div className="bg-red-600/90 text-[10px] font-black text-white px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-2 backdrop-blur-md">
                        <Activity size={10} className="animate-pulse" /> SIGHTING VERIFIED
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 bg-slate-900 flex items-center justify-center border-b border-white/5 relative group">
                    <div className="absolute inset-0 bg-white/[0.02] animate-pulse" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] italic">Telemetry Only Mode</span>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-emerald-400 font-black text-[11px] uppercase tracking-widest leading-none mb-1">Target Classification</h3>
                      <p className="text-lg font-black text-white leading-none">{report.incidentType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Timestamp</p>
                      <p className="text-xs font-mono text-slate-400">{new Date(report.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  <div className="prose prose-invert prose-sm max-w-none text-slate-400/90 text-xs leading-relaxed font-medium">
                    {report.report.split('\n').map((line, i) => {
                      if (line.trim().startsWith('**')) {
                        const parts = line.split('**');
                        return <p key={i} className="my-2 border-l-2 border-indigo-500/50 pl-3"><strong className="text-white uppercase tracking-wider text-[10px]">{parts[1]}</strong>{parts.slice(2).join('')}</p>;
                      } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                        return <div key={i} className="flex gap-2 my-1.5"><Zap size={10} className="text-emerald-500 mt-1 shrink-0" /><span className="flex-1">{line.substring(2)}</span></div>;
                      }
                      return <p key={i} className="my-2 font-light">{line}</p>;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── ALERT OVERLAY REDESIGNED ────────────────────────────────────── */}
      {showWarningOverlay && (
        <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 border-[30px] border-red-600/20 animate-[ping_1.5s_infinite]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-red-600 blur-[120px] opacity-40 animate-pulse" />
              <div className="relative bg-black/90 glass-panel border-[3px] border-red-600 rounded-[3rem] px-16 py-10 flex flex-col items-center shadow-[0_0_100px_rgba(220,38,38,0.5)]">
                <AlertTriangle size={80} className="text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                <h1 className="text-5xl font-black text-white tracking-[0.3em] uppercase mb-2">Sector Alert</h1>
                <div className="h-px w-full bg-white/10 my-4" />
                <h2 className="text-3xl font-black text-red-500 uppercase tracking-widest text-center italic">{showWarningOverlay.type}</h2>
                <div className="mt-8 flex flex-col items-center">
                  <div className="flex items-center gap-3 text-white/50 mb-3 uppercase tracking-widest font-black text-xs">
                    <Activity size={16} /> Neural Command Analysis
                  </div>
                  <p className="text-xl font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-8 py-3 rounded-2xl animate-pulse">
                    UNIT-01 INTERCEPT DISPATCHED
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
