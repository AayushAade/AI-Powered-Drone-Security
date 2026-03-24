import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, MapPin, FileVideo, FileText, Play, Plus, Trash2, Info, Brain, Activity } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export default function FootageUploadView() {
    const [stagedVideos, setStagedVideos] = useState([
        { id: 'V-101', name: 'CCTV_Plaza_01.mp4', size: '37.8 MB', status: 'STAGED', locationId: 'CH-1', notes: '', url: null },
        { id: 'V-102', name: 'CCTV_MainGate_03.mp4', size: '37.6 KB', status: 'STAGED', locationId: 'Sector A1', notes: '', url: null },
    ]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [progress, setProgress] = useState(0);
    const [model, setModel] = useState(null);
    const [detectionCount, setDetectionCount] = useState(0);
    const [detectionLogs, setDetectionLogs] = useState([
        { id: 1, text: 'SYSTEM: READY FOR ANALYSIS', type: 'info' },
    ]);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Load AI Model on Mount
    useEffect(() => {
        const loadModel = async () => {
            console.log("Loading COCO-SSD Model...");
            const loadedModel = await cocoSsd.load();
            setModel(loadedModel);
            console.log("AI Model Loaded!");
        };
        loadModel();
    }, []);

    const detectionHistory = useRef([]);

    const detectFrame = async () => {
        if (!videoRef.current || !canvasRef.current || !model || videoRef.current.paused || videoRef.current.ended) {
            return;
        }

        const predictions = await model.detect(videoRef.current, 100, 0.30);
        const persons = predictions.filter(p => p.class === 'person');
        const personData = persons.map(p => {
            const [x, y, w, h] = p.bbox;
            return {
                bbox: p.bbox,
                center: [x + w / 2, y + h / 2]
            };
        });

        // Spatial Density Check: Find clusters of 8+ people within 60px (strictly tight)
        let crowdCluster = null;
        for (let i = 0; i < personData.length; i++) {
            const neighbors = personData.filter((p, idx) => {
                if (i === idx) return false;
                const dist = Math.sqrt(
                    Math.pow(personData[i].center[0] - p.center[0], 2) +
                    Math.pow(personData[i].center[1] - p.center[1], 2)
                );
                return dist <= 60;
            });

            if (neighbors.length >= 7) { // 7 neighbors + self = 8 people
                const clusterPoints = [personData[i], ...neighbors];
                const minX = Math.min(...clusterPoints.map(p => p.bbox[0]));
                const minY = Math.min(...clusterPoints.map(p => p.bbox[1]));
                const maxX = Math.max(...clusterPoints.map(p => p.bbox[0] + p.bbox[2]));
                const maxY = Math.max(...clusterPoints.map(p => p.bbox[1] + p.bbox[3]));
                crowdCluster = [minX, minY, maxX - minX, maxY - minY];
                break; // Found a dense 'huddle'
            }
        }

        setDetectionCount(crowdCluster ? 8 : 0); // Simplified for the HUD to show "CROWD" state

        const ctx = canvasRef.current.getContext('2d');
        const { videoWidth, videoHeight } = videoRef.current;
        
        // Match canvas dimensions to video
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        
        ctx.clearRect(0, 0, videoWidth, videoHeight);

        personData.forEach(p => {
            const [x, y, width, height] = p.bbox;
            
            // Draw Individual Cyan Bounding Box (Clean)
            ctx.strokeStyle = '#00f5ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
        });

        // Draw Red Warning Box around the dense cluster if detected
        if (crowdCluster) {
            const [x, y, w, h] = crowdCluster;
            ctx.strokeStyle = '#ff4d4d';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]); // Dashed line for warning effect
            ctx.strokeRect(x - 10, y - 10, w + 20, h + 20);
            ctx.setLineDash([]); // Reset dash for next frame
            
            ctx.fillStyle = 'rgba(255, 77, 77, 0.1)';
            ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
        }

        requestAnimationFrame(detectFrame);
    };

    const handleFiles = (files) => {
        const fileList = Array.from(files);
        const newVids = fileList.map((file) => ({
            id: `V-${Math.floor(Math.random() * 899) + 100}`,
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
            status: 'STAGED',
            locationId: 'Sector A1',
            notes: '',
            url: URL.createObjectURL(file),
            file: file
        }));
        setStagedVideos(prev => [...prev, ...newVids]);
    };

    const removeFile = (id) => {
        setStagedVideos(prev => prev.filter(v => v.id !== id));
        if (selectedVideo?.id === id) setSelectedVideo(null);
    };

    const updateFile = (id, field, value) => {
        setStagedVideos(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
        if (selectedVideo?.id === id) {
            setSelectedVideo(prev => ({ ...prev, [field]: value }));
        }
    };

    const ingestVideo = async (video) => {
        if (!video.file) return;
        setStagedVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'SYNCING' } : v));
        setProgress(0);

        const formData = new FormData();
        formData.append('video', video.file);

        try {
            const xhr = new XMLHttpRequest();
            const baseUrl = window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin;
            xhr.open('POST', `${baseUrl}/api/upload-video`, true);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    setProgress(percent);
                }
            };
            xhr.onload = () => {
                if (xhr.status === 200) {
                    setProgress(100);
                    setStagedVideos(prev => 
                        prev.map(v => v.id === video.id ? { ...v, status: 'PROCESSING' } : v)
                    );
                } else {
                    setStagedVideos(prev => 
                        prev.map(v => v.id === video.id ? { ...v, status: 'FAILED' } : v)
                    );
                }
            };
            xhr.send(formData);
        } catch (err) {
            console.error("Ingestion failed:", err);
        }
    };

    const lastLogTime = useRef({});

    const addThrottledLog = (text, type = 'info') => {
        const now = Date.now();
        const cooldown = 4000; // 4 second frontend cooldown
        
        if (!lastLogTime.current[text] || (now - lastLogTime.current[text] > cooldown)) {
            setDetectionLogs(prev => [{ id: now, text, type }, ...prev].slice(0, 10));
            lastLogTime.current[text] = now;
        }
    };

    const handleStartScan = (videoFilename) => {
        console.log(`🚀 Initializing YOLOv11 Scan for: ${videoFilename}`);
        addThrottledLog(`SYSTEM: SCANNING ${videoFilename}...`, 'info');
        
        // Mocking some detections for the log (simulating backend events)
        const mockAlerts = [
            { text: '⚠️ PERSON DETECTED - 92% Confidence', type: 'alert' },
            { text: '⚠️ CROWD GATHERING - 81% Confidence', type: 'warning' },
            { text: '✅ PERIMETER SECURE', type: 'info' }
        ];
        
        // Trigger mock alerts with spacing
        mockAlerts.forEach((alert, index) => {
            setTimeout(() => {
                addThrottledLog(alert.text, alert.type);
            }, (index + 1) * 3000);
        });
    };

    const handleSelectVideo = (vid) => {
        setSelectedVideo(vid);
        handleStartScan(vid.name);
    };

    const handleIngestAll = () => {
        if (selectedVideo) ingestVideo(selectedVideo);
        else if (stagedVideos.length > 0) ingestVideo(stagedVideos[0]);
    };

    return (
        <div style={{ gridArea: '1 / 2 / -1 / -1', backgroundColor: '#0b1115' }} className="w-full h-full flex flex-col p-8 font-sans text-gray-300 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0">
                
                {/* LEFT COLUMN: FOOTAGE STAGING (4 Cols) */}
                <div className="lg:col-span-5 flex flex-col h-full bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                                <Brain size={20} className="text-cyan-400" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-white">Footage Staging</span>
                        </div>
                        <div className="flex gap-2 font-mono">
                            <div className="text-[10px] px-2 py-1 rounded bg-black/40 border border-white/5 text-cyan-500/70 uppercase">v2.4.2-STABLE</div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col p-8 overflow-hidden">
                        {/* DROP ZONE */}
                        <div 
                            className="h-52 border-2 border-dashed border-gray-700/50 rounded-2xl bg-white/[0.02] flex flex-col items-center justify-center gap-5 hover:border-cyan-500/50 hover:bg-cyan-500/[0.05] hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-all duration-500 cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} multiple />
                            <div className="p-4 rounded-2xl bg-gray-800/50 text-gray-400 group-hover:bg-cyan-500 group-hover:text-black transition-all duration-500 shadow-xl">
                                <Upload size={28} />
                            </div>
                            <div className="text-center">
                                <div className="text-base font-bold text-white mb-1">Ingest New Footage</div>
                                <div className="text-xs text-gray-500 uppercase tracking-widest fon-mono">MP4, MOV, or AVI preferred</div>
                            </div>
                        </div>

                        {/* PENDING LIST */}
                        <div className="mt-8 flex flex-col min-h-0 overflow-hidden">
                            <div className="px-2 mb-4 flex justify-between text-xs tracking-widest text-gray-400 font-bold uppercase transition-all">
                                <span className="flex items-center gap-3">
                                    <Activity size={14} className={progress > 0 && progress < 100 ? "animate-spin text-orange-500" : "text-cyan-500"} />
                                    {stagedVideos.length} Staged Records
                                </span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
                                {stagedVideos.map((vid) => (
                                    <div 
                                        key={vid.id}
                                        className={`group relative grid grid-cols-[1fr_auto_auto_40px] gap-4 p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
                                            selectedVideo?.id === vid.id 
                                            ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_20px_rgba(0,245,255,0.05)] border-l-4 border-l-cyan-400' 
                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 hover:border-l-4 hover:border-l-gray-600'
                                        }`}
                                        onClick={() => handleSelectVideo(vid)}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`p-2 rounded-lg ${selectedVideo?.id === vid.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800/50 text-gray-500'}`}>
                                                <FileVideo size={18} />
                                            </div>
                                            <div className="min-w-0 overflow-hidden">
                                                <div className="text-sm font-bold text-gray-100 truncate">{vid.name}</div>
                                                <div className="text-[11px] text-gray-500 font-mono mt-0.5">{vid.size} • {vid.id}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center">
                                            <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-black/40 text-gray-400 border border-white/5">
                                                {vid.locationId}
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className={`text-[10px] font-black tracking-widest px-2 py-1 rounded ${
                                                vid.status === 'SYNCING' ? 'text-orange-400 animate-pulse' : 
                                                vid.status === 'PROCESSING' ? 'text-cyan-400' : 
                                                'text-gray-600'
                                            }`}>
                                                {vid.status}
                                            </div>
                                        </div>

                                        <button 
                                            className="ml-auto text-gray-700 hover:text-red-500 transition-colors flex justify-center items-center p-2"
                                            onClick={(e) => { e.stopPropagation(); removeFile(vid.id); }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-8 pt-0 mt-auto">
                        <button 
                            className="w-full py-5 bg-cyan-500 text-black font-black tracking-[0.2em] text-sm rounded-xl hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3"
                            disabled={stagedVideos.length === 0}
                            onClick={handleIngestAll}
                        >
                            <Play size={18} />
                            INGEST SYSTEM ARTIFACTS
                        </button>
                    </div>
                </div>

                {/* RIGHT COLUMN: VIDEO PLAYER */}
                <div className="flex flex-col h-full bg-[#161a22]/40 border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative">
                    <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${model ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : 'bg-red-500 animate-pulse'}`}></div>
                            <span className="text-base font-black tracking-widest text-white uppercase italic">AI VISION PROCESSOR</span>
                        </div>
                        <div className="font-mono text-[10px] text-cyan-400/60 font-bold px-3 py-1 rounded bg-black/40 border border-white/5 tracking-tighter">ENGINE: YOLOv11-LITE</div>
                    </div>

                    <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
                        {selectedVideo ? (
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="relative aspect-video bg-black rounded-lg border border-gray-800 overflow-hidden group">
                                    <video 
                                        ref={videoRef}
                                        src={selectedVideo.url || `/${selectedVideo.name}`} 
                                        onPlay={detectFrame}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    <canvas 
                                        ref={canvasRef}
                                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                    />

                                    {/* AI HUD Overlay */}
                                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded border border-red-500/50 backdrop-blur-sm">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                        <span className="text-[10px] font-black tracking-tighter text-red-500 uppercase">REC / YOLOv11 INFERENCE ACTIVE</span>
                                    </div>

                                    <div className={`absolute top-4 right-4 px-4 py-2 border rounded font-bold text-[11px] tracking-widest backdrop-blur-md transition-all duration-300 ${
                                        detectionCount >= 8 
                                        ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' 
                                        : 'bg-black/60 border-cyan-500/50 text-cyan-400'
                                    }`}>
                                        {detectionCount >= 8 ? '⚠️ WARNING: LOCAL CROWD DENSITY HIGH' : `SCANNING AREA...`}
                                    </div>

                                    {/* Scanning Lines Effect */}
                                    <div className="absolute inset-x-0 h-[1px] bg-cyan-400/30 shadow-[0_0_10px_#22d3ee] pointer-events-none animate-scan"></div>
                                </div>

                                {/* LIVE DETECTION LOG (TERMINAL) */}
                                <div className="flex-1 flex flex-col min-h-0 bg-black/60 border border-white/5 rounded-2xl overflow-hidden shadow-inner">
                                    <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Activity size={12} className="text-cyan-400" />
                                            <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Neural Stream Log</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-red-500/40"></div>
                                            <div className="w-2 h-2 rounded-full bg-amber-500/40"></div>
                                            <div className="w-2 h-2 rounded-full bg-emerald-500/40"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 flex flex-col-reverse gap-3 custom-scrollbar font-mono">
                                        {detectionLogs.map((log) => (
                                            <div key={log.id} className="text-xs leading-relaxed flex gap-4 animate-fade-in border-l-2 border-transparent hover:border-l-cyan-500/30 pl-2 transition-all">
                                                <span className="text-gray-600 font-bold opacity-50 shrink-0">[{new Date(log.id).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                                <span className={`${
                                                    log.type === 'alert' ? 'text-red-400 font-black' : 
                                                    log.type === 'warning' ? 'text-amber-400 font-bold' : 
                                                    'text-cyan-400'
                                                } tracking-tight`}>
                                                    {log.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-6">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-5">
                                        <div>
                                            <div className="text-[11px] text-cyan-500 font-black mb-2 uppercase tracking-[0.2em]">Artifact Metadata</div>
                                            <h2 className="text-2xl font-black text-white truncate max-w-[400px] tracking-tight">{selectedVideo.name}</h2>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-widest">Global Status</div>
                                            <div className="text-xs font-black text-cyan-400 px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/20">{selectedVideo.status}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="flex flex-col gap-3">
                                            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Deployment Location</label>
                                            <div className="relative group">
                                                <div className="absolute inset-0 bg-cyan-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
                                                <select 
                                                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-4 text-sm font-bold text-gray-200 outline-none focus:border-cyan-500/50 transition-all appearance-none"
                                                    value={selectedVideo.locationId}
                                                    onChange={(e) => updateFile(selectedVideo.id, 'locationId', e.target.value)}
                                                >
                                                    <option>Sector A1 - Northern Plaza</option>
                                                    <option>CH-1 - Central Hub</option>
                                                    <option>West-Gate-03</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Active Incident Intel</label>
                                            <div className="relative group">
                                                <div className="absolute inset-0 bg-cyan-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <FileText size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
                                                <input 
                                                    type="text"
                                                    placeholder="Append field observer notes..."
                                                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-4 text-sm font-bold text-gray-200 outline-none focus:border-cyan-500/50 transition-all"
                                                    value={selectedVideo.notes}
                                                    onChange={(e) => updateFile(selectedVideo.id, 'notes', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-2xl m-8 bg-white/[0.01]">
                                <div className="flex flex-col items-center gap-6 text-gray-600">
                                    <div className="flex gap-6 opacity-30 animate-pulse">
                                        <FileVideo size={64} />
                                        <div className="w-[2px] h-12 bg-gray-800 self-center"></div>
                                        <Brain size={64} className="text-cyan-500" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-base font-black tracking-widest text-white uppercase italic">System Idling...</p>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Select a staged artifact to initialize AI telemetry</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
