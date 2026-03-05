import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getTenantInfo } from '../utils/tenantUtils'
import '../pages/owner/Pages.css'

/**
 * TenantDebugPanel
 * Shows current tenant information for development/testing
 * Display this component on dashboard pages to verify multi-tenant isolation
 * 
 * Usage:
 * import TenantDebugPanel from '../components/TenantDebugPanel'
 * <TenantDebugPanel />
 */
export default function TenantDebugPanel() {
  const { user, userProfile } = useAuth()
  const [tenantInfo, setTenantInfo] = useState(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Only show in development
  const isDevelopment = import.meta.env.DEV

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadTenantInfo()
    }
  }, [userProfile])

  const loadTenantInfo = async () => {
    const info = await getTenantInfo(userProfile.tenant_id)
    setTenantInfo(info)
  }

  if (!isDevelopment) {
    return null // Hide in production
  }

  if (!userProfile) {
    return null
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '12px',
        padding: isExpanded ? '15px' : '10px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        zIndex: 9999,
        maxWidth: '320px',
        fontSize: '0.85em',
        cursor: isExpanded ? 'default' : 'pointer',
        transition: 'all 0.3s ease'
      }}
      onClick={() => !isExpanded && setIsExpanded(true)}
    >
      {!isExpanded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2em' }}>🏢</span>
          <strong>Tenant Info</strong>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <strong style={{ fontSize: '1.1em' }}>🏢 Tenant Debug Panel</strong>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(false)
              }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            padding: '10px', 
            borderRadius: '8px',
            marginBottom: '8px'
          }}>
            <div style={{ marginBottom: '6px' }}>
              <strong>Tenant ID:</strong>
              <div style={{ 
                fontFamily: 'monospace', 
                fontSize: '0.85em',
                marginTop: '2px',
                wordBreak: 'break-all'
              }}>
                {userProfile.tenant_id}
              </div>
            </div>

            <div style={{ marginBottom: '6px' }}>
              <strong>Business Name:</strong>
              <div style={{ marginTop: '2px' }}>
                {tenantInfo?.name || 'Loading...'}
              </div>
            </div>

            <div style={{ marginBottom: '6px' }}>
              <strong>Your Role:</strong>
              <div style={{ 
                marginTop: '2px',
                textTransform: 'capitalize',
                display: 'inline-block',
                background: 'rgba(255,255,255,0.2)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                {userProfile.role}
              </div>
            </div>

            <div>
              <strong>User Email:</strong>
              <div style={{ fontSize: '0.9em', marginTop: '2px' }}>
                {user.email}
              </div>
            </div>
          </div>

          {tenantInfo && (
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              padding: '8px', 
              borderRadius: '8px',
              fontSize: '0.85em'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Subscription:</strong> {tenantInfo.subscription_status}
              </div>
              {tenantInfo.subscription_end && (
                <div>
                  <strong>Expires:</strong> {new Date(tenantInfo.subscription_end).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          <div style={{ 
            marginTop: '10px', 
            padding: '8px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '0.8em'
          }}>
            ⚠️ <strong>Dev Only:</strong> This panel is only visible in development mode
          </div>

          <button
            onClick={() => {
              console.log('=== TENANT DEBUG INFO ===')
              console.log('Tenant ID:', userProfile.tenant_id)
              console.log('Tenant Name:', tenantInfo?.name)
              console.log('User Role:', userProfile.role)
              console.log('User Email:', user.email)
              console.log('Tenant Info:', tenantInfo)
              console.log('User Profile:', userProfile)
              console.log('========================')
              alert('Tenant info logged to console')
            }}
            style={{
              width: '100%',
              marginTop: '8px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
          >
            📋 Log to Console
          </button>
        </>
      )}
    </div>
  )
}
