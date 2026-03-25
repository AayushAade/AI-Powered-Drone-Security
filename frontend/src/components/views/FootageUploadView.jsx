import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, MapPin, FileVideo, FileText, Play, Plus, Trash2, Info, Brain, Activity } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { io } from 'socket.io-client';

export default function FootageUploadView() {
    const [stagedVideos, setStagedVideos] = useState([
        { id: 'V-101', name: 'CCTV_Plaza_01.mp4', size: '37.8 MB', status: 'STAGED', locationId: 'CH-1', notes: '', url: null },
        { id: 'V-102', name: 'CCTV_MainGate_03.mp4', size: '37.6 KB', status: 'STAGED', locationId: 'Sector A1', notes: '', url: null },
    ]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [progress, setProgress] = useState(0);
    const [model, setModel] = useState(true); // AI Server Ready
    const [detectionCount, setDetectionCount] = useState(0);
    const [aiFrame, setAiFrame] = useState(null);
    const [aiSocket, setAiSocket] = useState(null);
    const [detectionLogs, setDetectionLogs] = useState([
        { id: 1, text: 'SYSTEM: READY FOR ANALYSIS', type: 'info' },
    ]);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // --- PERSISTENT AI SERVER CONNECTION (Port 5001) ---
    useEffect(() => {
        const socket = io('http://localhost:5001');
        setAiSocket(socket);

        socket.on('vision_update', (data) => {
            if (data.frame) setAiFrame(data.frame);
            
            if (data.alerts && data.alerts.length > 0) {
                data.alerts.forEach(alert => {
                    const type = (alert.includes('FIRE') || alert.includes('SMOKE')) ? 'alert' : 'warning';
                    addThrottledLog(`${alert.toUpperCase()} DETECTED`, type);
                    if (alert.includes('CROWD')) setDetectionCount(8);
                });
            } else {
                setDetectionCount(0);
            }
        });

        socket.on('scan_complete', (data) => {
            console.log(`✅ Scan Complete: ${data.video_filename}`);
            addThrottledLog(`SYSTEM: SCAN COMPLETE | ${data.video_filename.toUpperCase()}`, 'info');
        });

        return () => socket.disconnect();
    }, []);

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
        const cooldown = 4000;
        if (!lastLogTime.current[text] || (now - lastLogTime.current[text] > cooldown)) {
            setDetectionLogs(prev => [{ id: now, text, type }, ...prev].slice(0, 10));
            lastLogTime.current[text] = now;
        }
    };

    const handleStartScan = (videoFilename) => {
        if (!aiSocket) return;
        console.log(`🚀 Triggering AI Scan on Port 5000: ${videoFilename}`);
        aiSocket.emit('start_scan', { video_filename: videoFilename });
        addThrottledLog(`SYSTEM: INITIALIZING DUAL-MODEL SCAN...`, 'info');
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
        <div style={{ gridArea: '2 / 2 / -1 / -1', backgroundColor: 'var(--bg-deep)' }} className="w-full h-full flex flex-col p-8 font-sans text-[var(--text-bright)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0">
                
                {/* LEFT COLUMN: FOOTAGE STAGING (4 Cols) */}
                <div className="lg:col-span-5 flex flex-col h-full bg-[var(--bg-panel)] backdrop-blur-xl border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow-lg)]">
                    <div className="px-8 py-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-cctv-label)]">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-[var(--accent-cyan-glow)]">
                                <Brain size={20} className="text-[var(--accent-cyan)]" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-[var(--text-bright)]">Footage Staging</span>
                        </div>
                        <div className="flex gap-2 font-mono">
                            <div className="text-[10px] px-2 py-1 rounded bg-black/40 border border-white/5 text-cyan-500/70 uppercase">v2.4.2-STABLE</div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col p-8 overflow-hidden">
                        {/* DROP ZONE */}
                        <div 
                            className="h-52 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--btn-subtle-bg)] flex flex-col items-center justify-center gap-5 hover:border-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-glow)] transition-all duration-500 cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} multiple />
                            <div className="p-4 rounded-2xl bg-[var(--bg-dropdown)] text-[var(--text-dim)] group-hover:bg-[var(--accent-cyan)] group-hover:text-black transition-all duration-500 shadow-xl">
                                <Upload size={28} />
                            </div>
                            <div className="text-center">
                                <div className="text-base font-bold text-[var(--text-bright)] mb-1">Ingest New Footage</div>
                                <div className="text-xs text-[var(--text-muted)] uppercase tracking-widest fon-mono">MP4, MOV, or AVI preferred</div>
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
                                        style={selectedVideo?.id === vid.id 
                                            ? { background: 'var(--accent-cyan-glow)', borderColor: 'var(--accent-cyan)' }
                                            : { background: 'var(--btn-subtle-bg)', borderColor: 'var(--border)' }
                                        }
                                        className={`group relative grid grid-cols-[1fr_auto_auto_40px] gap-4 p-5 rounded-xl border transition-all duration-300 cursor-pointer hover:border-[var(--border-active)]`}
                                        onClick={() => handleSelectVideo(vid)}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div style={{ background: 'var(--bg-dropdown)', color: selectedVideo?.id === vid.id ? 'var(--accent-cyan)' : 'var(--text-dim)' }} className={`p-2 rounded-lg`}>
                                                <FileVideo size={18} />
                                            </div>
                                            <div className="min-w-0 overflow-hidden">
                                                <div className="text-sm font-bold text-[var(--text-bright)] truncate">{vid.name}</div>
                                                <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{vid.size} • {vid.id}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center">
                                            <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--bg-cctv-label)] text-[var(--text-dim)] border border-[var(--border)]">
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

                {/* RIGHT COLUMN: VIDEO PLAYER (7 Cols) */}
                <div className="lg:col-span-12 xl:col-span-7 flex flex-col h-full bg-[var(--bg-panel)] backdrop-blur-xl border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] relative">
                    <div className="px-8 py-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-cctv-label)]">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${model ? 'bg-[var(--accent-green)] shadow-[var(--shadow-lg)]' : 'bg-[var(--accent-red)] animate-pulse'}`}></div>
                            <span className="text-base font-black tracking-widest text-[var(--text-bright)] uppercase italic">AI VISION PROCESSOR</span>
                        </div>
                        <div className="font-mono text-[10px] text-[var(--accent-cyan)] font-bold px-3 py-1 rounded bg-[var(--bg-cctv-label)] border border-[var(--border)] tracking-tighter">ENGINE: YOLOv11-LITE</div>
                    </div>

                    <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
                        {selectedVideo ? (
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="relative aspect-video bg-black rounded-lg border border-gray-800 overflow-hidden group">
                                    {aiFrame ? (
                                        <img 
                                            src={aiFrame} 
                                            className="w-full h-full object-contain" 
                                            alt="AI Vision Stream"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-900/40">
                                            <FileVideo size={48} className="text-gray-700 animate-pulse" />
                                        </div>
                                    )}
                                    
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
                                <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-dropdown)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow-lg)]">
                                    <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-cctv-label)] flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Activity size={12} className="text-[var(--accent-cyan)]" />
                                            <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-dim)] uppercase">Neural Stream Log</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-[var(--accent-red)]"></div>
                                            <div className="w-2 h-2 rounded-full bg-[var(--accent-gold)]"></div>
                                            <div className="w-2 h-2 rounded-full bg-[var(--accent-green)]"></div>
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
                                    <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-5">
                                        <div>
                                            <div className="text-[11px] text-[var(--accent-cyan)] font-black mb-2 uppercase tracking-[0.2em]">Artifact Metadata</div>
                                            <h2 className="text-2xl font-black text-[var(--text-bright)] truncate max-w-[400px] tracking-tight">{selectedVideo.name}</h2>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-[var(--text-dim)] mb-1 font-bold uppercase tracking-widest">Global Status</div>
                                            <div className="text-xs font-black text-[var(--accent-cyan)] px-3 py-1 rounded bg-[var(--bg-cctv-label)] border border-[var(--border)]">{selectedVideo.status}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="flex flex-col gap-3">
                                            <label className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-widest">Deployment Location</label>
                                            <div className="relative group">
                                                <div className="absolute inset-0 bg-[var(--accent-cyan-glow)] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent-cyan)]" />
                                                <select 
                                                    className="w-full bg-[var(--bg-cctv-label)] border border-[var(--border)] rounded-xl pl-11 pr-4 py-4 text-sm font-bold text-[var(--text-bright)] outline-none focus:border-[var(--accent-cyan)] transition-all appearance-none"
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
                                            <label className="text-[11px] font-black text-[var(--text-dim)] uppercase tracking-widest">Active Incident Intel</label>
                                            <div className="relative group">
                                                <div className="absolute inset-0 bg-[var(--accent-cyan-glow)] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <FileText size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent-cyan)]" />
                                                <input 
                                                    type="text"
                                                    placeholder="Append field observer notes..."
                                                    className="w-full bg-[var(--bg-cctv-label)] border border-[var(--border)] rounded-xl pl-11 pr-4 py-4 text-sm font-bold text-[var(--text-bright)] outline-none focus:border-[var(--accent-cyan)] transition-all"
                                                    value={selectedVideo.notes}
                                                    onChange={(e) => updateFile(selectedVideo.id, 'notes', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[var(--border)] rounded-2xl m-8 bg-[var(--bg-cctv-label)]">
                                <div className="flex flex-col items-center gap-6 text-[var(--text-muted)]">
                                    <div className="flex gap-6 opacity-30 animate-pulse">
                                        <FileVideo size={64} />
                                        <div className="w-[2px] h-12 bg-[var(--border)] self-center"></div>
                                        <Brain size={64} className="text-[var(--accent-cyan)]" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-base font-black tracking-widest text-[var(--text-bright)] uppercase italic">System Idling...</p>
                                        <p className="text-xs text-[var(--text-dim)] font-bold uppercase tracking-widest">Select a staged artifact to initialize AI telemetry</p>
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
