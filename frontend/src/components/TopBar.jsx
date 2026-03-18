import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Shield, ChevronDown, User, Settings, HelpCircle } from 'lucide-react';

const TopBar = ({ wsConnected, mobileConnected }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                <div className={`status-tag ${wsConnected ? 'tag-cyan' : 'tag-red'}`}>
                    <span className={`status-dot ${wsConnected ? 'pulse' : ''}`} style={{ background: wsConnected ? 'var(--accent-cyan)' : 'var(--accent-red)' }} />
                    {wsConnected ? 'SERVER ONLINE' : 'SERVER OFFLINE'}
                </div>
                <div className={`status-tag ${mobileConnected ? 'tag-cyan' : 'tag-red'}`}>
                    <span className={`status-dot ${mobileConnected ? 'pulse' : ''}`} style={{ background: mobileConnected ? 'var(--accent-cyan)' : 'var(--accent-red)' }} />
                    {mobileConnected ? 'FLEET CONNECTED' : 'UPLINK ERROR'}
                </div>
                <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', gap: '12px', position: 'relative' }} ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ 
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
                        gap: '6px',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                        OPTIONS <ChevronDown size={14} style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    
                    {isMenuOpen && (
                        <div className="glass-card" style={{
                            position: 'absolute',
                            top: '100%',
                            right: '32px',
                            marginTop: '8px',
                            width: '200px',
                            padding: '8px 0',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            borderRadius: '8px'
                        }}>
                            {[
                                { icon: User, label: 'Profile' },
                                { icon: Settings, label: 'Settings' },
                                { icon: HelpCircle, label: 'Help & Docs' }
                            ].map((item, i) => (
                                <button key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-bright)',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                onClick={() => setIsMenuOpen(false)}>
                                    <item.icon size={16} color="var(--text-muted)" />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-bright)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
