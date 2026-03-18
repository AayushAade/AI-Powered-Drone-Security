import React from 'react';
import { Plane, Timer, Gauge, Battery, BatteryCharging, Mic, Video, Activity, CheckSquare, Square } from 'lucide-react';

const DroneStatus = ({ telemetry, mode }) => {
    const status = telemetry?.status || 'IDLE';
    const battery = telemetry?.battery ?? 100;
    
    if (mode === 'analytics') {
        const analyticsOptions = ['Crowd Perimeter', 'Sneater', 'Plane', 'Corner'];
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', height: '100%' }}>
                <div className="panel-title" style={{ padding: 0, border: 'none', marginBottom: '8px', color: 'var(--accent-cyan)' }}>LIVE STREAM ANALYTICS</div>
                
                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(0, 245, 255, 0.2)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-bright)' }}>DETECTION MODULES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {analyticsOptions.map((opt, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-dim)', transition: 'color 0.2s' }}>
                                <div style={{ color: i === 0 || i === 2 ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)' }}>
                                    {i === 0 || i === 2 ? <CheckSquare size={16} /> : <Square size={16} />}
                                </div>
                                {opt}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255, 77, 77, 0.2)', marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-bright)' }}>PAYLOAD CONTROLS</div>
                    
                    <button style={{ 
                        width: '100%', padding: '12px', background: 'rgba(255, 77, 77, 0.1)', 
                        border: '1px solid var(--accent-red)', color: 'var(--accent-red)', 
                        borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        marginBottom: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                    }}>
                        <Video size={16} /> START RECORDING
                    </button>
                    
                    <button style={{ 
                        width: '100%', padding: '12px', background: 'rgba(0, 245, 255, 0.1)', 
                        border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', 
                        borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                    }}>
                        <Mic size={16} /> ACTIVATE SPEAKER
                    </button>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,255,0,0.05)', borderRadius: '4px', border: '1px solid rgba(0,255,0,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ff00', fontSize: '12px', fontWeight: 'bold' }}>
                        <BatteryCharging size={16} /> UPLINK SECURE
                    </div>
                    <div style={{ color: '#00ff00', fontSize: '16px', fontWeight: '900' }}>
                        {Math.round(battery)}%
                    </div>
                </div>
            </div>
        );
    }

    const stats = [
        { label: 'STATUS', value: status === 'IDLE' ? 'READY' : status.toUpperCase(), icon: <Plane size={24} />, color: 'var(--accent-cyan)' },
        { label: 'ETA', value: telemetry?.eta != null ? `${telemetry.eta}s` : '0:00s', icon: <Timer size={24} />, color: 'var(--accent-cyan)' },
        { label: 'SPEED', value: telemetry?.speed ? `${Math.round(telemetry.speed)} km/h` : '0 km/h', icon: <Gauge size={24} />, color: 'var(--accent-cyan)' },
        { label: 'BATTERY', value: `${Math.round(battery)}%`, icon: <Battery size={24} />, color: battery < 20 ? 'var(--accent-red)' : 'var(--accent-cyan)' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', height: '100%' }}>
            <div className="panel-title" style={{ padding: 0, border: 'none', marginBottom: '8px' }}>DISPATCH DETAILS</div>
            
            {stats.map((stat, i) => (
                <div key={i} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px' }}>
                    <div style={{ 
                        width: '48px', height: '48px', 
                        background: 'rgba(0, 245, 255, 0.05)', 
                        borderRadius: '8px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '24px',
                        color: stat.color,
                        border: `1px solid ${stat.color}33`
                    }}>
                        {stat.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '1px' }}>{stat.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: stat.value === 'READY' ? 'var(--accent-cyan)' : 'white' }}>{stat.value}</div>
                    </div>
                </div>
            ))}

            <div style={{ marginTop: 'auto', padding: '20px 0' }}>
                <div className="panel-title" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>DRONE FLEET STATUS</div>
                {[1, 2, 3].map(id => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <Plane size={20} color="var(--text-muted)" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>DRONE ALPHA {id}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>BASE STATION {id}</div>
                        </div>
                        <span className="status-tag tag-cyan" style={{ fontSize: '8px' }}>IDLE</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DroneStatus;
