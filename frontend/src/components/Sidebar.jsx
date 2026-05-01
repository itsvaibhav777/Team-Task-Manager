import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users,
  LogOut, Settings, ChevronRight, Shield, Bell
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { usersAPI } from '../api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Team Members' },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    usersAPI.getNotifications()
      .then(r => setUnread(r.data.filter(n => !n.read).length))
      .catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const avatar = user?.avatar || {};

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <CheckSquare size={24} />
          {!collapsed && <span className="logo-text">TaskFlow</span>}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(v => !v)}>
          <ChevronRight size={16} className={collapsed ? '' : 'rotated'} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {!collapsed && <span className="nav-label">Main</span>}
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        {isAdmin && (
          <div className="nav-section">
            {!collapsed && <span className="nav-label">Admin</span>}
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={18} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && <Shield size={12} className="admin-badge" />}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="notif-icon-wrap">
            <Bell size={18} />
            {unread > 0 && <span className="badge-dot">{unread}</span>}
          </div>
          {!collapsed && <span>Notifications</span>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: avatar.color || '#6366f1' }}>
            {avatar.initials || user?.name?.[0] || '?'}
          </div>
          {!collapsed && (
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className={`role-chip ${user?.role}`}>{user?.role}</span>
            </div>
          )}
          {!collapsed && (
            <button className="icon-btn logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
