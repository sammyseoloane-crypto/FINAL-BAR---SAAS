import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function BottleServicePage() {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBottleOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchBottleOrders = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('bottle_orders')
        .select(`
          *,
          table_reservations!table_reservation_id(
            tables!table_id(name),
            profiles!user_id(full_name, email)
          ),
          bottle_packages(name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching bottle orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('bottle_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) {
        throw error;
      }
      fetchBottleOrders();
      alert(`Order ${newStatus}`);
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order');
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>🍾 Bottle Service</h1>
          <p>Manage bottle service orders</p>
        </div>

        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="info-box">
            <p>No bottle service orders found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Guest</th>
                  <th>Package/Bottle</th>
                  <th>Guest Count</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      {order.table_reservations?.tables?.name || 'N/A'}
                    </td>
                    <td>
                      {order.table_reservations?.profiles?.full_name ||
                        order.table_reservations?.profiles?.email ||
                        'N/A'}
                    </td>
                    <td>{order.bottle_packages?.name || 'Custom Order'}</td>
                    <td>{order.guest_count || 'N/A'}</td>
                    <td>${parseFloat(order.total_amount || 0).toFixed(2)}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'confirmed')}
                            className="btn-success"
                            style={{ marginRight: '5px' }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="btn-primary"
                          >
                            Deliver
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="btn-primary"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </td>
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
