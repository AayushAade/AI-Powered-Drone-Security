export default function IncidentLog({ logs }) {
    const TYPE_COLORS = {
        alert: 'var(--critical)',
        dispatch: 'var(--accent-blue)',
        update: 'var(--accent-cyan)',
        system: 'var(--text-muted)',
        clear: 'var(--accent-green)',
    };

    if (logs.length === 0) {
        return (
            <div className="empty-state" style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 10 }}>No events yet</div>
            </div>
        );
    }

    return (
        <div>
            {logs.map((entry, i) => (
                <div key={i} className="log-entry">
                    <div className="log-time">{entry.time}</div>
                    <div className="log-text">
                        <span className="log-type" style={{ background: `${TYPE_COLORS[entry.logType] || 'var(--accent-blue)'}20`, color: TYPE_COLORS[entry.logType] || 'var(--accent-blue)' }}>
                            {entry.logType?.toUpperCase()}
                        </span>
                        {' '}<strong>{entry.title}</strong>{' — '}{entry.detail}
                    </div>
                </div>
            ))}
        </div>
    );
}
