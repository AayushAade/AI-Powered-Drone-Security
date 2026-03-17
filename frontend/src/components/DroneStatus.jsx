export default function DroneStatus({ telemetry }) {
    const status = telemetry?.status || 'idle';

    const getBatteryColor = (b) => {
        if (b > 50) return '#68d391';
        if (b > 20) return '#f6ad55';
        return '#fc8181';
    };

    return (
        <div className="drone-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div className="drone-name">🚁 DRONE-1</div>
                    <div className="drone-id">ID: DRN-2024-001 • Urban Safety Unit</div>
                </div>
                <div style={{ fontSize: 20 }}>
                    {status === 'idle' ? '😴' : status === 'dispatched' ? '🚀' : status === 'on_site' ? '🎯' : '↩️'}
                </div>
            </div>

            <div className={`drone-status-badge badge-${status}`}>
                <span className={status !== 'idle' ? 'status-dot pulse' : 'status-dot'} style={{ background: 'currentColor' }} />
                {status === 'idle' && 'Idle — At Base'}
                {status === 'dispatched' && 'Dispatched — En Route'}
                {status === 'on_site' && 'On Site — Monitoring'}
                {status === 'returning' && 'Returning to Base'}
            </div>

            {/* Battery */}
            <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>BATTERY</span>
                    <span style={{ color: getBatteryColor(telemetry?.battery ?? 100), fontWeight: 700 }}>
                        {telemetry?.battery?.toFixed(0) ?? 100}%
                    </span>
                </div>
                <div className="battery-bar">
                    <div className="battery-fill" style={{
                        width: `${telemetry?.battery ?? 100}%`,
                        background: getBatteryColor(telemetry?.battery ?? 100),
                    }} />
                </div>
            </div>

            <div className="drone-stats">
                <div className="stat-item">
                    <div className="stat-label">ETA</div>
                    <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
                        {telemetry?.eta != null ? `${telemetry.eta}s` : '—'}
                    </div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Altitude</div>
                    <div className="stat-value">{telemetry?.altitude ? `${Math.round(telemetry.altitude)}m` : '0m'}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Speed</div>
                    <div className="stat-value">{telemetry?.speed ? `${Math.round(telemetry.speed)}km/h` : '0km/h'}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Position</div>
                    <div className="stat-value" style={{ fontSize: 10 }}>
                        {telemetry ? `${telemetry.lat?.toFixed(3)}, ${telemetry.lng?.toFixed(3)}` : 'Base'}
                    </div>
                </div>
            </div>
        </div>
    );
}
