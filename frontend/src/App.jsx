import { useState, useCallback, useEffect, useRef } from 'react';
import './index.css';
import { io } from 'socket.io-client';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import VideoUpload from './components/VideoUpload';
import MapView from './components/MapView';
import AlertPanel from './components/AlertPanel';
import VideoFeed from './components/VideoFeed';
import DroneStatus from './components/DroneStatus';
import LogsView from './components/views/LogsView';
import AnalyticsView from './components/views/AnalyticsView';
import HelpView from './components/views/HelpView';
import FleetView from './components/views/FleetView';
import FootageUploadView from './components/views/FootageUploadView';

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
    const [fleet, setFleet] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');

    // --- Dynamic Layout States ---
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);
    const [bottomHeight, setBottomHeight] = useState(200);

    const isDragging = useRef(false);
    const layoutTimeoutRef = useRef(null);

    // Map Resize Trigger Effect
    useEffect(() => {
        if (layoutTimeoutRef.current) clearTimeout(layoutTimeoutRef.current);
        layoutTimeoutRef.current = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 350);
        return () => clearTimeout(layoutTimeoutRef.current);
    }, [isLeftOpen, isRightOpen, bottomHeight]);

    // Bottom Panel Drag Resizing Logic
    const handlePointerDown = (e) => {
        isDragging.current = true;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none'; 
    };

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDragging.current) return;
            let newHeight = window.innerHeight - e.clientY;
            if (newHeight < 48) newHeight = 48; // Minimized height (title bar)
            if (newHeight > window.innerHeight - 200) newHeight = window.innerHeight - 200; 
            setBottomHeight(newHeight);
        };
        const handlePointerUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

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
            console.log('[Socket] Received telemetry update:', drones);
            setFleet(drones); // Update the entire fleet state
            const drone = drones[0]; // Assuming single drone for main dashboard view
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
            const raw = data.image;
            const formatted = raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
            setFrameData(formatted);
        });
        
        socket.on('cctv_frame', (data) => {
            const raw = data.image;
            const formatted = raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
            setFrameData(formatted);
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
            if (!remoteStream && socket.current && socket.current.connected) {
                socket.current.emit('viewer_joined');
            }
        }, 3000);

        return () => {
            socket.disconnect();
            if (peerConnection.current) peerConnection.current.close();
            clearInterval(pollInterval);
        };
    }, []); // Run once on mount

    const renderMainContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <>
                        <aside className="left-panel">
                            <VideoFeed frameData={frameData} mobileConnected={mobileConnected} />
                        </aside>

                        <main className="map-viewport" style={{ position: 'relative' }}>
                            {/* Panel Toggle Buttons */}
                            <button 
                                className="panel-toggle-btn"
                                style={{ left: 0, top: '50%', transform: 'translate(0, -50%)', zIndex: 2000, borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                                onClick={() => setIsLeftOpen(!isLeftOpen)}
                                title={isLeftOpen ? "Collapse CCTV Panel" : "Expand CCTV Panel"}
                            >
                                {isLeftOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <button 
                                className="panel-toggle-btn"
                                style={{ right: 0, top: '50%', transform: 'translate(0, -50%)', zIndex: 2000, borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                onClick={() => setIsRightOpen(!isRightOpen)}
                                title={isRightOpen ? "Collapse Dispatch Panel" : "Expand Dispatch Panel"}
                            >
                                {isRightOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                            </button>

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
                                    ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, background: 'var(--bg-video)', display: 'flex', flexDirection: 'column' }
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
                                            <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'white', padding: '8px 24px', fontSize: '20px', fontWeight: '800', borderRadius: '4px' }}>
                                                CROWD SIZE: ~52
                                            </div>
                                        </div>

                                        {/* Telemetry OSD (On-Screen Display) */}
                                        <div style={{ position: 'absolute', bottom: 24, right: 24, padding: '12px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', color: 'white', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>
                                            <div>ALT: 45m <span style={{ color: 'var(--text-muted)' }}>+</span></div>
                                            <div>SPD: 0 km/h (Hover)</div>
                                            <div>BAT: 78%</div>
                                        </div>
                                    </div>
                                ) : (
                                    // PIP VIDEO MODE
                                    <>
                                        <div style={{ background: 'var(--bg-video)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
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

                        <aside className="right-panel">
                            <DroneStatus telemetry={droneTelemetry} mode={mainView === 'video' ? 'analytics' : 'default'} />
                        </aside>

                        <section className="bottom-panel" style={{ position: 'relative' }}>
                            <div className="drag-handle" onPointerDown={handlePointerDown}>
                                <div className="drag-handle-bar" />
                            </div>
                            <div className="panel-title">ACTIVE INCIDENTS • SECTOR A1 MONITORING</div>
                            <AlertPanel alerts={alerts} />
                        </section>
                    </>
                );
            case 'logs': return <LogsView />;
            case 'analytics': return <AnalyticsView />;
            case 'fleet': return <FleetView drones={fleet} />;
            case 'help': return <HelpView />;
            case 'upload': return <FootageUploadView />;
            case 'logout':
                return (
                    <div style={{ 
                        gridArea: '2 / 2 / -1 / -1', 
                        background: 'var(--bg-deep)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
                            <div style={{ 
                                width: '80px', 
                                height: '80px', 
                                borderRadius: '50%', 
                                background: 'rgba(255, 77, 77, 0.1)', 
                                border: '1px solid var(--accent-red-glow)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px',
                                color: 'var(--accent-red)'
                            }}>
                                <LogOut size={40} />
                            </div>
                            <h2 style={{ marginBottom: '12px' }}>TERMINATE SESSION?</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                                You are about to disconnect from the Command Center secure uplink.
                            </p>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button 
                                    onClick={() => setActiveTab('dashboard')}
                                    style={{ 
                                        flex: 1, 
                                        padding: '12px', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        border: '1px solid var(--border)',
                                        color: 'white',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    CANCEL
                                </button>
                                <button 
                                    onClick={() => window.location.reload()}
                                    style={{ 
                                        flex: 1, 
                                        padding: '12px', 
                                        background: 'var(--accent-red)', 
                                        border: 'none',
                                        color: 'white',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    LOGOUT
                                </button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return <div style={{ gridArea: '2 / 2 / -1 / -1' }} className="glass-card"><h2 style={{ color: 'white', textAlign: 'center', marginTop: '20%' }}>VIEW NOT IMPLEMENTED: {activeTab.toUpperCase()}</h2></div>;
        }
    };

    return (
        <div className="app-container" style={{
            gridTemplateColumns: `68px ${isLeftOpen ? '320px' : '0px'} 1fr ${isRightOpen ? '340px' : '0px'}`,
            gridTemplateRows: `48px 1fr ${bottomHeight}px`
        }}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <TopBar wsConnected={wsConnected} mobileConnected={mobileConnected} />
            {renderMainContent()}
        </div>
    );
}
