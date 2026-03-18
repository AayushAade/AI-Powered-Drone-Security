import React from 'react';
import { Network } from 'lucide-react';

const FleetView = () => {
    return (
        <div style={{
            gridArea: '1 / 2 / -1 / -1', // Span the rest of the app container except sidebar
            background: 'var(--bg-deep)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-bright)'
        }}>
            <Network size={64} color="var(--accent-cyan)" style={{ marginBottom: '24px', opacity: 0.8 }} />
            <h1 style={{ fontSize: '32px', marginBottom: '12px', letterSpacing: '2px' }}>FLEET MANAGEMENT</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '600px', textAlign: 'center' }}>
                Active drone hardware status, simulated battery degradation parameters, and global base station tracking.
                (Fleet matrix rendering initialization pending).
            </p>
        </div>
    );
};

export default FleetView;