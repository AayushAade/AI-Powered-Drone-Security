import React, { useRef, useState, useEffect } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { useSocket } from '../../hooks/useSocket';

export default function MobileDroneView() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [personCount, setPersonCount] = useState(0);
    const requestRef = useRef(null);
    
    // Connect to our Socket.io backend
    const { socket, isConnected, emitEvent } = useSocket();

    // The vars specifically requested for crowd detection
    const crowdStartTime = useRef(null);
    const lastAlertTime = useRef(0);

    // Load COCO-SSD on mount
    useEffect(() => {
        cocoSsd.load().then(loadedModel => {
            setModel(loadedModel);
        });
        
        return () => {
             if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } // Access rear camera on mobile
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    setIsBroadcasting(true);
                    detectFrame(); // Kick off detection loop
                };
            }
        } catch (e) {
            console.error("Camera access failed", e);
            alert("Could not access camera. Please allow permissions.");
        }
    };

    const stopCamera = () => {
         if (requestRef.current) cancelAnimationFrame(requestRef.current);
         if (videoRef.current && videoRef.current.srcObject) {
             videoRef.current.srcObject.getTracks().forEach(t => t.stop());
             videoRef.current.srcObject = null;
         }
         setIsBroadcasting(false);
         setPersonCount(0);
         crowdStartTime.current = null;
         
         if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
         }
    };

    const detectFrame = async () => {
        if (!model || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Sync canvas size to match the scaled video element
        canvas.width = video.clientWidth || video.videoWidth;
        canvas.height = video.clientHeight || video.videoHeight;
        
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        // Run object detection
        const predictions = await model.detect(video);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Filter Predictions: Create a variable called personCount
        const currentPersonCount = predictions.filter(p => p.class === 'person' && p.score > 0.5).length;
        
        // Update state to show the counter on screen
        setPersonCount(currentPersonCount);

        // Draw bounding boxes around the detected people
        predictions.forEach(prediction => {
             if (prediction.class === 'person' && prediction.score > 0.5) {
                 const [x, y, width, height] = prediction.bbox;
                 
                 ctx.strokeStyle = '#FF3B30';
                 ctx.lineWidth = 3;
                 ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);
                 
                 // Draw label background
                 ctx.fillStyle = 'rgba(255, 59, 48, 0.8)';
                 ctx.fillRect(x * scaleX, (y * scaleY) - 20, 100, 20);
                 
                 // Draw label text
                 ctx.fillStyle = '#FFFFFF';
                 ctx.font = '14px monospace';
                 ctx.fontWeight = 'bold';
                 ctx.fillText(`PERSON ${Math.round(prediction.score * 100)}%`, x * scaleX + 4, (y * scaleY) - 5);
             }
        });
        
        const now = Date.now();
        
        // --- CROWD GATHERING LOGIC ---
        // IF personCount >= 5:
        if (currentPersonCount >= 5) {
            // Check if crowdStartTime is null
            if (crowdStartTime.current === null) {
                crowdStartTime.current = now;
            } else {
                // If it is NOT null, calculate the elapsed time
                const elapsed = now - crowdStartTime.current;
                
                // If elapsed > 3000ms, trigger alert
                if (elapsed > 3000) {
                    
                    // 10-second cooldown to avoid spamming the server
                    if (now - lastAlertTime.current > 10000) {
                        
                        console.warn("🚨 CROWD GATHERING DETECTED! Emitting alert...");
                        
                        emitEvent('drone_alert', {
                            id: Math.random().toString(36).substr(2, 9),
                            type: 'CROWD_GATHERING',
                            location: 'Sector A1 - Mobile Drone',
                            severity: 'HIGH',
                            timestamp: new Date().toISOString()
                        });
                        
                        lastAlertTime.current = now;
                    }
                    
                    // Reset the start time so it evaluates again
                    crowdStartTime.current = null;
                }
            }
        } else {
            // IF personCount < 5: Reset crowdStartTime.current to null
            crowdStartTime.current = null;
        }

        requestRef.current = requestAnimationFrame(detectFrame);
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#000', overflow: 'hidden' }}>
            {/* UI Feedback Overlay */}
            <div style={{ 
                position: 'absolute', 
                top: 20, 
                left: 20, 
                zIndex: 10, 
                background: 'rgba(0,0,0,0.7)', 
                color: '#fff', 
                padding: '12px 16px', 
                borderRadius: '8px', 
                fontFamily: 'monospace',
                border: '1px solid #333'
            }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f0' }}>📱 Mobile Drone AI</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '8px', fontSize: '14px' }}>
                    <span>CCTV: {isBroadcasting ? <span style={{color: '#f00'}}>LIVE</span> : 'OFF'}</span>
                    <span>Link: {isConnected ? <span style={{color: '#0f0'}}>Up</span> : <span style={{color: '#f00'}}>Down</span>}</span>
                </div>
                
                {/* Text Counter in the top corner */}
                <div style={{ 
                    padding: '8px',
                    textAlign: 'center',
                    background: personCount >= 5 ? '#FF3B30' : '#222', 
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: '16px'
                }}>
                    🧍 PERSON COUNT: {personCount}
                </div>
                
                {!model && <div style={{ color: '#ff0', marginTop: '8px', fontSize: '12px' }}>Loading AI Model...</div>}
                {crowdStartTime.current && personCount >= 5 && (
                    <div style={{ color: '#ff0', marginTop: '8px', fontSize: '12px', textAlign: 'center' }}>
                        ⚠️ Analyzing Group...
                    </div>
                )}
            </div>
            
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#111' }} 
            />
            {/* Canvas for UI Bounding Boxes */}
            <canvas 
                ref={canvasRef} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} 
            />
            
            {/* Controls */}
            <div style={{ position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', zIndex: 10 }}>
                <button 
                    onClick={isBroadcasting ? stopCamera : startCamera}
                    disabled={!model}
                    style={{
                        background: isBroadcasting ? '#FF3B30' : '#34C759',
                        color: 'white',
                        padding: '16px 32px',
                        border: 'none',
                        borderRadius: '30px',
                        cursor: model ? 'pointer' : 'not-allowed',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                >
                    {isBroadcasting ? 'STOP PATROL' : (model ? '▶ START PATROL' : 'LOADING AI...')}
                </button>
            </div>
        </div>
    );
}
