import React from 'react';
import { 
    LayoutDashboard, 
    Camera, 
    Bell, 
    Satellite, 
    Settings, 
    User,
    Hexagon
} from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { icon: <LayoutDashboard size={20} />, id: 'dashboard', active: true },
        { icon: <Camera size={20} />, id: 'cctv' },
        { icon: <Bell size={20} />, id: 'alerts' },
        { icon: <Satellite size={20} />, id: 'comms' },
        { icon: <Settings size={20} />, id: 'settings' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo" style={{ marginBottom: '40px', color: 'var(--accent-cyan)', display: 'flex', justifyContent: 'center' }}>
                <Hexagon size={28} fill="currentColor" fillOpacity={0.2} style={{ filter: 'drop-shadow(0 0 8px var(--accent-cyan))' }} />
            </div>
            {navItems.map(item => (
                <div key={item.id} className={`nav-icon ${item.active ? 'active' : ''}`}>
                    {item.icon}
                </div>
            ))}
            <div style={{ marginTop: 'auto' }}>
                <div className="nav-icon">
                    <User size={20} />
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
