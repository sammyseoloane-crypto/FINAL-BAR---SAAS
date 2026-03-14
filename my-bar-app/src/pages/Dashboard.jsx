import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlatformAdminDashboard from './PlatformAdminDashboard';
import OwnerDashboard from './OwnerDashboard';
import ManagerDashboard from './ManagerDashboard';
import StaffDashboard from './StaffDashboard';
import PromoterDashboard from './PromoterDashboard';
import VIPHostDashboard from './VIPHostDashboard';
import CustomerDashboard from './CustomerDashboard';

export default function Dashboard() {
  const { userProfile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontSize: '1.5em',
          color: '#d4af37',
        }}
      >
        Loading dashboard...
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/auth/login" replace />;
  }

  // Validate role exists
  if (!userProfile.role) {
    console.error('User profile missing role:', userProfile);
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ color: '#e53e3e', marginBottom: '10px' }}>⚠️ Account Configuration Error</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Your account is missing a role assignment. Please contact support.
        </p>
        <button
          onClick={() => signOut()}
          style={{
            padding: '10px 20px',
            background: '#d4af37',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Route to appropriate dashboard based on role
  switch (userProfile.role.toLowerCase()) {
    case 'platform_admin':
      return <PlatformAdminDashboard />;
    case 'owner':
      return <OwnerDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'staff':
      return <StaffDashboard />;
    case 'promoter':
      return <PromoterDashboard />;
    case 'vip_host':
      return <VIPHostDashboard />;
    case 'customer':
      return <CustomerDashboard />;
    // Legacy support for 'admin' role (redirect to platform_admin)
    case 'admin':
      return <PlatformAdminDashboard />;
    default:
      console.error('Unknown user role:', userProfile.role);
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '20px',
            textAlign: 'center',
          }}
        >
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
              background: '#d4af37',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      );
  }
}
