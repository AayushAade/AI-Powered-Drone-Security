import React from 'react';

const DroneStatus = ({ telemetry }) => {
    const status = telemetry?.status || 'IDLE';
    const battery = telemetry?.battery ?? 100;
    
    const stats = [
        { label: 'STATUS', value: status === 'IDLE' ? 'READY' : status.toUpperCase(), icon: '🚁', color: 'var(--accent-cyan)' },
        { label: 'ETA', value: telemetry?.eta != null ? `${telemetry.eta}s` : '0:00s', icon: '⏱️', color: 'var(--accent-cyan)' },
        { label: 'SPEED', value: telemetry?.speed ? `${Math.round(telemetry.speed)} km/h` : '0 km/h', icon: '🚀', color: 'var(--accent-cyan)' },
        { label: 'BATTERY', value: `${Math.round(battery)}%`, icon: '🔋', color: battery < 20 ? 'var(--accent-red)' : 'var(--accent-cyan)' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
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
                        <span style={{ fontSize: '18px' }}>🚁</span>
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
