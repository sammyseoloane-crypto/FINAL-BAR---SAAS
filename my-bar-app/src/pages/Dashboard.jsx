import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import OwnerDashboard from './OwnerDashboard'
import StaffDashboard from './StaffDashboard'
import CustomerDashboard from './CustomerDashboard'

export default function Dashboard() {
  const { userProfile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.5em',
        color: '#667eea'
      }}>
        Loading dashboard...
      </div>
    )
  }

  if (!userProfile) {
    return <Navigate to="/auth/login" replace />
  }

  // Validate role exists
  if (!userProfile.role) {
    console.error('User profile missing role:', userProfile)
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#e53e3e', marginBottom: '10px' }}>⚠️ Account Configuration Error</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Your account is missing a role assignment. Please contact support.
        </p>
        <button 
          onClick={() => signOut()}
          style={{
            padding: '10px 20px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  // Route to appropriate dashboard based on role
  switch (userProfile.role.toLowerCase()) {
    case 'owner':
    case 'admin':
      return <OwnerDashboard />
    case 'staff':
      return <StaffDashboard />
    case 'customer':
      return <CustomerDashboard />
    default:
      console.error('Unknown user role:', userProfile.role)
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#e53e3e', marginBottom: '10px' }}>⚠️ Invalid User Role</h2>
          <p style={{ marginBottom: '10px', color: '#666' }}>
            Your account has an invalid role: <strong>{userProfile.role}</strong>
          </p>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Please contact support to resolve this issue.
          </p>
          <button 
            onClick={() => signOut()}
            style={{
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      )
  }
}
