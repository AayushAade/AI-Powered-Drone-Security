import { useState, useCallback, useEffect, useRef } from 'react';
import './index.css';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import VideoUpload from './components/VideoUpload';
import MapView from './components/MapView';
import AlertPanel from './components/AlertPanel';
import VideoFeed from './components/VideoFeed';
import DroneStatus from './components/DroneStatus';

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
    const [mainView, setMainView] = useState('map'); // 'map' or 'video'

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
        <div className="app-container">
            <Sidebar />
            
            <TopBar wsConnected={wsConnected} mobileConnected={mobileConnected} />

            <aside className="left-panel">
                <VideoFeed frameData={frameData} mobileConnected={mobileConnected} />
            </aside>

            <main className="map-viewport" style={{ position: 'relative' }}>
                {/* MAP VIEW LAYER */}
                <div 
                    style={mainView === 'map' 
                        ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 } 
                        : { position: 'absolute', bottom: '24px', left: '24px', width: '320px', height: '180px', zIndex: 1000, cursor: 'pointer', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                    onClick={() => { if (mainView === 'video') setMainView('map'); }}
                >
                    <MapView
                        dronePos={dronePos}
                        incidentCoords={incidentCoords}
                        droneStatus={droneTelemetry?.status}
                    />
                    {mainView === 'video' && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1001, background: 'rgba(0,0,0,0.1)' }} />
                    )}
                </div>
                
                {/* VIDEO VIEW LAYER */}
                <div 
                    className={mainView === 'video' ? "" : "glass-card"}
                    style={mainView === 'video'
                        ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, background: '#000', display: 'flex', flexDirection: 'column' }
                        : { position: 'absolute', top: '24px', left: '24px', width: '320px', zIndex: 1000, padding: '4px', borderColor: 'var(--accent-red)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                    onClick={() => { if (mainView === 'map') setMainView('video'); }}
                >
                    {mainView === 'video' ? (
                        // FULL SCREEN VIDEO MODE
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {frameData ? (
                                <img src={frameData} alt="Drone View" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '18px', letterSpacing: '2px' }}>NO TARGET VISUAL</div>
                            )}

                            {/* Bounding Box Simulation (AI Tracking) */}
                            <div style={{ position: 'absolute', top: '40%', left: '30%', width: '40%', height: '30%', border: '2px solid rgba(0, 245, 255, 0.4)', background: 'rgba(0, 150, 255, 0.1)', transform: 'perspective(500px) rotateX(20deg)' }}></div>
                            <div style={{ position: 'absolute', top: '45%', left: '35%', width: '60px', height: '120px', border: '1px solid var(--accent-gold)' }}></div>
                            <div style={{ position: 'absolute', top: '48%', left: '45%', width: '50px', height: '110px', border: '1px solid var(--accent-gold)' }}></div>
                            
                            {/* Overlay text for full screen */}
                            <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: 'rgba(255,0,0,0.8)', color: 'white', padding: '6px 16px', fontSize: '18px', fontWeight: 'bold', borderRadius: '4px' }}>
                                    DRONE ALPHA
                                </div>
                            </div>
                            
                            <div style={{ position: 'absolute', top: 24, right: 24 }}>
                                <div style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 24px', fontSize: '20px', fontWeight: '800', borderRadius: '4px' }}>
                                    CROWD SIZE: ~52
                                </div>
                            </div>

                            {/* Telemetry OSD (On-Screen Display) */}
                            <div style={{ position: 'absolute', bottom: 24, right: 24, padding: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', color: 'white', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>
                                <div>ALT: 45m <span style={{color: 'var(--text-muted)'}}>+</span></div>
                                <div>SPD: 0 km/h (Hover)</div>
                                <div>BAT: 78%</div>
                            </div>
                        </div>
                    ) : (
                        // PIP VIDEO MODE
                        <>
                            <div style={{ background: '#000', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                                {frameData ? (
                                    <img src={frameData} alt="Drone View" style={{ width: '100%', display: 'block' }} />
                                ) : (
                                    <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                                        NO TARGET VISUAL
                                    </div>
                                )}
                                <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,0,0,0.6)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>DRONE ALPHA - CAM 01</div>
                            </div>
                            <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: '800' }}>SECTOR A1 - PUNE</div>
                                    <div style={{ fontSize: '9px', color: 'var(--accent-red)', fontWeight: 'bold' }}>INCIDENT ANALYSIS ACTIVE</div>
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>HD 1080P</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="scan-effect" style={{ pointerEvents: 'none' }} />
            </main>

            <aside style={{ gridArea: 'right', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
                <DroneStatus telemetry={droneTelemetry} />
            </aside>

            <section className="bottom-panel">
                <div className="panel-title">ACTIVE INCIDENTS • SECTOR A1 MONITORING</div>
                <AlertPanel alerts={alerts} />
            </section>
        </div>
    );
}
