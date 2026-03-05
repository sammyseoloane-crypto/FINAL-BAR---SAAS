import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, userProfile, loading } = useAuth()
  const location = useLocation()

  // Show loading spinner while checking auth
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
        Loading...
      </div>
    )
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Check if user profile is loaded and role is allowed
  if (allowedRoles.length > 0 && userProfile) {
    if (!allowedRoles.includes(userProfile.role)) {
      // User doesn't have permission - redirect to their appropriate dashboard
      return <Navigate to="/dashboard" replace />
    }
  }

  // User is authenticated and has permission
  return children
}
