import React from 'react';
import { LogOut, Shield, ChevronDown } from 'lucide-react';

const TopBar = ({ wsConnected, mobileConnected }) => {
    return (
        <header className="main-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(0, 245, 255, 0.1)', padding: '8px', borderRadius: '4px' }}>
                    <Shield size={20} color="var(--accent-cyan)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ fontSize: '18px', color: 'var(--text-bright)', margin: 0 }}>URBAN SAFETY AI - MONITORING</h1>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>SYSTEM OPERATIONAL • PUNE SECTOR A1</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div className="status-tag tag-cyan">
                    <span className={`status-dot ${wsConnected ? 'pulse' : ''}`} style={{ background: 'var(--accent-cyan)' }} />
                    SERVER ONLINE
                </div>
                <div className="status-tag tag-red">
                    <span className={`status-dot ${mobileConnected ? 'pulse' : ''}`} style={{ background: 'var(--accent-red)' }} />
                    FLEET CONNECTED
                </div>
                <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid var(--border)', 
                        color: 'white', 
                        padding: '6px 12px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        OPTIONS <ChevronDown size={14} />
                    </button>
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
