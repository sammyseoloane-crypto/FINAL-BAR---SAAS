import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import '../pages/owner/Pages.css'

/**
 * TaskStatistics Component
 * Displays task statistics for owner/admin dashboard
 */
export default function TaskStatistics() {
  const { userProfile } = useAuth()
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0
  })
  const [staffStats, setStaffStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchStats()
    }
  }, [userProfile])

  const fetchStats = async () => {
    try {
      // Get overall task statistics
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('status, due_date')
        .eq('tenant_id', userProfile.tenant_id)

      if (tasksError) throw tasksError

      const now = new Date()
      const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => 
          t.due_date && 
          new Date(t.due_date) < now && 
          t.status !== 'completed'
        ).length
      }
      setStats(stats)

      // Get staff statistics
      const { data: staffData, error: staffError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          tasks:tasks(status)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .eq('role', 'staff')

      if (staffError) throw staffError

      const staffStats = staffData.map(staff => ({
        email: staff.email,
        total: staff.tasks.length,
        completed: staff.tasks.filter(t => t.status === 'completed').length,
        in_progress: staff.tasks.filter(t => t.status === 'in_progress').length,
        pending: staff.tasks.filter(t => t.status === 'pending').length,
        completionRate: staff.tasks.length > 0 
          ? Math.round((staff.tasks.filter(t => t.status === 'completed').length / staff.tasks.length) * 100)
          : 0
      }))

      setStaffStats(staffStats)
    } catch (error) {
      console.error('Error fetching task stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading statistics...</div>
  }

  const completionRate = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0

  return (
    <div style={{ marginBottom: '30px' }}>
      {/* Overall Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ffc107' }}>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #667eea' }}>
          <div className="stat-value">{stats.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #48bb78' }}>
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #dc3545' }}>
          <div className="stat-value">{stats.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #667eea' }}>
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
      </div>

      {/* Staff Performance */}
      {staffStats.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3>👥 Staff Performance</h3>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Total Tasks</th>
                  <th>Pending</th>
                  <th>In Progress</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map((staff, index) => (
                  <tr key={index}>
                    <td>{staff.email}</td>
                    <td><strong>{staff.total}</strong></td>
                    <td>
                      <span className="status-badge status-pending">
                        {staff.pending}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge" style={{ background: '#667eea' }}>
                        {staff.in_progress}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge status-completed">
                        {staff.completed}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          flex: 1, 
                          background: '#e0e0e0', 
                          borderRadius: '10px', 
                          height: '10px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${staff.completionRate}%`, 
                            background: staff.completionRate >= 70 ? '#48bb78' : staff.completionRate >= 40 ? '#ffc107' : '#dc3545',
                            height: '100%',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontWeight: 'bold', minWidth: '40px' }}>
                          {staff.completionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
