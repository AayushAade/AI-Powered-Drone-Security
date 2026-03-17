import { useState, useRef } from 'react';

const BACKEND_URL = `http://localhost:3000`;

const DEMO_INCIDENTS = {
    fallen_person: { type: 'Fallen Person Detected', severity: 'CRITICAL' },
    crowd_gathering: { type: 'Crowd Gathering Detected', severity: 'High' },
    suspicious_object: { type: 'Abandoned Bag Detected', severity: 'High' },
    unauthorized_entry: { type: 'Unauthorized Zone Entry', severity: 'High' },
};

export default function VideoUpload({ onAnalysisStart, onAnalysisDone }) {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const inputRef = useRef(null);

    const handleFile = (f) => {
        if (f && f.type.startsWith('video/')) setFile(f);
        else alert('Please select a video file (.mp4, .mov, .avi)');
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setResult(null);
        onAnalysisStart?.();

        const form = new FormData();
        form.append('video', file);

        try {
            const res = await fetch(`${BACKEND_URL}/api/upload-video`, { method: 'POST', body: form });
            const data = await res.json();
            setResult(data);
            onAnalysisDone?.(data);
        } catch (e) {
            setResult({ error: 'Upload failed. Is the backend running?' });
        } finally {
            setUploading(false);
        }
    };

    const handleDemo = async (demoKey) => {
        setUploading(true);
        setResult(null);
        onAnalysisStart?.();
        try {
            const incident = DEMO_INCIDENTS[demoKey] || { type: 'Simulated Incident', severity: 'High' };
            const res = await fetch(`${BACKEND_URL}/api/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: incident.type,
                    severity: incident.severity,
                }),
            });
            const data = await res.json();
            setResult({ success: true, incident: data.alert, demo: true });
            onAnalysisDone?.(data);
        } catch {
            setResult({ error: 'Failed to trigger demo.' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            {/* Upload zone */}
            <div
                className={`upload-zone ${dragging ? 'dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            >
                <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
                    onChange={(e) => handleFile(e.target.files[0])} />
                <span className="icon">🎬</span>
                <div className="upload-label">
                    {file ? `📁 ${file.name}` : 'Drop CCTV video or click to browse'}
                </div>
                <div className="upload-hint">MP4, MOV, AVI — max 100MB</div>
                {uploading && <div className="upload-progress"><div className="upload-progress-fill" /></div>}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading} style={{ flex: 1 }}>
                    {uploading ? <><span className="spin">⟳</span> Analyzing...</> : '🔍 Analyze Video'}
                </button>
                <button className="btn btn-ghost" onClick={() => setFile(null)} disabled={!file || uploading}>✕</button>
            </div>

            {/* Demo triggers */}
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                DEMO TRIGGERS (no video needed)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[
                    { type: 'fallen_person', label: '🚑 Accident' },
                    { type: 'crowd_gathering', label: '👥 Crowd' },
                    { type: 'suspicious_object', label: '📦 Object' },
                    { type: 'unauthorized_entry', label: '🚧 Entry' },
                ].map(({ type, label }) => (
                    <button key={type} className="btn btn-ghost"
                        style={{ fontSize: 10, padding: '4px 8px' }}
                        disabled={uploading}
                        onClick={() => handleDemo(type)}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Result */}
            {result && (
                <div style={{
                    marginTop: 10, padding: 10, borderRadius: 8, fontSize: 11,
                    background: result.error ? 'rgba(252,129,129,0.1)' : 'rgba(104,211,145,0.1)',
                    border: `1px solid ${result.error ? 'rgba(252,129,129,0.3)' : 'rgba(104,211,145,0.3)'}`,
                    color: result.error ? 'var(--critical)' : 'var(--accent-green)',
                }}>
                    {result.error
                        ? `❌ ${result.error}`
                        : result.incident
                            ? `✅ ${result.demo ? 'Demo: ' : ''}${result.incident.type} detected — drone dispatched!`
                            : '✅ Video analyzed — no incident detected'}
                </div>
            )}
        </div>
    );
}
