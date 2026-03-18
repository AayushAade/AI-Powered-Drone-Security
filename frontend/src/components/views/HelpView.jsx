import React from 'react';
import { HelpCircle } from 'lucide-react';

const HelpView = () => {
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
            <HelpCircle size={64} color="var(--accent-cyan)" style={{ marginBottom: '24px', opacity: 0.8 }} />
            <h1 style={{ fontSize: '32px', marginBottom: '12px', letterSpacing: '2px' }}>SYSTEM DOCUMENTATION</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '600px', textAlign: 'center' }}>
                Standard Operating Procedures (SOPs), manual override testing, and drone network diagnostic manuals.
                (Documentation repository pending load).
            </p>
        </div>
    );
};

export default HelpView;