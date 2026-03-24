import React from 'react';
import { Camera, Radio } from 'lucide-react';

const VideoFeed = ({ frameData, mobileConnected }) => {
    const cctvChannels = [
        { id: 14, name: 'PLAZA WEST', active: true, videoSrc: '/sample_cctv_1.mp4' },
        { id: 12, name: 'MAIN GATE', active: false, videoSrc: '/sample_cctv_2.mp4' },
        { id: 15, name: 'NORTH PERIMETER', active: false, videoSrc: '/sample_cctv_3.mp4' },
        { id: 16, name: 'PARKING A3', active: false, videoSrc: '/sample_cctv_4.mp4' },
        { id: 10, name: 'LOADING DOCK', active: false, videoSrc: '/sample_cctv_5.mp4' },
        { id: 11, name: 'SERVICE ENTRY', active: false, videoSrc: '/sample_cctv_6.mp4' },
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
                        opacity: 1, // Keep opacity high for video visibility
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{ position: 'relative', height: '100px' }}>
                            {ch.active && frameData ? (
                                <img src={frameData} alt="Feed" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                                <video 
                                    src={ch.videoSrc}
                                    autoPlay 
                                    loop 
                                    muted 
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                        // Fallback if video is missing
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            )}
                            
                            {/* Fallback Icon (initially hidden if video works) */}
                            {!ch.active && (
                                <div style={{ 
                                    display: 'none', // Hidden by default, shown by video onError
                                    height: '100%', alignItems: 'center', justifyContent: 'center', background: '#0a0c10' 
                                }}>
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
