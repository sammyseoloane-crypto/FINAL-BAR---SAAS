import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import TaskStatistics from '../../components/TaskStatistics'
import TaskComments from '../../components/TaskComments'
import TaskHistory from '../../components/TaskHistory'
import './Pages.css'

export default function TasksPage() {
  const { userProfile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [staff, setStaff] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    assigned_to: '',
    location_id: '',
    due_date: ''
  })
  const [selectedTask, setSelectedTask] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchTasks()
    fetchStaff()
    fetchLocations()
  }, [])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, users(email), locations(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('tenant_id', userProfile.tenant_id)
        .in('role', ['staff', 'admin'])

      if (error) throw error
      setStaff(data || [])
    } catch (error) {
      console.error('Error fetching staff:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('tenant_id', userProfile.tenant_id)

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('tasks')
        .insert([{
          tenant_id: userProfile.tenant_id,
          ...formData
        }])

      if (error) throw error
      
      setFormData({ title: '', description: '', priority: 'medium', status: 'pending', assigned_to: '', location_id: '', due_date: '' })
      setShowForm(false)
      fetchTasks()
    } catch (error) {
      alert('Error creating task: ' + error.message)
    }
  }

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      fetchTasks()
    } catch (error) {
      alert('Error updating task: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchTasks()
    } catch (error) {
      alert('Error deleting task: ' + error.message)
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

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Task Management</h2>
          <p>Assign and track tasks for your team</p>
        </div>

        {/* Task Statistics */}
        <TaskStatistics />

        <div className="action-bar">
          <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '6px'
              }}
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                background: 'white'
              }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            + Create Task
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3>New Task</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Assign To</label>
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    >
                      <option value="">Unassigned</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>{member.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({...formData, location_id: e.target.value})}
                    >
                      <option value="">Any location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Due Date</label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Create Task</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3>No tasks yet</h3>
            <p>Create your first task</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assigned To</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks
                    .filter(task => {
                      const matchesStatus = filterStatus === 'all' || task.status === filterStatus
                      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                          task.description?.toLowerCase().includes(searchQuery.toLowerCase())
                      return matchesStatus && matchesSearch
                    })
                    .map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.description && <div style={{ fontSize: '0.85em', color: '#666' }}>{task.description}</div>}
                      </td>
                      <td>{task.users?.email || 'Unassigned'}</td>
                      <td>{task.locations?.name || 'Any'}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          color: 'white',
                          backgroundColor: getPriorityColor(task.priority)
                        }}>
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        <select
                          value={task.status}
                          onChange={(e) => updateStatus(task.id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.85em' }}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.85em' }}
                            onClick={() => {
                              setSelectedTask(task)
                              setShowDetailModal(true)
                            }}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '0.85em' }}
                            onClick={() => handleDelete(task.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                    <strong style={{ color: '#666' }}>Assigned To:</strong>
                    <div>{selectedTask.users?.email || 'Unassigned'}</div>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>Location:</strong>
                    <div>{selectedTask.locations?.name || 'Any location'}</div>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>Due Date:</strong>
                    <div>{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleString() : 'No deadline'}</div>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>Created:</strong>
                    <div>{new Date(selectedTask.created_at).toLocaleString()}</div>
                  </div>
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
        )}
      </div>
    </DashboardLayout>
  )
}
