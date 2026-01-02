import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FiHome, FiPackage, FiShoppingCart, FiUsers, 
  FiTrendingUp, FiBell, FiLogOut 
} from 'react-icons/fi';
import { GiWoodPile } from 'react-icons/gi';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: FiHome, label: 'Dashboard' },
    { to: '/inventory', icon: FiPackage, label: 'Inventory' },
    { to: '/orders', icon: FiShoppingCart, label: 'Orders' },
    { to: '/vendors', icon: FiUsers, label: 'Vendors' },
    { to: '/forecasts', icon: FiTrendingUp, label: 'Forecasts' },
    { to: '/alerts', icon: FiBell, label: 'Alerts' },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <GiWoodPile />
            <span>LumberFlow</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={to === '/'}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <FiLogOut />
            </button>
          </div>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
