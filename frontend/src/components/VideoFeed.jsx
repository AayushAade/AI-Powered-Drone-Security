import { useRef, useEffect } from 'react';

export default function VideoFeed({ frameData, remoteStream, mobileConnected }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && remoteStream) {
            videoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <div>
            <div className="video-panel">
                {remoteStream ? (
                    <div className="relative w-full h-full">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="video-feed"
                        />
                        <div className="video-overlay">
                            <div className="video-badge">
                                <span className="live-dot" />
                                LIVE WEBRTC
                            </div>
                            <div className="video-badge">🚁 DRONE-1</div>
                        </div>
                    </div>
                ) : frameData ? (
                    <>
                        <img
                            src={frameData.startsWith('data:') ? frameData : `data:image/jpeg;base64,${frameData}`}
                            alt="Live drone feed"
                            className="video-feed"
                        />
                        <div className="video-overlay">
                            <div className="video-badge">
                                <span className="live-dot" />
                                LIVE
                            </div>
                            <div className="video-badge">🚁 DRONE-1</div>
                        </div>
                    </>
                ) : (
                    <div className="video-placeholder">
                        <div className="icon">{mobileConnected ? '📡' : '📷'}</div>
                        <div style={{ fontWeight: 600 }}>
                            {mobileConnected ? 'Drone connected — awaiting dispatch' : 'Awaiting drone connection...'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {mobileConnected
                                ? 'Camera will activate when incident is detected'
                                : 'Open the Drone App on your phone and tap Connect'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
