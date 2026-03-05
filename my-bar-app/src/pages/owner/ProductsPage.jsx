import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import './Pages.css'

export default function ProductsPage() {
  const { userProfile } = useAuth()
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    type: 'drink',
    description: '',
    location_id: '',
    is_special: false,
    available: true
  })

  useEffect(() => {
    fetchProducts()
    fetchLocations()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, locations(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const { data, error} = await supabase
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
        .from('products')
        .insert([{
          tenant_id: userProfile.tenant_id,
          ...formData,
          price: parseFloat(formData.price)
        }])

      if (error) throw error
      
      setFormData({ name: '', price: '', type: 'drink', description: '', location_id: '', is_special: false, available: true })
      setShowForm(false)
      fetchProducts()
    } catch (error) {
      alert('Error creating product: ' + error.message)
    }
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    setFormData({
      name: product.name,
      price: product.price.toString(),
      type: product.type,
      description: product.description || '',
      location_id: product.location_id || '',
      is_special: product.is_special,
      available: product.available
    })
    setShowForm(false) // Close new product form if open
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          price: parseFloat(formData.price),
          type: formData.type,
          description: formData.description,
          location_id: formData.location_id || null,
          is_special: formData.is_special,
          available: formData.available
        })
        .eq('id', editingId)

      if (error) throw error

      alert('Product updated successfully!')
      setEditingId(null)
      setFormData({ name: '', price: '', type: 'drink', description: '', location_id: '', is_special: false, available: true })
      fetchProducts()
    } catch (error) {
      alert('Error updating product: ' + error.message)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({ name: '', price: '', type: 'drink', description: '', location_id: '', is_special: false, available: true })
  }

  const toggleAvailable = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ available: !currentStatus })
        .eq('id', id)

      if (error) throw error
      fetchProducts()
    } catch (error) {
      alert('Error updating product: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchProducts()
    } catch (error) {
      alert('Error deleting product: ' + error.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Product Management</h2>
          <p>Manage your menu items</p>
        </div>

        <div className="action-bar">
          <div className="search-bar">
            <input type="text" placeholder="Search products..." />
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            + Add Product
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3>New Product</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Price (R) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="drink">Drink</option>
                      <option value="food">Food</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({...formData, location_id: e.target.value})}
                    >
                      <option value="">All locations</option>
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
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_special}
                      onChange={(e) => setFormData({...formData, is_special: e.target.checked})}
                    />
                    {' '}Special item
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Add Product</button>
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
              <h3>Edit Product</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdate}>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Price (R) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="drink">Drink</option>
                      <option value="food">Food</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <select
                      value={formData.location_id}
                      onChange={(e) => setFormData({...formData, location_id: e.target.value})}
                    >
                      <option value="">All locations</option>
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
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_special}
                      onChange={(e) => setFormData({...formData, is_special: e.target.checked})}
                    />
                    {' '}Special item
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Update Product</button>
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
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍺</div>
            <h3>No products yet</h3>
            <p>Add your first menu item</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Location</th>
                    <th>Special</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>
                        <span className="status-badge status-active">
                          {product.type}
                        </span>
                      </td>
                      <td>R {product.price}</td>
                      <td>{product.locations?.name || 'All'}</td>
                      <td>{product.is_special ? '⭐' : '-'}</td>
                      <td>
                        <span className={`status-badge status-${product.available ? 'active' : 'inactive'}`}>
                          {product.available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ marginRight: '5px', padding: '5px 10px', fontSize: '0.85em' }}
                          onClick={() => handleEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ marginRight: '5px', padding: '5px 10px', fontSize: '0.85em' }}
                          onClick={() => toggleAvailable(product.id, product.available)}
                        >
                          Toggle
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '5px 10px', fontSize: '0.85em' }}
                          onClick={() => handleDelete(product.id)}
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
