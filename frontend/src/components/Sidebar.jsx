import React from 'react';
import { 
    LayoutDashboard, 
    ClipboardList, 
    Target, 
    Network,
    HelpCircle,
    LogOut,
    Hexagon,
    Upload
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
    const mainNavItems = [
        { icon: <LayoutDashboard size={20} />, id: 'dashboard', label: 'Dashboard' },
        { icon: <Upload size={20} />, id: 'upload', label: 'Upload' },
        { icon: <ClipboardList size={20} />, id: 'logs', label: 'Logs' },
        { icon: <Target size={20} />, id: 'analytics', label: 'Analytics' },
        { icon: <Network size={20} />, id: 'fleet', label: 'Fleet' },
    ];

    const utilityNavItems = [
        { icon: <HelpCircle size={20} />, id: 'help', label: 'Help' },
        { icon: <LogOut size={20} />, id: 'logout', label: 'Logout' },
    ];

    return (
        <aside className="sidebar">
            <div style={{ 
                marginBottom: '32px', 
                display: 'flex', 
                justifyContent: 'center',
                position: 'relative'
            }}>
                <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(223, 255, 0, 0.08)',
                    border: '1px solid rgba(223, 255, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-lime)',
                }}>
                    <Hexagon size={22} fill="currentColor" fillOpacity={0.15} style={{ filter: 'drop-shadow(0 0 8px rgba(223, 255, 0, 0.4))' }} />
                </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center' }}>
                {mainNavItems.map(item => (
                    <div 
                        key={item.id} 
                        className={`nav-icon ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                        title={item.label}
                    >
                        {item.icon}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center', paddingBottom: '12px' }}>
                {utilityNavItems.map(item => (
                    <div 
                        key={item.id} 
                        className={`nav-icon ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                        title={item.label}
                    >
                        {item.icon}
                    </div>
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;
