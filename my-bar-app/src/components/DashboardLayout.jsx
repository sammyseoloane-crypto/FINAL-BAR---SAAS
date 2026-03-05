import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import TenantDebugPanel from './TenantDebugPanel'
import './DashboardLayout.css'

export default function DashboardLayout({ children, title }) {
  const { userProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  const getRoleLinks = () => {
    switch (userProfile?.role) {
      case 'owner':
      case 'admin':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/owner/subscription', label: 'Subscription', icon: '💳' },
          { to: '/owner/locations', label: 'Locations', icon: '📍' },
          { to: '/owner/staff', label: 'Staff', icon: '👥' },
          { to: '/owner/products', label: 'Products', icon: '🍺' },
          { to: '/owner/transactions', label: 'Transactions', icon: '💰' },
          { to: '/owner/events', label: 'Events', icon: '🎉' },
          { to: '/owner/tasks', label: 'Tasks', icon: '📝' },
          { to: '/owner/reports', label: 'Reports', icon: '📊' },
          { to: '/owner/email-logs', label: 'Email Logs', icon: '📬' },
        ]
      case 'staff':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/staff/tasks', label: 'My Tasks', icon: '📝' },
          { to: '/staff/payments', label: 'Confirm Payments', icon: '💳' },
          { to: '/staff/scanner', label: 'QR Scanner', icon: '📱' },
        ]
      case 'customer':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
          { to: '/customer/events', label: 'Events', icon: '🎉' },
          { to: '/customer/products', label: 'Products', icon: '🍺' },
          { to: '/customer/menu', label: 'Menu', icon: '📋' },
          { to: '/customer/purchases', label: 'My Purchases', icon: '💳' },
          { to: '/customer/orders', label: 'Orders', icon: '🛒' },
          { to: '/customer/qrcodes', label: 'QR Codes', icon: '📱' },
          { to: '/customer/profile', label: 'Profile', icon: '👤' },
        ]
      default:
        return []
    }
  }

  const getRoleBadgeClass = () => {
    switch (userProfile?.role) {
      case 'owner':
      case 'admin':
        return 'role-owner'
      case 'staff':
        return 'role-staff'
      case 'customer':
        return 'role-customer'
      default:
        return ''
    }
  }

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
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h1>🍺 Bar SaaS</h1>
          <button 
            className="mobile-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          <span className={`role-badge ${getRoleBadgeClass()}`}>
            {userProfile?.role || 'User'}
          </span>
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
        <div className="content-wrapper">
          {children}
        </div>
      </main>

      {/* Tenant Debug Panel (dev only) */}
      <TenantDebugPanel />
    </div>
  )
}
