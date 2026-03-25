import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Shield, ChevronDown, User, Settings, HelpCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                    background: 'rgba(0, 245, 255, 0.08)', 
                    padding: '8px', 
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(0, 245, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Shield size={20} color="var(--accent-cyan)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h1 style={{ 
                        fontSize: '16px', 
                        color: 'var(--text-bright)', 
                        margin: 0,
                        fontWeight: 800,
                        letterSpacing: '-0.3px'
                    }}>
                        URBAN SAFETY AI
                        <span style={{ 
                            color: 'var(--accent-cyan)', 
                            fontWeight: 600, 
                            fontSize: '14px',
                            marginLeft: '8px',
                            opacity: 0.8
                        }}>
                            MONITORING
                        </span>
                    </h1>
                    <span style={{ 
                        fontSize: '10px', 
                        color: 'var(--text-muted)', 
                        letterSpacing: '1.5px',
                        fontWeight: 500
                    }}>
                        SYSTEM OPERATIONAL • PUNE SECTOR A1
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className={`status-tag ${wsConnected ? 'tag-cyan' : 'tag-red'}`}>
                    <span 
                        className={`status-dot ${wsConnected ? 'dot-pulse' : ''}`} 
                        style={{ background: wsConnected ? 'var(--accent-cyan)' : 'var(--accent-red)' }} 
                    />
                    {wsConnected ? 'SERVER ONLINE' : 'SERVER OFFLINE'}
                </div>
                <div className={`status-tag ${mobileConnected ? 'tag-cyan' : 'tag-red'}`}>
                    <span 
                        className={`status-dot ${mobileConnected ? 'dot-pulse' : ''}`} 
                        style={{ background: mobileConnected ? 'var(--accent-cyan)' : 'var(--accent-red)' }} 
                    />
                    {mobileConnected ? 'FLEET CONNECTED' : 'UPLINK ERROR'}
                </div>
                
                <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
                
                <div style={{ display: 'flex', gap: '8px', position: 'relative' }} ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ 
                        background: 'rgba(255,255,255,0.04)', 
                        border: '1px solid var(--border)', 
                        color: 'var(--text-dim)', 
                        padding: '7px 14px', 
                        borderRadius: 'var(--radius-full)', 
                        fontSize: '10px', 
                        fontWeight: '700', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.25s ease',
                        fontFamily: 'inherit',
                        letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--btn-subtle-bg)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                    }}>
                        OPTIONS <ChevronDown size={12} style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                    </button>
                    <ThemeToggle />
                    
                    {isMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            width: '200px',
                            padding: '6px',
                            zIndex: 1000,
                            background: 'var(--bg-dropdown)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-lg)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
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
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    fontFamily: 'inherit',
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                    e.currentTarget.style.color = 'var(--text-bright)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-dim)';
                                }}
                                onClick={() => setIsMenuOpen(false)}>
                                    <item.icon size={15} color="var(--text-muted)" />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <button style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-muted)', 
                        cursor: 'pointer', 
                        transition: 'color 0.2s',
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
