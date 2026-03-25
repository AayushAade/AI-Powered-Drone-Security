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
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cctvChannels.map((ch) => (
                    <div key={ch.id} className="cctv-card" style={{ 
                        borderColor: ch.active ? 'rgba(255, 77, 77, 0.3)' : undefined,
                        boxShadow: ch.active ? '0 0 16px rgba(255, 77, 77, 0.1)' : undefined
                    }}>
                        <div style={{ position: 'relative', height: '100px' }}>
                            {ch.active && frameData ? (
                                <img src={frameData} alt="Feed" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }} />
                            ) : (
                                <video 
                                    src={ch.videoSrc}
                                    autoPlay 
                                    loop 
                                    muted 
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            )}
                            
                            {!ch.active && (
                                <div style={{ 
                                    display: 'none',
                                    height: '100%', alignItems: 'center', justifyContent: 'center', 
                                    background: 'var(--bg-cctv-fallback)' 
                                }}>
                                    <Camera size={28} color="var(--camera-fallback-color)" />
                                </div>
                            )}
                            
                            {/* Channel label */}
                            <div style={{ 
                                position: 'absolute', top: '8px', left: '8px', 
                                background: 'var(--bg-cctv-label)', 
                                backdropFilter: 'blur(8px)',
                                padding: '3px 8px', 
                                borderRadius: 'var(--radius-sm)', 
                                fontSize: '8px', fontWeight: '700',
                                color: 'var(--text-bright)', letterSpacing: '0.5px',
                                border: '1px solid var(--border-cctv-label)'
                            }}>
                                CH-{ch.id} • {ch.name}
                            </div>

                            {/* LIVE badge with pulse */}
                            {ch.active && (
                                <div className="live-badge" style={{ 
                                    position: 'absolute', bottom: '8px', right: '8px', 
                                    background: 'var(--accent-red)', color: 'white', 
                                    padding: '3px 10px', borderRadius: 'var(--radius-full)', 
                                    fontSize: '8px', fontWeight: '800',
                                    letterSpacing: '1px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <span style={{ 
                                        width: '5px', height: '5px', 
                                        borderRadius: '50%', 
                                        background: 'white',
                                        display: 'inline-block'
                                    }} />
                                    LIVE
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {!mobileConnected && (
                <div className="glass-card" style={{ 
                    marginTop: '20px', textAlign: 'center', padding: '24px', 
                    borderStyle: 'dashed', borderColor: 'var(--border-subtle)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <Radio size={28} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1.5px' }}>
                        WAITING FOR FLEET UPLINK...
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoFeed;
