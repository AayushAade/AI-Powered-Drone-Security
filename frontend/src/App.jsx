import { useState, useCallback, useEffect, useRef } from 'react';
import './index.css';
import { io } from 'socket.io-client';
import MapView from './components/MapView';
import AlertPanel from './components/AlertPanel';
import VideoFeed from './components/VideoFeed';
import DroneStatus from './components/DroneStatus';
import IncidentLog from './components/IncidentLog';
import VideoUpload from './components/VideoUpload';

function Clock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return <span className="clock">{time.toLocaleTimeString()}</span>;
}

function addLog(setLogs, logType, title, detail) {
    setLogs(prev => [{
        time: new Date().toLocaleTimeString(),
        logType, title, detail,
    }, ...prev].slice(0, 50));
}

export default function App() {
    const [wsConnected, setWsConnected] = useState(false);
    const [mobileConnected, setMobileConnected] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [dronePos, setDronePos] = useState(null);
    const [droneTelemetry, setDroneTelemetry] = useState(null);
    const [frameData, setFrameData] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [incidentCoords, setIncidentCoords] = useState(null);
    const [logs, setLogs] = useState([]);
    const [analysing, setAnalysing] = useState(false);

    const logRef = useRef({ addLog: (t, ti, d) => addLog(setLogs, t, ti, d) });
    const peerConnection = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        const socket = io('http://localhost:3000');
        socketRef.current = socket;

        socket.on('connect', () => {
            setWsConnected(true);
            logRef.current.addLog('system', 'Dashboard Connected', 'Socket.io link established');
            socket.emit('viewer_joined');
        });

        socket.on('disconnect', () => setWsConnected(false));

        socket.on('initial_state', (data) => {
            if (data.alerts?.length) setAlerts(data.alerts);
            // Also set other initial state if needed
        });

        socket.on('new_alert', (alert) => {
            setAlerts(prev => [alert, ...prev]);
            setIncidentCoords({ lat: alert.lat, lng: alert.lng });
            logRef.current.addLog('alert', `${alert.type} DETECTED`, `Severity: ${alert.severity}`);
        });

        socket.on('telemetry_update', (drones) => {
            const drone = drones[0]; // Assuming single drone for now
            if (drone) {
                setDronePos({ lat: drone.lat, lng: drone.lng, altitude: drone.altitude || 0 });
                setDroneTelemetry(drone);
                setMobileConnected(drone.status !== 'OFFLINE');

                if (drone.status === 'ON_SCENE') {
                    logRef.current.addLog('update', 'Drone On Site', `${drone.id} arrived at incident location`);
                }
                if (drone.status === 'IDLE' && droneTelemetry?.status !== 'IDLE') {
                    logRef.current.addLog('system', 'Mission Complete', `${drone.id} returned to base`);
                }
            }
        });

        socket.on('video_frame', (data) => {
            setFrameData(data.image);
        });

        socket.on('ai_report', (report) => {
            logRef.current.addLog('system', 'AI Report Received', report.incidentType);
        });

        // --- WebRTC signaling ---
        socket.on('webrtc_offer', async (data) => {
            console.log('[WebRTC] Offer received.');
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            setupPeerConnection(socket);
            try {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                socket.emit('webrtc_answer', { target: 'broadcaster', answer });
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

        const setupPeerConnection = (s) => {
            peerConnection.current = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    s.emit('webrtc_ice_candidate', { target: 'broadcaster', candidate: event.candidate });
                }
            };

            peerConnection.current.ontrack = (event) => {
                console.log('[WebRTC] ✅ Remote track received!');
                setRemoteStream(event.streams[0]);
            };
        };

        // Polling for viewer_joined if stream not received
        const pollInterval = setInterval(() => {
            if (!remoteStream && socket.connected) {
                socket.emit('viewer_joined');
            }
        }, 3000);

        return () => {
            socket.disconnect();
            if (peerConnection.current) peerConnection.current.close();
            clearInterval(pollInterval);
        };
    }, [remoteStream, droneTelemetry?.status]);

    return (
        <div className="app">
            {/* ─── Header ─────────────────────────── */}
            <header className="header">
                <div className="header-left">
                    <div className="header-logo">🚁</div>
                    <div>
                        <div className="header-title">URBAN DRONE COMMAND CENTER</div>
                        <div className="header-subtitle">AI-Powered Safety Response System v1.0</div>
                    </div>
                </div>
                <div className="header-right">
                    <div className={`status-pill ${wsConnected ? 'online' : 'offline'}`}>
                        <span className={`status-dot ${wsConnected ? 'pulse' : ''}`} />
                        {wsConnected ? 'System Online' : 'Connecting...'}
                    </div>
                    <div className={`status-pill ${mobileConnected ? 'online' : 'offline'}`}>
                        <span className={`status-dot ${mobileConnected ? 'pulse' : ''}`} />
                        {mobileConnected ? 'Drone Active' : 'No Drone'}
                    </div>
                    <div className={`status-pill ${analysing ? 'online' : 'offline'}`} style={analysing ? { borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', background: 'rgba(159,122,234,0.1)' } : {}}>
                        <span className={analysing ? 'spin' : ''} style={{ fontSize: 12 }}>{analysing ? '⟳' : '🤖'}</span>
                        {analysing ? 'AI Analyzing...' : 'AI Ready'}
                    </div>
                    <Clock />
                </div>
            </header>

            {/* ─── Main Grid ──────────────────────── */}
            <main className="main">
                {/* LEFT PANEL */}
                <aside className="panel panel-left">
                    {/* Upload */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-title">📹 CCTV Analysis</span>
                        </div>
                        <VideoUpload
                            onAnalysisStart={() => setAnalysing(true)}
                            onAnalysisDone={() => setAnalysing(false)}
                        />
                    </div>

                    {/* Drone Status */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-title">🚁 Drone Status</span>
                        </div>
                        <DroneStatus telemetry={droneTelemetry} />
                    </div>

                    {/* Video Feed */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-title">📡 Live Drone Feed</span>
                            {mobileConnected && (
                                <span className="status-pill online" style={{ fontSize: 9, padding: '2px 6px' }}>
                                    <span className="status-dot pulse" /> LIVE
                                </span>
                            )}
                        </div>
                        <VideoFeed frameData={frameData} mobileConnected={mobileConnected} />
                    </div>
                </aside>

                {/* CENTER: MAP */}
                <div className="map-center">
                    <MapView
                        dronePos={dronePos}
                        incidentCoords={incidentCoords}
                        droneStatus={droneTelemetry?.status}
                    />
                </div>

                {/* RIGHT PANEL */}
                <aside className="panel panel-right">
                    {/* Active Alerts */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-title">🚨 Active Incidents</span>
                            {alerts.length > 0 && (
                                <span style={{ background: 'rgba(252,129,129,0.2)', color: 'var(--critical)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                                    {alerts.length}
                                </span>
                            )}
                        </div>
                        <AlertPanel alerts={alerts} />
                    </div>

                    {/* Incident Log */}
                    <div className="panel-section">
                        <div className="section-header">
                            <span className="section-title">📋 Event Log</span>
                        </div>
                        <IncidentLog logs={logs} />
                    </div>
                </aside>
            </main>
        </div>
    );
}
