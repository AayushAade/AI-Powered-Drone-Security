import React from 'react';
import { TriangleAlert, Radio, PlaneTakeoff, ShieldAlert } from 'lucide-react';

const AlertPanel = ({ alerts }) => {
    if (!alerts || alerts.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', opacity: 0.5 }}>
                    <Radio size={24} />
                </span>
                <span style={{ letterSpacing: '1px', fontWeight: 600 }}>NO ACTIVE INCIDENTS IN SECTOR</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '0 20px 20px 20px', height: '100%', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 8px', fontWeight: '700', fontSize: '10px', letterSpacing: '1px' }}>INCIDENT ID</th>
                        <th style={{ padding: '12px 8px', fontWeight: '700', fontSize: '10px', letterSpacing: '1px' }}>TYPE</th>
                        <th style={{ padding: '12px 8px', fontWeight: '700', fontSize: '10px', letterSpacing: '1px' }}>PRIORITY</th>
                        <th style={{ padding: '12px 8px', fontWeight: '700', fontSize: '10px', letterSpacing: '1px' }}>STATUS</th>
                        <th style={{ padding: '12px 8px', fontWeight: '700', fontSize: '10px', letterSpacing: '1px', textAlign: 'right' }}>TIME</th>
                    </tr>
                </thead>
                <tbody>
                    {alerts.map((alert) => (
                        <tr key={alert.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="incident-row">
                            <td style={{ padding: '12px 8px', color: 'var(--accent-red)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TriangleAlert size={14} /> {alert.id.substring(0, 8)}
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-bright)', fontWeight: 500 }}>
                                {alert.type.replace('_', ' ').toUpperCase()}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                                <span style={{ 
                                    padding: '3px 10px', 
                                    borderRadius: 'var(--radius-full)', 
                                    background: alert.severity === 'critical' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(255, 215, 0, 0.06)',
                                    color: alert.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-gold)',
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    border: `1px solid ${alert.severity === 'critical' ? 'rgba(255, 77, 77, 0.2)' : 'rgba(255, 215, 0, 0.15)'}`,
                                    letterSpacing: '0.5px'
                                }}>
                                    {alert.severity.toUpperCase()}
                                </span>
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-dim)' }}>
                                {alert.status === 'drone_on_site' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-lime)', fontWeight: 600, fontSize: '11px' }}>
                                        <ShieldAlert size={13} /> ON SCENE
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500, fontSize: '11px' }}>
                                        <PlaneTakeoff size={13} /> EN ROUTE
                                    </span>
                                )}
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right', fontSize: '11px', fontWeight: 500 }}>
                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AlertPanel;
