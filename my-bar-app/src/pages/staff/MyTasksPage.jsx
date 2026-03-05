import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import TaskComments from '../../components/TaskComments'
import TaskHistory from '../../components/TaskHistory'
import '../owner/Pages.css'

export default function MyTasksPage() {
  const { user, userProfile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    fetchMyTasks()
  }, [])

  const fetchMyTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, locations(name)')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      fetchMyTasks()
    } catch (error) {
      alert('Error updating task: ' + error.message)
    }
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#ff9800',
      urgent: '#dc3545'
    }
    return colors[priority] || '#666'
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>My Tasks</h2>
          <p>Tasks assigned to you</p>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3>No tasks assigned</h3>
            <p>You have no tasks at the moment</p>
          </div>
        ) : (
          <>
            {/* Pending Tasks */}
            <div className="card">
              <div className="card-header">
                <h3>⏳ Pending Tasks ({tasks.filter(t => t.status === 'pending').length})</h3>
              </div>
              <div className="card-body">
                {tasks.filter(t => t.status === 'pending').length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666' }}>No pending tasks</p>
                ) : (
                  <div className="grid-2">
                    {tasks.filter(t => t.status === 'pending').map((task) => (
                      <div key={task.id} className="card" style={{ border: isOverdue(task.due_date) ? '2px solid #dc3545' : '1px solid #e0e0e0' }}>
                        <div className="card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75em',
                              fontWeight: 'bold',
                              color: 'white',
                              backgroundColor: getPriorityColor(task.priority)
                            }}>
                              {task.priority}
                            </span>
                            {isOverdue(task.due_date) && (
                              <span style={{ color: '#dc3545', fontSize: '0.85em', fontWeight: 'bold' }}>
                                ⚠️ OVERDUE
                              </span>
                            )}
                          </div>
                          <h4>{task.title}</h4>
                          {task.description && <p style={{ fontSize: '0.9em', color: '#666' }}>{task.description}</p>}
                          <div style={{ marginTop: '10px', fontSize: '0.85em', color: '#666' }}>
                            <div>📍 {task.locations?.name || 'Any location'}</div>
                            {task.due_date && <div>📅 Due: {new Date(task.due_date).toLocaleString()}</div>}
                          </div>
                          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1 }}
                              onClick={() => updateStatus(task.id, 'in_progress')}
                            >
                              Start Task
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setSelectedTask(task)
                                setShowDetailModal(true)
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* In Progress Tasks */}
            <div className="card">
              <div className="card-header">
                <h3>🚀 In Progress ({tasks.filter(t => t.status === 'in_progress').length})</h3>
              </div>
              <div className="card-body">
                {tasks.filter(t => t.status === 'in_progress').length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666' }}>No tasks in progress</p>
                ) : (
                  <div className="grid-2">
                    {tasks.filter(t => t.status === 'in_progress').map((task) => (
                      <div key={task.id} className="card" style={{ borderLeft: '4px solid #667eea' }}>
                        <div className="card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75em',
                              fontWeight: 'bold',
                              color: 'white',
                              backgroundColor: getPriorityColor(task.priority)
                            }}>
                              {task.priority}
                            </span>
                          </div>
                          <h4>{task.title}</h4>
                          {task.description && <p style={{ fontSize: '0.9em', color: '#666' }}>{task.description}</p>}
                          <div style={{ marginTop: '10px', fontSize: '0.85em', color: '#666' }}>
                            <div>📍 {task.locations?.name || 'Any location'}</div>
                            {task.due_date && <div>📅 Due: {new Date(task.due_date).toLocaleString()}</div>}
                          </div>
                          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                            <button
                              className="btn btn-success"
                              style={{ flex: 1 }}
                              onClick={() => updateStatus(task.id, 'completed')}
                            >
                              ✓ Complete
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => updateStatus(task.id, 'pending')}
                            >
                              Pause
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setSelectedTask(task)
                                setShowDetailModal(true)
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            {tasks.filter(t => t.status === 'completed').length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>✓ Completed ({tasks.filter(t => t.status === 'completed').length})</h3>
                </div>
                <div className="card-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Priority</th>
                        <th>Location</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.filter(t => t.status === 'completed').map((task) => (
                        <tr key={task.id}>
                          <td>{task.title}</td>
                          <td>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75em',
                              fontWeight: 'bold',
                              color: 'white',
                              backgroundColor: getPriorityColor(task.priority)
                            }}>
                              {task.priority}
                            </span>
                          </td>
                          <td>{task.locations?.name || 'Any'}</td>
                          <td>{new Date(task.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        {/* Task Detail Modal */}
        {showDetailModal && selectedTask && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                position: 'sticky',
                top: 0,
                background: 'white',
                zIndex: 1
              }}>
                <div>
                  <h3 style={{ margin: '0 0 10px 0' }}>{selectedTask.title}</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85em',
                      fontWeight: 'bold',
                      color: 'white',
                      backgroundColor: getPriorityColor(selectedTask.priority)
                    }}>
                      {selectedTask.priority}
                    </span>
                    <span className={`status-badge status-${selectedTask.status}`}>
                      {selectedTask.status}
                    </span>
                    {isOverdue(selectedTask.due_date) && (
                      <span style={{ color: '#dc3545', fontSize: '0.85em', fontWeight: 'bold' }}>
                        ⚠️ OVERDUE
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5em',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ padding: '20px' }}>
                {selectedTask.description && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#666', marginBottom: '8px' }}>Description</h4>
                    <p style={{ lineHeight: '1.6' }}>{selectedTask.description}</p>
                  </div>
                )}

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '15px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <strong style={{ color: '#666' }}>Location:</strong>
                    <div>📍 {selectedTask.locations?.name || 'Any location'}</div>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>Due Date:</strong>
                    <div>📅 {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleString() : 'No deadline'}</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                  {selectedTask.status === 'pending' && (
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        updateStatus(selectedTask.id, 'in_progress')
                        setShowDetailModal(false)
                      }}
                    >
                      🚀 Start Task
                    </button>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <>
                      <button
                        className="btn btn-success"
                        style={{ flex: 1 }}
                        onClick={() => {
                          updateStatus(selectedTask.id, 'completed')
                          setShowDetailModal(false)
                        }}
                      >
                        ✓ Mark Complete
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          updateStatus(selectedTask.id, 'pending')
                          setShowDetailModal(false)
                        }}
                      >
                        Pause
                      </button>
                    </>
                  )}
                </div>

                <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                {/* Task Comments */}
                <TaskComments taskId={selectedTask.id} />

                <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                {/* Task History */}
                <TaskHistory taskId={selectedTask.id} />
              </div>
            </div>
          </div>
        )}      </div>
    </DashboardLayout>
  )
}
