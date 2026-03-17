const INCIDENT_ICONS = {
    crowd_gathering: '👥',
    fallen_person: '🚑',
    suspicious_object: '📦',
    unauthorized_entry: '🚧',
    vehicle_stop: '🚗',
    altercation: '⚔️',
    none: '⚠️',
};

const INCIDENT_LABELS = {
    crowd_gathering: 'Crowd Gathering',
    fallen_person: 'Fallen Person / Accident',
    suspicious_object: 'Suspicious Object',
    unauthorized_entry: 'Unauthorized Entry',
    vehicle_stop: 'Suspicious Vehicle',
    altercation: 'Altercation / Fight',
    none: 'Unknown Incident',
};

export default function AlertPanel({ alerts }) {
    if (alerts.length === 0) {
        return (
            <div className="empty-state">
                <div className="icon">🛡️</div>
                <div>No active incidents</div>
                <div style={{ marginTop: 4, fontSize: 10 }}>System monitoring all feeds</div>
            </div>
        );
    }

    return (
        <div>
            {alerts.map((alert, i) => (
                <div
                    key={alert.id}
                    className={`alert-card ${alert.severity} ${i === 0 ? 'new-alert' : ''}`}
                >
                    <div className="alert-header">
                        <div className="alert-type">
                            {INCIDENT_ICONS[alert.type] || '⚠️'} {INCIDENT_LABELS[alert.type] || 'Incident'}
                        </div>
                        <span className={`severity-badge severity-${alert.severity}`}>
                            {alert.severity}
                        </span>
                    </div>
                    <div className="alert-desc">{alert.description}</div>
                    <div className="alert-meta">
                        <span>📍 {alert.location}</span>
                        <span>🕐 {new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 6,
                            background: alert.status === 'drone_on_site'
                                ? 'rgba(104,211,145,0.15)' : 'rgba(99,179,237,0.15)',
                            color: alert.status === 'drone_on_site' ? '#68d391' : '#63b3ed',
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                            {alert.status === 'drone_on_site' ? '✅ Drone on site' : '🚁 Drone dispatched'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
