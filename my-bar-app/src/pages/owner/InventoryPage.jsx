import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import './Pages.css';

export default function InventoryPage() {
  const { userProfile } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState('overview'); // 'overview', 'movements', 'low-stock'

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadInventoryData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  async function loadInventoryData() {
    try {
      setLoading(true);
      setError(null);

      // Load inventory with product details
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select(`
          *,
          products (
            id,
            name,
            type,
            price,
            image_url
          ),
          locations (
            id,
            name
          )
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .order('current_stock', { ascending: true });

      if (invError) {
        throw invError;
      }

      setInventory(inventoryData || []);

      // Load recent stock movements
      const { data: movementsData, error: movError } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products (name),
          performed_by:auth.users!performed_by (email)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (movError) {
        throw movError;
      }

      setStockMovements(movementsData || []);

    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStock(inventoryId, newStock) {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ current_stock: newStock })
        .eq('id', inventoryId);

      if (error) {
        throw error;
      }

      await loadInventoryData();
    } catch (err) {
      console.error('Error updating stock:', err);
      alert(`Failed to update stock: ${err.message}`);
    }
  }

  const lowStockItems = inventory.filter(
    (item) => item.current_stock <= item.minimum_stock,
  );

  const totalValue = inventory.reduce(
    (sum, item) => sum + (item.current_stock * (item.cost_per_unit || 0)),
    0,
  );

  if (loading) {
    return (
      <DashboardLayout role="owner">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading inventory...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="owner">
      <div className="page-container">
        <div className="page-header">
          <h1>📦 Inventory Management</h1>
          <div className="header-actions">
            <button className="btn-primary" onClick={loadInventoryData}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <h3>{inventory.length}</h3>
              <p>Total Products</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <h3>{lowStockItems.length}</h3>
              <p>Low Stock Items</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <h3>R{totalValue.toFixed(2)}</h3>
              <p>Total Inventory Value</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stockMovements.length}</h3>
              <p>Recent Movements</p>
            </div>
          </div>
        </div>

        {/* View Selector */}
        <div className="view-selector">
          <button
            className={selectedView === 'overview' ? 'active' : ''}
            onClick={() => setSelectedView('overview')}
          >
            📦 Overview
          </button>
          <button
            className={selectedView === 'low-stock' ? 'active' : ''}
            onClick={() => setSelectedView('low-stock')}
          >
            ⚠️ Low Stock
          </button>
          <button
            className={selectedView === 'movements' ? 'active' : ''}
            onClick={() => setSelectedView('movements')}
          >
            📊 Stock Movements
          </button>
        </div>

        {/* Inventory Overview */}
        {selectedView === 'overview' && (
          <div className="inventory-grid">
            {inventory.map((item) => (
              <div key={item.id} className="inventory-card">
                <div className="inventory-header">
                  {item.products?.image_url && (
                    <img src={item.products.image_url} alt={item.products?.name} />
                  )}
                  <h3>{item.products?.name || 'Unknown Product'}</h3>
                  <span className={`stock-badge ${item.current_stock <= item.minimum_stock ? 'low' : 'good'}`}>
                    {item.current_stock <= item.minimum_stock ? '⚠️ Low' : '✅ Good'}
                  </span>
                </div>

                <div className="inventory-details">
                  <div className="detail-row">
                    <span>Current Stock:</span>
                    <strong>{item.current_stock} {item.unit_of_measure}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Minimum Stock:</span>
                    <span>{item.minimum_stock} {item.unit_of_measure}</span>
                  </div>
                  {item.cost_per_unit && (
                    <div className="detail-row">
                      <span>Value:</span>
                      <span>R{(item.current_stock * item.cost_per_unit).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span>Location:</span>
                    <span>{item.locations?.name || 'N/A'}</span>
                  </div>
                </div>

                <div className="inventory-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const newStock = prompt(`Update stock for ${item.products?.name}:`, item.current_stock);
                      if (newStock !== null) {
                        updateStock(item.id, parseFloat(newStock));
                      }
                    }}
                  >
                    Update Stock
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Low Stock View */}
        {selectedView === 'low-stock' && (
          <div className="low-stock-list">
            {lowStockItems.length === 0 ? (
              <div className="empty-state">
                <p>✅ No low stock items!</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Minimum Stock</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.id} className="alert-row">
                      <td>{item.products?.name}</td>
                      <td className="text-danger">
                        {item.current_stock} {item.unit_of_measure}
                      </td>
                      <td>{item.minimum_stock} {item.unit_of_measure}</td>
                      <td>{item.locations?.name || 'N/A'}</td>
                      <td>
                        <button
                          className="btn-sm btn-primary"
                          onClick={() => {
                            const newStock = prompt(`Restock ${item.products?.name}:`, item.minimum_stock * 2);
                            if (newStock !== null) {
                              updateStock(item.id, parseFloat(newStock));
                            }
                          }}
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Stock Movements View */}
        {selectedView === 'movements' && (
          <div className="movements-list">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{new Date(movement.created_at).toLocaleString()}</td>
                    <td>{movement.products?.name}</td>
                    <td>
                      <span className={`badge badge-${movement.movement_type}`}>
                        {movement.movement_type}
                      </span>
                    </td>
                    <td className={movement.quantity < 0 ? 'text-danger' : 'text-success'}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </td>
                    <td>{movement.previous_stock}</td>
                    <td>{movement.new_stock}</td>
                    <td>{movement.performed_by?.email || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
