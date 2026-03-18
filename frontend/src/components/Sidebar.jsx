import React from 'react';
import { 
    LayoutDashboard, 
    ClipboardList, 
    Target, 
    Network,
    HelpCircle,
    LogOut,
    Hexagon
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
    const mainNavItems = [
        { icon: <LayoutDashboard size={20} />, id: 'dashboard' },
        { icon: <ClipboardList size={20} />, id: 'logs' },
        { icon: <Target size={20} />, id: 'analytics' },
        { icon: <Network size={20} />, id: 'fleet' },
    ];

    const utilityNavItems = [
        { icon: <HelpCircle size={20} />, id: 'help' },
        { icon: <LogOut size={20} />, id: 'logout' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo" style={{ marginBottom: '40px', color: 'var(--accent-cyan)', display: 'flex', justifyContent: 'center' }}>
                <Hexagon size={28} fill="currentColor" fillOpacity={0.2} style={{ filter: 'drop-shadow(0 0 8px var(--accent-cyan))' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', alignItems: 'center' }}>
                {mainNavItems.map(item => (
                    <div 
                        key={item.id} 
                        className={`nav-icon ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                    >
                        {item.icon}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', alignItems: 'center' }}>
                {utilityNavItems.map(item => (
                    <div 
                        key={item.id} 
                        className={`nav-icon ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                    >
                        {item.icon}
                    </div>
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;
