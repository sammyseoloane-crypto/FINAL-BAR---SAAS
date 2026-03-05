import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import './Pages.css'

export default function LocationsPage() {
  const { userProfile } = useAuth()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', address: '' })

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('locations')
        .insert([{
          tenant_id: userProfile.tenant_id,
          name: formData.name,
          address: formData.address
        }])

      if (error) throw error
      
      setFormData({ name: '', address: '' })
      setShowForm(false)
      fetchLocations()
    } catch (error) {
      alert('Error creating location: ' + error.message)
    }
  }

  const handleEdit = (location) => {
    setEditingId(location.id)
    setFormData({
      name: location.name,
      address: location.address || ''
    })
    setShowForm(false) // Close new location form if open
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('locations')
        .update({
          name: formData.name,
          address: formData.address
        })
        .eq('id', editingId)

      if (error) throw error

      alert('Location updated successfully!')
      setEditingId(null)
      setFormData({ name: '', address: '' })
      fetchLocations()
    } catch (error) {
      alert('Error updating location: ' + error.message)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({ name: '', address: '' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this location?')) return

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchLocations()
    } catch (error) {
      alert('Error deleting location: ' + error.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Location Management</h2>
          <p>Manage your bar locations</p>
        </div>

        <div className="action-bar">
          <div className="search-bar">
            <input type="text" placeholder="Search locations..." />
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            + Add Location
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3>New Location</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Location Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Create Location</button>
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
              <h3>Edit Location</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>Location Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Update Location</button>
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
        ) : locations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <h3>No locations yet</h3>
            <p>Add your first location to get started</p>
          </div>
        ) : (
          <div className="grid-2">
            {locations.map((location) => (
              <div key={location.id} className="card">
                <div className="card-header">
                  <h3>{location.name}</h3>
                </div>
                <div className="card-body">
                  <p><strong>Address:</strong> {location.address || 'Not specified'}</p>
                  <p><strong>Created:</strong> {new Date(location.created_at).toLocaleDateString()}</p>
                  <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => handleEdit(location)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(location.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
