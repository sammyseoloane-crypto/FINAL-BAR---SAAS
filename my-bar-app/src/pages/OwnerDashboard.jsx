import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

export default function OwnerDashboard() {
  const { userProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🍺 Bar SaaS</h1>
          <span className="role-badge role-owner">Owner</span>
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Owner Dashboard</h2>
          <p>Welcome back, {userProfile?.email}!</p>
          {userProfile?.tenant_name && (
            <p className="company-name">🏢 {userProfile.tenant_name}</p>
          )}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Analytics</h3>
            <p>View sales reports and business insights</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/reports')}
            >
              View Reports
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📍</div>
            <h3>Locations</h3>
            <p>Manage your bar locations</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/locations')}
            >
              Manage Locations
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">👥</div>
            <h3>Staff Management</h3>
            <p>Add and manage staff members</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/staff')}
            >
              Manage Staff
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🍺</div>
            <h3>Products</h3>
            <p>Manage drinks and food menu</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/products')}
            >
              Manage Products
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎉</div>
            <h3>Events</h3>
            <p>Create and manage bar events</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/events')}
            >
              Manage Events
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📝</div>
            <h3>Tasks</h3>
            <p>Assign and track staff tasks</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/tasks')}
            >
              Manage Tasks
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>Transactions</h3>
            <p>View all customer transactions</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/transactions')}
            >
              View Transactions
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📬</div>
            <h3>Email Logs</h3>
            <p>Monitor verification and notification emails</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/email-logs')}
            >
              View Email Logs
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⚙️</div>
            <h3>Settings</h3>
            <p>Configure business settings</p>
            <button 
              className="btn-card"
              onClick={() => navigate('/owner/subscription')}
            >
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
