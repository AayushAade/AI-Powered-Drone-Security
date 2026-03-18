import React from 'react';
import { TriangleAlert, Radio, PlaneTakeoff, ShieldAlert } from 'lucide-react';

const AlertPanel = ({ alerts }) => {
    if (!alerts || alerts.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                    <Radio size={24} />
                </span>
                NO ACTIVE INCIDENTS IN SECTOR
            </div>
        );
    }

    return (
        <div style={{ padding: '0 20px 20px 20px', height: '100%', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 8px', fontWeight: '800' }}>INCIDENT ID</th>
                        <th style={{ padding: '12px 8px', fontWeight: '800' }}>TYPE</th>
                        <th style={{ padding: '12px 8px', fontWeight: '800' }}>PRIORITY</th>
                        <th style={{ padding: '12px 8px', fontWeight: '800' }}>STATUS</th>
                        <th style={{ padding: '12px 8px', fontWeight: '800', textAlign: 'right' }}>TIME</th>
                    </tr>
                </thead>
                <tbody>
                    {alerts.map((alert) => (
                        <tr key={alert.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="incident-row">
                            <td style={{ padding: '12px 8px', color: 'var(--accent-red)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TriangleAlert size={16} /> {alert.id.substring(0, 8)}
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-bright)' }}>
                                {alert.type.replace('_', ' ').toUpperCase()}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                                <span style={{ 
                                    padding: '2px 8px', 
                                    borderRadius: '2px', 
                                    background: alert.severity === 'critical' ? 'rgba(255, 77, 77, 0.2)' : 'rgba(255, 215, 0, 0.1)',
                                    color: alert.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-gold)',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                }}>
                                    {alert.severity.toUpperCase()}
                                </span>
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-dim)' }}>
                                {alert.status === 'drone_on_site' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}><ShieldAlert size={14} /> ON SCENE</span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><PlaneTakeoff size={14} /> EN ROUTE</span>
                                )}
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-muted)', textAlign: 'right' }}>
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
