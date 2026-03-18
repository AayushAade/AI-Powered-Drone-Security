import React from 'react';
import { Target, Activity, ShieldCheck, Camera, Radio } from 'lucide-react';

const mockStats = [
    { label: 'Total Scans', value: '14,302', icon: Camera, color: 'var(--accent-cyan)' },
    { label: 'Threats Avoided', value: '87', icon: ShieldCheck, color: '#00ff66' },
    { label: 'Active Signals', value: '12', icon: Radio, color: 'var(--accent-cyan)' },
    { label: 'System Health', value: '99.8%', icon: Activity, color: '#00ff66' }
];

const AnalyticsView = () => {
    return (
        <div style={{
            gridArea: '1 / 2 / -1 / -1', // Span the rest of the app container except sidebar
            background: 'var(--bg-deep)',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
            height: '100%',
            color: 'var(--text-bright)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
                <Target size={40} color="var(--accent-red)" />
                <div>
                    <h1 style={{ fontSize: '28px', margin: 0, letterSpacing: '2px' }}>AI THREAT ANALYTICS</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Real-time visualization of operational efficiency and threat metrics.
                    </p>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '24px',
                marginBottom: '40px'
            }}>
                {mockStats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-dim)', fontSize: '12px', letterSpacing: '1px' }}>{stat.label.toUpperCase()}</span>
                                <Icon size={20} color={stat.color} />
                            </div>
                            <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-bright)' }}>{stat.value}</span>
                        </div>
                    );
                })}
            </div>

            <h2 style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '1px' }}>HIGH-RISK ZONES</h2>
            <div className="glass-card" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[{ zone: 'Sector Alpha', riskLevel: '85%' }, { zone: 'Perimeter West', riskLevel: '62%' }, { zone: 'Loading Dock C', riskLevel: '45%' }].map((zone, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 'bold' }}>{zone.zone}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '200px', height: '8px', background: 'var(--bg-deep)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ 
                                    width: zone.riskLevel, 
                                    height: '100%', 
                                    background: parseInt(zone.riskLevel) > 80 ? 'var(--accent-red)' : 'var(--accent-gold)' 
                                }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-dim)', width: '30px' }}>{zone.riskLevel}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnalyticsView;