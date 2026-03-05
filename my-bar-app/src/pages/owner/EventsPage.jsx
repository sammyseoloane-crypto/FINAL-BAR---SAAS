import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import './Pages.css'

export default function EventsPage() {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entry_fee: '',
    date: '',
    location_id: '',
    active: true
  })

  useEffect(() => {
    fetchEvents()
    fetchLocations()
  }, [])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, locations(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('date', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
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
        .from('events')
        .insert([{
          tenant_id: userProfile.tenant_id,
          ...formData,
          entry_fee: parseFloat(formData.entry_fee) || 0
        }])

      if (error) throw error
      
      setFormData({ name: '', description: '', entry_fee: '', date: '', location_id: '', active: true })
      setShowForm(false)
      fetchEvents()
    } catch (error) {
      alert('Error creating event: ' + error.message)
    }
  }

  const handleEdit = (event) => {
    setEditingId(event.id)
    setFormData({
      name: event.name,
      description: event.description || '',
      entry_fee: event.entry_fee.toString(),
      date: event.date,
      location_id: event.location_id || '',
      active: event.active
    })
    setShowForm(false) // Close new event form if open
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('events')
        .update({
          name: formData.name,
          description: formData.description,
          entry_fee: parseFloat(formData.entry_fee) || 0,
          date: formData.date,
          location_id: formData.location_id || null,
          active: formData.active
        })
        .eq('id', editingId)

      if (error) throw error

      alert('Event updated successfully!')
      setEditingId(null)
      setFormData({ name: '', description: '', entry_fee: '', date: '', location_id: '', active: true })
      fetchEvents()
    } catch (error) {
      alert('Error updating event: ' + error.message)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({ name: '', description: '', entry_fee: '', date: '', location_id: '', active: true })
  }

  const toggleActive = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      fetchEvents()
    } catch (error) {
      alert('Error updating event: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchEvents()
    } catch (error) {
      alert('Error deleting event: ' + error.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Event Management</h2>
          <p>Create and manage bar events</p>
        </div>

        <div className="action-bar">
          <div className="search-bar">
            <input type="text" placeholder="Search events..." />
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            + Create Event
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3>New Event</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Event Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({...formData, location_id: e.target.value})}
                    >
                      <option value="">Select location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
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
                    <label>Entry Fee (R)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.entry_fee}
                      onChange={(e) => setFormData({...formData, entry_fee: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Event Date *</label>
                    <input
                      type="datetime-local"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    />
                    {' '}Active (visible to customers)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Create Event</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingId && (
          <div className="card">
            <div className="card-header">
              <h3>Edit Event</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdate}>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Event Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({...formData, location_id: e.target.value})}
                    >
                      <option value="">Select location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
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
                    <label>Entry Fee (R)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.entry_fee}
                      onChange={(e) => setFormData({...formData, entry_fee: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Event Date *</label>
                    <input
                      type="datetime-local"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    />
                    {' '}Active (visible to customers)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Update Event</button>
                  <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <h3>No events yet</h3>
            <p>Create your first event to attract customers</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event Name</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Entry Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.name}</td>
                      <td>{event.locations?.name || 'All locations'}</td>
                      <td>{new Date(event.date).toLocaleString()}</td>
                      <td>R {event.entry_fee}</td>
                      <td>
                        <span className={`status-badge status-${event.active ? 'active' : 'inactive'}`}>
                          {event.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ marginRight: '5px', padding: '5px 10px', fontSize: '0.85em' }}
                          onClick={() => handleEdit(event)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ marginRight: '5px', padding: '5px 10px', fontSize: '0.85em' }}
                          onClick={() => toggleActive(event.id, event.active)}
                        >
                          {event.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '5px 10px', fontSize: '0.85em' }}
                          onClick={() => handleDelete(event.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
