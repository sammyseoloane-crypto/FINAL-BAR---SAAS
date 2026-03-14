/**
 * Manage Products Page - Owner/Admin View
 * CRUD operations for products and specials
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import './Pages.css';

const ManageProductsPage = () => {
  const { userProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [message, setMessage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    type: 'drink',
    is_special: false,
    description: '',
    image_url: '',
    available: true,
  });

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchProducts = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('name');

      if (error) {
        throw error;
      }
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setMessage({ type: 'error', text: 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select an image file' });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image must be less than 5MB' });
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) {
      return formData.image_url;
    } // Return existing URL if no new file

    try {
      setUploading(true);

      // Create unique filename
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userProfile.tenant_id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase storage
      const { error } = await supabase.storage.from('Product').upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('Product').getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setUploading(true);

      // Upload image if new file selected
      let imageUrl = formData.image_url;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const productData = {
        ...formData,
        image_url: imageUrl,
        tenant_id: userProfile.tenant_id,
        price: parseFloat(formData.price),
      };

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
          .eq('tenant_id', userProfile.tenant_id);

        if (error) {
          throw error;
        }
        setMessage({ type: 'success', text: 'Product updated successfully' });
      } else {
        // Create new product
        const { error } = await supabase.from('products').insert([productData]);

        if (error) {
          throw error;
        }
        setMessage({ type: 'success', text: 'Product created successfully' });
      }

      fetchProducts();
      closeModal();
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error saving product:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save product' });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      type: product.type,
      is_special: product.is_special,
      description: product.description || '',
      image_url: product.image_url || '',
      available: product.available,
    });
    setImageFile(null);
    setImagePreview(product.image_url || '');
    setShowModal(true);
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', userProfile.tenant_id);

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'Product deleted successfully' });
      fetchProducts();
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error deleting product:', error);
      setMessage({ type: 'error', text: 'Failed to delete product' });
    }
  };

  const handleToggleAvailable = async (product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ available: !product.available })
        .eq('id', product.id)
        .eq('tenant_id', userProfile.tenant_id);

      if (error) {
        throw error;
      }

      fetchProducts();
    } catch (error) {
      console.error('Error toggling product availability:', error);
      setMessage({ type: 'error', text: 'Failed to update product' });
    }
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      type: 'drink',
      is_special: false,
      description: '',
      image_url: '',
      available: true,
    });
    setImageFile(null);
    setImagePreview('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview('');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading products...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
          }}
        >
          <div>
            <h1 style={{ marginBottom: '10px' }}>Manage Products</h1>
            <p style={{ color: '#666', margin: 0 }}>
              Add, edit, and manage your products and specials
            </p>
          </div>
          <button
            onClick={openNewProductModal}
            className="btn btn-primary"
          >
            + Add Product
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              padding: '12px',
              marginBottom: '20px',
              borderRadius: '8px',
              background: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24',
              border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            }}
          >
            {message.text}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              Total Products
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#d4af37' }}>
              {products.length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Specials</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#f6ad55' }}>
              {products.filter((p) => p.is_special).length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Available</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#48bb78' }}>
              {products.filter((p) => p.available).length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Unavailable</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#e53e3e' }}>
              {products.filter((p) => !p.available).length}
            </div>
          </div>
        </div>

        {/* Products grid */}
        {products.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#f7fafc',
              borderRadius: '12px',
            }}
          >
            <p style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>No products yet</p>
            <p style={{ fontSize: '14px', color: '#999' }}>
              Click &quot;Add Product&quot; to create your first product
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 110px 140px 120px 120px 200px',
                padding: '16px 20px',
                background: '#f7fafc',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: '600',
                fontSize: '14px',
                color: '#4a5568',
              }}
            >
              <div>Product</div>
              <div>Price</div>
              <div>Type</div>
              <div>Status</div>
              <div>Special</div>
              <div>Actions</div>
            </div>

            {/* Table rows */}
            {products.map((product) => (
              <div
                key={product.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px 140px 120px 120px 200px',
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{product.name}</div>
                  {product.description && (
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {product.description.substring(0, 50)}
                      {product.description.length > 50 ? '...' : ''}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '16px', fontWeight: '700', color: '#d4af37' }}>
                  R{parseFloat(product.price).toFixed(2)}
                </div>

                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      borderRadius: '6px',
                      background: product.type === 'drink' ? '#bee3f8' : '#fbd38d',
                      color: product.type === 'drink' ? '#2c5282' : '#7c2d12',
                    }}
                  >
                    {product.type}
                  </span>
                </div>

                <div>
                  <button
                    onClick={() => handleToggleAvailable(product)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: product.available ? '#d4edda' : '#f8d7da',
                      color: product.available ? '#155724' : '#721c24',
                    }}
                  >
                    {product.available ? 'Available' : 'Unavailable'}
                  </button>
                </div>

                <div>
                  {product.is_special && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '12px',
                        background: '#f6ad55',
                        color: '#fff',
                      }}
                    >
                      ⭐ Special
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEdit(product)}
                    className="btn btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product Form Modal */}
        {showModal && (
          <div
            style={{
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
              padding: '20px',
            }}
            onClick={closeModal}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '30px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: '20px' }}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Price (R) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  >
                    <option value="drink">Drink</option>
                    <option value="food">Food</option>
                    <option value="entrance_fee">Entrance Fee</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  />
                  {imagePreview && (
                    <div style={{ marginTop: '10px' }}>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        style={{
                          maxWidth: '200px',
                          maxHeight: '200px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                    </div>
                  )}
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Max file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_special}
                      onChange={(e) => setFormData({ ...formData, is_special: e.target.checked })}
                      style={{ marginRight: '8px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600' }}>Mark as Special</span>
                  </label>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.available}
                      onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                      style={{ marginRight: '8px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600' }}>Available for Purchase</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      background: uploading ? '#a0aec0' : undefined,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {uploading
                      ? 'Uploading...'
                      : editingProduct
                        ? 'Update Product'
                        : 'Create Product'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={uploading}
                    className="btn btn-secondary"
                    style={{
                      flex: 1,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ManageProductsPage;
