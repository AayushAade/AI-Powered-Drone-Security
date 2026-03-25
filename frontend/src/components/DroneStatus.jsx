import React from 'react';
import { Plane, Timer, Gauge, Battery, BatteryCharging, Mic, Video, Activity, CheckSquare, Square } from 'lucide-react';

// Inline SVG circular progress component
const CircularProgress = ({ value, max, color, size = 56, strokeWidth = 4, label, icon }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(value / max, 1);
    const offset = circumference - progress * circumference;
    
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg className="circular-progress" width={size} height={size}>
                <circle
                    className="circular-progress-track"
                    cx={size / 2} cy={size / 2} r={radius}
                    strokeWidth={strokeWidth}
                />
                <circle
                    className="circular-progress-bar"
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeWidth={strokeWidth}
                    style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
                />
            </svg>
            <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) rotate(0deg)',
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {icon}
            </div>
        </div>
    );
};

const DroneStatus = ({ telemetry, mode }) => {
    const status = telemetry?.status || 'IDLE';
    const battery = telemetry?.battery ?? 100;
    const speed = telemetry?.speed ?? 0;
    
    if (mode === 'analytics') {
        const analyticsOptions = ['Crowd Perimeter', 'Sneater', 'Plane', 'Corner'];
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', height: '100%' }}>
                <div className="panel-title" style={{ padding: 0, border: 'none', marginBottom: '8px', color: 'var(--accent-cyan)' }}>LIVE STREAM ANALYTICS</div>
                
                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(0, 245, 255, 0.12)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-bright)', letterSpacing: '0.5px' }}>DETECTION MODULES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {analyticsOptions.map((opt, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-dim)', transition: 'color 0.2s' }}>
                                <div style={{ color: i === 0 || i === 2 ? 'var(--accent-lime)' : 'var(--checkbox-inactive)' }}>
                                    {i === 0 || i === 2 ? <CheckSquare size={16} /> : <Square size={16} />}
                                </div>
                                {opt}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255, 77, 77, 0.12)', marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-bright)', letterSpacing: '0.5px' }}>PAYLOAD CONTROLS</div>
                    
                    <button style={{ 
                        width: '100%', padding: '12px', background: 'rgba(255, 77, 77, 0.06)', 
                        border: '1px solid rgba(255, 77, 77, 0.25)', color: 'var(--accent-red)', 
                        borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        marginBottom: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                        fontFamily: 'inherit', letterSpacing: '0.5px',
                        transition: 'all 0.25s ease'
                    }}>
                        <Video size={15} /> START RECORDING
                    </button>
                    
                    <button style={{ 
                        width: '100%', padding: '12px', background: 'rgba(0, 245, 255, 0.06)', 
                        border: '1px solid rgba(0, 245, 255, 0.25)', color: 'var(--accent-cyan)', 
                        borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                        fontFamily: 'inherit', letterSpacing: '0.5px',
                        transition: 'all 0.25s ease'
                    }}>
                        <Mic size={15} /> ACTIVATE SPEAKER
                    </button>
                </div>

                <div style={{ 
                    marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '14px 16px', 
                    background: 'rgba(34, 197, 94, 0.04)', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid rgba(34, 197, 94, 0.15)' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
                        <BatteryCharging size={15} /> UPLINK SECURE
                    </div>
                    <div style={{ color: 'var(--accent-green)', fontSize: '16px', fontWeight: '800' }}>
                        {Math.round(battery)}%
                    </div>
                </div>
            </div>
        );
    }

    const batteryColor = battery < 20 ? 'var(--accent-red)' : battery < 50 ? 'var(--accent-gold)' : 'var(--accent-cyan)';
    const speedMax = 80; // max speed for gauge

    const stats = [
        { 
            label: 'STATUS', 
            value: status === 'IDLE' ? 'READY' : status.toUpperCase(), 
            icon: <Plane size={18} />, 
            color: status === 'IDLE' ? 'var(--accent-lime)' : 'var(--accent-cyan)',
            type: 'text'
        },
        { 
            label: 'ETA', 
            value: telemetry?.eta != null ? `${telemetry.eta}s` : '0:00s', 
            icon: <Timer size={18} />, 
            color: 'var(--accent-cyan)',
            type: 'text'
        },
        { 
            label: 'SPEED', 
            value: `${Math.round(speed)} km/h`, 
            icon: <Gauge size={16} />, 
            color: 'var(--accent-cyan)',
            type: 'gauge',
            numericValue: speed,
            max: speedMax
        },
        { 
            label: 'BATTERY', 
            value: `${Math.round(battery)}%`, 
            icon: <Battery size={16} />, 
            color: batteryColor,
            type: 'gauge',
            numericValue: battery,
            max: 100
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', height: '100%' }}>
            <div className="panel-title" style={{ padding: 0, border: 'none', marginBottom: '4px' }}>DISPATCH DETAILS</div>
            
            {stats.map((stat, i) => (
                <div key={i} className="glass-card" style={{ 
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                }}>
                    {stat.type === 'gauge' ? (
                        <CircularProgress 
                            value={stat.numericValue} 
                            max={stat.max} 
                            color={stat.color} 
                            icon={stat.icon}
                            size={52}
                            strokeWidth={3.5}
                        />
                    ) : (
                        <div style={{ 
                            width: '48px', height: '48px', 
                            background: `${stat.color}0A`,
                            borderRadius: 'var(--radius-sm)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: stat.color,
                            border: `1px solid ${stat.color}20`,
                            flexShrink: 0
                        }}>
                            {stat.icon}
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '4px' }}>{stat.label}</div>
                        <div style={{ 
                            fontSize: '18px', fontWeight: '800', 
                            color: stat.value === 'READY' ? 'var(--accent-lime)' : 'var(--text-bright)',
                            letterSpacing: '-0.3px'
                        }}>
                            {stat.value}
                        </div>
                    </div>
                </div>
            ))}

            <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <div className="panel-title" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>DRONE FLEET STATUS</div>
                {[1, 2, 3].map(id => (
                    <div key={id} style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', 
                        padding: '12px 14px', 
                        background: 'var(--bg-fleet-row)', 
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        transition: 'all 0.2s ease'
                    }}>
                        <Plane size={16} color="var(--text-muted)" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)' }}>DRONE ALPHA {id}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>BASE STATION {id}</div>
                        </div>
                        <span className="status-tag tag-lime" style={{ fontSize: '8px', padding: '3px 8px' }}>IDLE</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DroneStatus;
