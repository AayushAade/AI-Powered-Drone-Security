import React from 'react';
import { Network, Battery, Crosshair, Wifi, Zap, Activity } from 'lucide-react';

const drones = [
    { id: 'DRONE-01', name: 'Alpha-X1', status: 'ACTIVE', battery: 85, location: 'Plaza West', signal: 'Excellent', mission: 'Crowd Monitoring' },
    { id: 'DRONE-02', name: 'Bravo-V4', status: 'CHARGING', battery: 32, location: 'Base Station A', signal: 'N/A', mission: 'Standby' },
    { id: 'DRONE-03', name: 'Gamma-Z8', status: 'OFFLINE', battery: 0, location: 'Maintenance Hub', signal: 'None', mission: 'Repair' },
    { id: 'DRONE-04', name: 'Delta-S2', status: 'ACTIVE', battery: 67, location: 'Sector B', signal: 'Good', mission: 'Perimeter Sweep' },
    { id: 'DRONE-05', name: 'Epsilon-R5', status: 'EMERGENCY', battery: 12, location: 'North Gate', signal: 'Critical', mission: 'Incident Response' },
    { id: 'DRONE-06', name: 'Zeta-Q9', status: 'ACTIVE', battery: 98, location: 'Parking A3', signal: 'Excellent', mission: 'Routine Patrol' },
];

const FleetView = ({ drones: liveDrones }) => {
    // Fallback to dummy data if no live drones are connected yet
    const displayDrones = liveDrones && liveDrones.length > 0 ? liveDrones : [
        { id: 'DRONE-01', name: 'Alpha-X1', status: 'ACTIVE', battery: 85, location: 'Plaza West', signal: 'Excellent', mission: 'Crowd Monitoring' },
        { id: 'DRONE-02', name: 'Bravo-V4', status: 'CHARGING', battery: 32, location: 'Base Station A', signal: 'N/A', mission: 'Standby' },
    ];
    return (
        <div style={{
            gridArea: '2 / 2 / -1 / -1',
            background: 'var(--bg-deep)',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
            height: '100%',
            color: 'var(--text-bright)',
            overflowY: 'auto'
        }}>
            <style>{`
                .btn-diagnostics {
                    flex: 1;
                    padding: 8px;
                    background: var(--btn-subtle-bg);
                    border: 1px solid var(--border);
                    color: var(--text-bright);
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .btn-diagnostics:hover {
                    background: var(--btn-subtle-hover);
                    border-color: var(--border-active);
                }
                .btn-remote {
                    flex: 1;
                    padding: 8px;
                    background: var(--accent-cyan);
                    border: 1px solid var(--accent-cyan);
                    color: #020617; /* Very dark blue/black for max contrast */
                    font-weight: 800;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .btn-remote:hover {
                    filter: brightness(1.1);
                    box-shadow: var(--shadow-glow-cyan);
                }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
                <Network size={40} color="var(--accent-cyan)" />
                <div>
                    <h1 style={{ fontSize: '28px', margin: 0, letterSpacing: '2px' }}>FLEET MANAGEMENT</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Real-time hardware monitoring, battery analytics, and deployment status for all units.
                    </p>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px'
            }}>
                {displayDrones.map((drone) => (
                    <div key={drone.id} className="glass-card" style={{ 
                        padding: '24px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '16px',
                        borderLeft: `4px solid ${
                            drone.status === 'ACTIVE' || drone.status === 'DISPATCHED' || drone.status === 'ON_SCENE' ? 'var(--accent-cyan)' : 
                            drone.status === 'EMERGENCY' ? 'var(--accent-red)' : 
                            drone.status === 'RETURNING' ? 'var(--accent-gold)' : 'var(--text-muted)'
                        }`
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', margin: 0 }}>{drone.name || drone.id}</h3>
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '1px' }}>{drone.id}</span>
                            </div>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                background: (drone.status === 'ACTIVE' || drone.status === 'ON_SCENE') ? 'var(--accent-cyan-glow)' : 
                                            drone.status === 'EMERGENCY' ? 'var(--accent-red-glow)' : 'var(--btn-subtle-bg)',
                                color: (drone.status === 'ACTIVE' || drone.status === 'ON_SCENE') ? 'var(--accent-cyan)' : 
                                       drone.status === 'EMERGENCY' ? 'var(--accent-red)' : 'var(--text-dim)',
                                border: '1px solid currentColor'
                            }}>
                                {drone.status}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Battery size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '13px' }}>{Math.round(drone.battery)}%</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Wifi size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '13px' }}>{drone.signal || 'Strong'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Crosshair size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '13px' }}>{drone.location || `${drone.lat.toFixed(4)}, ${drone.lng.toFixed(4)}`}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Activity size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '13px' }}>{drone.mission || drone.status}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                            <button className="btn-diagnostics">DIAGNOSTICS</button>
                            <button className="btn-remote">REMOTE LINK</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FleetView;