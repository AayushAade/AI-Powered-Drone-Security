import React from 'react';
import { Camera, Radio } from 'lucide-react';

const VideoFeed = ({ frameData, mobileConnected }) => {
    const cctvChannels = [
        { id: 14, name: 'PLAZA WEST', active: true },
        { id: 12, name: 'MAIN GATE', active: false },
        { id: 15, name: 'NORTH PERIMETER', active: false },
        { id: 16, name: 'PARKING A3', active: false },
        { id: 17, name: 'LOADING DOCK', active: false },
        { id: 18, name: 'SERVICE ENTRY', active: false },
    ];

    return (
        <div style={{ padding: '0 12px 12px 12px', height: '100%', overflowY: 'auto' }}>
            <div className="panel-title" style={{ padding: '16px 0', border: 'none', background: 'transparent' }}>
                CCTV CHANNEL LOG
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cctvChannels.map((ch) => (
                    <div key={ch.id} style={{ 
                        borderRadius: '4px', 
                        overflow: 'hidden', 
                        border: ch.active ? '1px solid var(--accent-red)' : '1px solid var(--border)',
                        background: '#000',
                        cursor: 'pointer',
                        opacity: ch.active ? 1 : 0.6,
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{ position: 'relative' }}>
                            {ch.active && frameData ? (
                                <img src={frameData} alt="Feed" style={{ width: '100%', display: 'block' }} />
                            ) : (
                                <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0c10' }}>
                                    <Camera size={32} color="rgba(255,255,255,0.1)" />
                                </div>
                            )}
                            
                            <div style={{ 
                                position: 'absolute', top: '8px', left: '8px', 
                                background: 'rgba(0,0,0,0.7)', padding: '2px 6px', 
                                borderRadius: '2px', fontSize: '8px', fontWeight: '900',
                                color: 'white', letterSpacing: '0.5px',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                CH-{ch.id} | {ch.name}
                            </div>

                            {ch.active && (
                                <div style={{ 
                                    position: 'absolute', bottom: '8px', right: '8px', 
                                    background: 'var(--accent-red)', color: 'white', 
                                    padding: '2px 8px', borderRadius: '2px', 
                                    fontSize: '8px', fontWeight: '900',
                                    animation: 'pulse 1s infinite'
                                }}>
                                    LIVE
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {!mobileConnected && (
                <div className="glass-card" style={{ 
                    marginTop: '24px', textAlign: 'center', padding: '24px', 
                    borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)' 
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <Radio size={32} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '1px' }}>
                        WAITING FOR FLEET UPLINK...
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoFeed;
