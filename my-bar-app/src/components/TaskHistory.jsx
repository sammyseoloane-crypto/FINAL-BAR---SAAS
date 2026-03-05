import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import '../pages/owner/Pages.css'

/**
 * TaskHistory Component
 * Displays audit log of task changes
 */
export default function TaskHistory({ taskId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (taskId) {
      fetchHistory()
    }
  }, [taskId])

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('task_history')
        .select(`
          id,
          action,
          old_value,
          new_value,
          comment,
          created_at,
          users:user_id (
            email,
            role
          )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Error fetching task history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return '✨'
      case 'status_changed': return '🔄'
      case 'assigned': return '👤'
      case 'updated': return '📝'
      case 'commented': return '💬'
      default: return '📋'
    }
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'created': return '#48bb78'
      case 'status_changed': return '#667eea'
      case 'assigned': return '#ffc107'
      case 'updated': return '#4299e1'
      case 'commented': return '#9f7aea'
      default: return '#666'
    }
  }

  const formatActionText = (item) => {
    const user = item.users?.email || 'Unknown'

    switch (item.action) {
      case 'created':
        return `${user} created this task`
      case 'status_changed':
        return `${user} changed status from "${item.old_value}" to "${item.new_value}"`
      case 'assigned':
        return `${user} ${item.old_value ? 're-assigned' : 'assigned'} this task`
      case 'updated':
        return `${user} updated task details`
      case 'commented':
        return `${user} added a comment`
      default:
        return `${user} performed an action`
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    return date.toLocaleString()
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading history...</div>
  }

  if (history.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '30px', 
        color: '#666',
        background: '#f7fafc',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        No history available for this task
      </div>
    )
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ marginBottom: '15px', color: '#333' }}>
        📜 Task History ({history.length})
      </h4>
      
      <div style={{ 
        position: 'relative',
        paddingLeft: '40px'
      }}>
        {/* Timeline line */}
        <div style={{
          position: 'absolute',
          left: '18px',
          top: '10px',
          bottom: '10px',
          width: '2px',
          background: '#e0e0e0'
        }} />

        {/* History items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {history.map((item, index) => (
            <div 
              key={item.id}
              style={{ position: 'relative' }}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: '-31px',
                top: '5px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: getActionColor(item.action),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85em',
                border: '3px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1
              }}>
                {getActionIcon(item.action)}
              </div>

              {/* History content */}
              <div style={{
                background: '#f7fafc',
                padding: '15px',
                borderRadius: '8px',
                borderLeft: `3px solid ${getActionColor(item.action)}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      color: '#333',
                      fontWeight: '500',
                      marginBottom: '4px'
                    }}>
                      {formatActionText(item)}
                    </div>
                    <div style={{ 
                      fontSize: '0.85em',
                      color: '#666'
                    }}>
                      {formatTime(item.created_at)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.75em',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'white',
                    color: getActionColor(item.action),
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {item.action.replace('_', ' ')}
                  </span>
                </div>

                {item.comment && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: 'white',
                    borderRadius: '6px',
                    fontSize: '0.9em',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    💬 "{item.comment}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
