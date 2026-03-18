import React from 'react';
import { ClipboardList } from 'lucide-react';

const incidentData = [
    { id: 'INC-2024-089', timestamp: '10:42:05', type: 'Crowd Gathering', location: 'Plaza West', status: 'Resolved' },
    { id: 'INC-2024-090', timestamp: '11:15:22', type: 'Unauthorized Entry', location: 'Loading Dock', status: 'Resolved' },
    { id: 'INC-2024-091', timestamp: '12:05:10', type: 'Perimeter Breach', location: 'North Fence', status: 'Pending' },
    { id: 'INC-2024-092', timestamp: '13:30:45', type: 'Suspicious Vehicle', location: 'Parking A3', status: 'Resolved' },
    { id: 'INC-2024-093', timestamp: '14:22:18', type: 'Crowd Gathering', location: 'Main Gate', status: 'Active' },
    { id: 'INC-2024-094', timestamp: '15:10:02', type: 'Fire Detected', location: 'Sector B', status: 'Pending' }
];

const LogsView = () => {
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
                <ClipboardList size={40} color="var(--accent-cyan)" />
                <div>
                    <h1 style={{ fontSize: '28px', margin: 0, letterSpacing: '2px' }}>INCIDENT LOGS & REPORTS</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                        Historical database of detected threats, system alerts, and overall operational events.
                    </p>
                </div>
            </div>

            <div className="glass-card" style={{ flex: 1, padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                            <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 'bold' }}>INCIDENT ID</th>
                            <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 'bold' }}>TIMESTAMP</th>
                            <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 'bold' }}>TYPE</th>
                            <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 'bold' }}>LOCATION</th>
                            <th style={{ padding: '16px 20px', color: 'var(--text-dim)', fontWeight: 'bold' }}>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {incidentData.map((incident, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{incident.id}</td>
                                <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{incident.timestamp}</td>
                                <td style={{ padding: '16px 20px' }}>{incident.type}</td>
                                <td style={{ padding: '16px 20px', color: 'var(--text-bright)' }}>{incident.location}</td>
                                <td style={{ padding: '16px 20px' }}>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        background: incident.status === 'Resolved' ? 'rgba(0, 255, 100, 0.1)' : 
                                                    incident.status === 'Active' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(255, 215, 0, 0.1)',
                                        color: incident.status === 'Resolved' ? '#00ff66' : 
                                               incident.status === 'Active' ? 'var(--accent-red)' : 'var(--accent-gold)'
                                    }}>
                                        {incident.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LogsView;