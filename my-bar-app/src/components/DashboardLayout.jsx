import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import PropTypes from 'prop-types';
import TenantDebugPanel from './TenantDebugPanel';
import './DashboardLayout.css';
import './RoleBadges.css';

function DashboardLayout({ children }) {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const getRoleLinks = () => {
    switch (userProfile?.role) {
      case 'platform_admin':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🧑‍💼' },
          { to: '/platform-admin/tenants', label: 'Tenant Management', icon: '🏢' },
          { to: '/platform-admin/analytics', label: 'Platform Analytics', icon: '📊' },
          { to: '/platform-admin/billing', label: 'Billing Overview', icon: '💰' },
          { to: '/platform-admin/plans', label: 'Subscription Plans', icon: '💳' },
          { to: '/platform-admin/logs', label: 'System Logs', icon: '📋' },
          { to: '/platform-admin/support', label: 'Support Tickets', icon: '🎫' },
        ];
      case 'owner':
      case 'admin': // Legacy support
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/owner/system-overview', label: 'System Overview', icon: '🏢' },
          { to: '/owner/subscription', label: 'Subscription', icon: '💳' },
          { to: '/owner/locations', label: 'Locations', icon: '📍' },
          { to: '/owner/staff', label: 'Staff', icon: '👥' },
          { to: '/owner/products', label: 'Products', icon: '🍺' },
          { to: '/owner/transactions', label: 'Transactions', icon: '💰' },
          { to: '/owner/events', label: 'Events', icon: '🎉' },
          { to: '/owner/vip-tables', label: 'VIP Tables', icon: '🥂' },
          { to: '/owner/club-dashboard', label: 'Live Performance', icon: '🎵' },
          { to: '/owner/tasks', label: 'Tasks', icon: '📝' },
          { to: '/owner/reports', label: 'Reports', icon: '📊' },
          { to: '/owner/email-logs', label: 'Email Logs', icon: '📬' },
        ];
      case 'manager':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/manager/staff', label: 'Staff', icon: '👥' },
          { to: '/manager/shifts', label: 'Shifts', icon: '⏰' },
          { to: '/manager/reservations', label: 'Reservations', icon: '📅' },
          { to: '/manager/guest-lists', label: 'Guest Lists', icon: '📋' },
          { to: '/manager/pos-monitor', label: 'POS Monitor', icon: '💳' },
          { to: '/staff/qr-codes', label: 'Table QR Codes', icon: '📱' },
          { to: '/manager/reports', label: 'Reports', icon: '📊' },
          { to: '/manager/events', label: 'Events', icon: '🎉' },
        ];
      case 'staff':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/staff/tasks', label: 'My Tasks', icon: '📝' },
          { to: '/staff/tabs', label: 'Bar Tabs', icon: '🍹' },
          { to: '/staff/qr-codes', label: 'Table QR Codes', icon: '📱' },
          { to: '/staff/payments', label: 'Confirm Payments', icon: '💳' },
          { to: '/staff/scanner', label: 'QR Scanner', icon: '📱' },
        ];
      case 'promoter':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/promoter/guest-lists', label: 'Guest Lists', icon: '📋' },
          { to: '/promoter/commission', label: 'Commission', icon: '💰' },
          { to: '/promoter/events', label: 'Events', icon: '🎉' },
        ];
      case 'vip_host':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/vip-host/tables', label: 'Table Reservations', icon: '🪑' },
          { to: '/vip-host/bottle-service', label: 'Bottle Service', icon: '🍾' },
          { to: '/vip-host/guests', label: 'VIP Guests', icon: '⭐' },
        ];
      case 'customer':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/customer/events', label: 'Events', icon: '🎉' },
          { to: '/customer/products', label: 'Products', icon: '🍺' },
          { to: '/customer/menu', label: 'Menu', icon: '📋' },
          { to: '/customer/tables', label: 'Table Reservations', icon: '🪑' },
          { to: '/customer/guest-lists', label: 'Guest Lists', icon: '📝' },
          { to: '/customer/purchases', label: 'My Purchases', icon: '💳' },
          { to: '/tab/view', label: 'My Bar Tab', icon: '🍸' },
          { to: '/customer/orders', label: 'Orders', icon: '🛒' },
          { to: '/customer/qrcodes', label: 'QR Codes', icon: '📱' },
          { to: '/customer/loyalty', label: 'Loyalty Rewards', icon: '⭐' },
          { to: '/customer/profile', label: 'Profile', icon: '👤' },
        ];
      default:
        return [];
    }
  };

  const getRoleBadgeClass = () => {
    switch (userProfile?.role) {
      case 'platform_admin':
        return 'role-platform-admin';
      case 'owner':
      case 'admin':
        return 'role-owner';
      case 'manager':
        return 'role-manager';
      case 'staff':
        return 'role-staff';
      case 'promoter':
        return 'role-promoter';
      case 'vip_host':
        return 'role-vip-host';
      case 'customer':
        return 'role-customer';
      default:
        return '';
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile Menu Button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <img src="/jaive-logo.jpg" alt="Jaive Logo" className="sidebar-logo" />
          <button
            className="mobile-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          <span className={`role-badge ${getRoleBadgeClass()}`}>{userProfile?.role || 'User'}</span>
        </div>

        <nav className="sidebar-nav">
          {getRoleLinks().map((link, index) => (
            <Link
              key={index}
              to={link.to}
              className="nav-link"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            {userProfile?.tenant_name && (
              <span className="user-company">🏢 {userProfile.tenant_name}</span>
            )}
            <span className="user-email">{userProfile?.email}</span>
          </div>
          <button onClick={handleSignOut} className="btn-signout">
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-wrapper">{children}</div>
      </main>

      {/* Tenant Debug Panel (dev only) */}
      <TenantDebugPanel />
    </div>
  );
}

DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default DashboardLayout;
