import React from 'react';
import { HelpCircle, Book, Shield, Zap, Info, ArrowUpRight } from 'lucide-react';

const sections = [
    {
        title: 'Dashboard Overview',
        icon: Info,
        items: [
            'Real-time Map tracking of all active units.',
            'Live Video Feed with AI object detection overlays.',
            'Telemetry OSD showing altitude, speed, and battery.',
        ]
    },
    {
        title: 'Ingesting Footage',
        icon: Zap,
        items: [
            'Drag and drop raw footage into the Upload Hub.',
            'Automatic data sync and integrity verification.',
            'Real-time processing queue for multiple sources.',
        ]
    },
    {
        title: 'Threat Response',
        icon: Shield,
        items: [
            'Automated alert generation for perimeter breaches.',
            'Crowd size estimation and anomaly detection.',
            'One-click remote link for manual drone override.',
        ]
    },
    {
        title: 'Fleet Maintenance',
        icon: Book,
        items: [
            'Monitoring hardware health and battery cycles.',
            'Base station connectivity glass-card reports.',
            'Scheduled maintenance logs and repair tracking.',
        ]
    }
];

const HelpView = () => {
    return (
        <div style={{
            gridArea: '1 / 2 / -1 / -1',
            background: 'var(--bg-deep)',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
            height: '100%',
            color: 'var(--text-bright)',
            overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
                <HelpCircle size={40} color="var(--accent-cyan)" />
                <div>
                    <h1 style={{ fontSize: '28px', margin: 0, letterSpacing: '2px' }}>SYSTEM DOCUMENTATION</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        A comprehensive guide to operating the AI-Powered Drone Security & Response System.
                    </p>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '32px'
            }}>
                {sections.map((section, i) => {
                    const Icon = section.icon;
                    return (
                        <div key={i} className="glass-card" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                <div style={{ 
                                    width: '48px', 
                                    height: '48px', 
                                    borderRadius: '12px', 
                                    background: 'rgba(0, 245, 255, 0.1)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    color: 'var(--accent-cyan)',
                                    border: '1px solid var(--accent-cyan-glow)'
                                }}>
                                    <Icon size={24} />
                                </div>
                                <h2 style={{ fontSize: '20px', margin: 0 }}>{section.title}</h2>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {section.items.map((item, j) => (
                                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: 'var(--text-dim)', fontSize: '14px', lineHeight: '1.5' }}>
                                        <div style={{ marginTop: '6px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)', flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                                <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
                                    LEARN MORE <ArrowUpRight size={14} />
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="glass-card" style={{ marginTop: '40px', padding: '32px', textAlign: 'center', background: 'rgba(0, 245, 255, 0.05)', borderColor: 'var(--accent-cyan-glow)' }}>
                <h3 style={{ marginBottom: '8px' }}>Need immediate assistance?</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Our technical support team is available 24/7 for critical system failures.</p>
                <button style={{ 
                    padding: '12px 32px', 
                    background: 'var(--accent-cyan)', 
                    color: 'black', 
                    border: 'none', 
                    borderRadius: '4px', 
                    fontWeight: '800', 
                    letterSpacing: '1px',
                    cursor: 'pointer'
                }}>CONTACT COMMAND CENTER</button>
            </div>
        </div>
    );
};

export default HelpView;