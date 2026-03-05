import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import { getTenantEmailLogs, getEmailStatistics } from '../../utils/emailLogger'
import './Pages.css'

export default function EmailLogsPage() {
  const { userProfile } = useAuth()
  const [emailLogs, setEmailLogs] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, signup_verification, password_reset, etc.
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchEmailLogs()
      fetchStatistics()
    }
  }, [userProfile])

  const fetchEmailLogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await getTenantEmailLogs(userProfile.tenant_id, 100)

      if (error) throw error
      setEmailLogs(data || [])
    } catch (error) {
      console.error('Error fetching email logs:', error)
      alert('Error loading email logs: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      const { data, error } = await getEmailStatistics(userProfile.tenant_id)
      if (error) throw error
      setStatistics(data)
    } catch (error) {
      console.error('Error fetching email statistics:', error)
    }
  }

  const filteredLogs = emailLogs.filter(log => {
    const typeMatch = filter === 'all' || log.email_type === filter
    const statusMatch = statusFilter === 'all' || log.status === statusFilter
    return typeMatch && statusMatch
  })

  const getStatusBadgeStyle = (status) => {
    const styles = {
      sent: { background: '#4299e1', color: 'white' },
      delivered: { background: '#48bb78', color: 'white' },
      failed: { background: '#f56565', color: 'white' },
      bounced: { background: '#ed8936', color: 'white' },
      opened: { background: '#9f7aea', color: 'white' }
    }
    return styles[status] || styles.sent
  }

  const getTypeIcon = (type) => {
    const icons = {
      signup_verification: '📧',
      password_reset: '🔑',
      staff_invitation: '👥',
      order_confirmation: '🛍️',
      notification: '🔔'
    }
    return icons[type] || '✉️'
  }

  const formatEmailType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading email logs...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>📬 Email Logs</h2>
          <p>Monitor all emails sent from your system</p>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>📊</div>
                <div style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '5px' }}>
                  {statistics.total}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>Total Emails</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>📧</div>
                <div style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '5px' }}>
                  {statistics.by_type?.signup_verification || 0}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>Signup Verifications</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>🔑</div>
                <div style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '5px' }}>
                  {statistics.by_type?.password_reset || 0}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>Password Resets</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>⏰</div>
                <div style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '5px' }}>
                  {statistics.recent_count || 0}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>Last 24 Hours</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Email Type
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px'
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="signup_verification">Signup Verification</option>
                  <option value="password_reset">Password Reset</option>
                  <option value="staff_invitation">Staff Invitation</option>
                  <option value="order_confirmation">Order Confirmation</option>
                  <option value="notification">Notification</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px'
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="bounced">Bounced</option>
                  <option value="opened">Opened</option>
                </select>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilter('all')
                    setStatusFilter('all')
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Email Logs Table */}
        {filteredLogs.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '3em', marginBottom: '10px' }}>📭</div>
              <h3>No email logs found</h3>
              <p style={{ color: '#666' }}>
                {filter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Email logs will appear here when emails are sent'}
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ padding: '0', overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '120px' }}>Type</th>
                    <th style={{ minWidth: '200px' }}>Recipient</th>
                    <th style={{ minWidth: '250px' }}>Subject</th>
                    <th style={{ minWidth: '100px' }}>Status</th>
                    <th style={{ minWidth: '180px' }}>Sent At</th>
                    <th style={{ minWidth: '150px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.5em' }}>{getTypeIcon(log.email_type)}</span>
                          <span>{formatEmailType(log.email_type)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                          {log.email_to}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9em' }}>
                          {log.subject || '-'}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            ...getStatusBadgeStyle(log.status),
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.85em',
                            fontWeight: '500'
                          }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9em' }}>
                          {new Date(log.sent_at).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details style={{ cursor: 'pointer' }}>
                            <summary style={{ fontSize: '0.85em', color: '#4299e1' }}>
                              View Metadata
                            </summary>
                            <pre style={{
                              fontSize: '0.75em',
                              background: '#f7fafc',
                              padding: '8px',
                              borderRadius: '4px',
                              marginTop: '8px',
                              overflow: 'auto'
                            }}>
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                        {log.error_message && (
                          <div style={{
                            fontSize: '0.85em',
                            color: '#e53e3e',
                            marginTop: '4px'
                          }}>
                            ⚠️ {log.error_message}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f7fafc',
          borderRadius: '8px',
          fontSize: '0.9em'
        }}>
          <strong>💡 Tip:</strong> Email logs help you track delivery issues and monitor communication with users.
          Use filters to find specific email types or check for failed deliveries.
        </div>
      </div>
    </DashboardLayout>
  )
}
