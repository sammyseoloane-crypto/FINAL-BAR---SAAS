import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import { TIER_INFO } from '../../utils/subscriptionUtils';
import '../Dashboard.css';

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchPlans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('tier', { ascending: true });

      if (error) {
        throw error;
      }
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlanStatus = async (planId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !currentStatus })
        .eq('id', planId);

      if (error) {
        throw error;
      }
      fetchPlans();
      alert(`Plan ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating plan:', error);
      alert('Failed to update plan');
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const updatedPlan = {
      display_name: formData.get('display_name'),
      price_monthly: parseFloat(formData.get('price_monthly')),
      price_yearly: parseFloat(formData.get('price_yearly')),
      max_locations: parseInt(formData.get('max_locations')),
      max_staff: parseInt(formData.get('max_staff')),
      max_products: parseInt(formData.get('max_products')),
      max_monthly_transactions: parseInt(formData.get('max_monthly_transactions')),
      max_events_per_month: parseInt(formData.get('max_events_per_month')),
      transaction_fee_percentage: parseFloat(formData.get('transaction_fee_percentage')),
    };

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update(updatedPlan)
        .eq('id', editingPlan.id);

      if (error) {
        throw error;
      }

      setShowForm(false);
      setEditingPlan(null);
      fetchPlans();
      alert('Plan updated successfully');
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan');
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      trial: '#718096',
      starter: '#4299e1',
      growth: '#48bb78',
      pro: '#9f7aea',
      enterprise: '#f6ad55',
    };
    return colors[tier] || '#666';
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>💳 Subscription Plans Management</h1>
          <p>Manage pricing tiers and feature limits</p>
        </div>

        {loading ? (
          <div className="loading">Loading plans...</div>
        ) : (
          <>
            <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="plan-card"
                  style={{
                    border: `2px solid ${getTierColor(plan.tier)}`,
                    borderRadius: '12px',
                    padding: '20px',
                    background: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', color: getTierColor(plan.tier) }}>
                        {plan.display_name}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.8em',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: plan.is_active ? '#d4edda' : '#f8d7da',
                          color: plan.is_active ? '#155724' : '#721c24',
                        }}
                      >
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.5em' }}>{TIER_INFO[plan.tier]?.name?.split(' ')[0] || '💎'}</div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '1.8em', fontWeight: 'bold', color: '#333' }}>
                      R{plan.price_monthly?.toLocaleString()}
                      <span style={{ fontSize: '0.5em', fontWeight: 'normal', color: '#666' }}>/month</span>
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                      R{plan.price_yearly?.toLocaleString()}/year
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '15px', marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
                      <strong>Limits:</strong>
                    </div>
                    <ul style={{ fontSize: '0.85em', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
                      <li>📍 {plan.max_locations} location{plan.max_locations > 1 ? 's' : ''}</li>
                      <li>👥 {plan.max_staff} staff members</li>
                      <li>🍺 {plan.max_products} products</li>
                      <li>🎉 {plan.max_events_per_month} events/month</li>
                      <li>💳 {plan.max_monthly_transactions?.toLocaleString()} transactions/month</li>
                      <li>💰 {plan.transaction_fee_percentage}% transaction fee</li>
                    </ul>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="btn-primary"
                      style={{ flex: 1, padding: '8px', fontSize: '0.9em' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePlanStatus(plan.id, plan.is_active)}
                      className={plan.is_active ? 'btn-danger' : 'btn-success'}
                      style={{ flex: 1, padding: '8px', fontSize: '0.9em' }}
                    >
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Form Modal */}
            {showForm && editingPlan && (
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
                }}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '30px',
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                  }}
                >
                  <h2 style={{ marginTop: 0 }}>Edit {editingPlan.display_name}</h2>
                  <form onSubmit={handleSavePlan}>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                        Display Name
                      </label>
                      <input
                        type="text"
                        name="display_name"
                        defaultValue={editingPlan.display_name}
                        required
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                          Monthly Price (ZAR)
                        </label>
                        <input
                          type="number"
                          name="price_monthly"
                          step="0.01"
                          defaultValue={editingPlan.price_monthly}
                          required
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                          Yearly Price (ZAR)
                        </label>
                        <input
                          type="number"
                          name="price_yearly"
                          step="0.01"
                          defaultValue={editingPlan.price_yearly}
                          required
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '15px', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '1.1em', marginBottom: '10px' }}>Usage Limits</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>
                            Max Locations
                          </label>
                          <input
                            type="number"
                            name="max_locations"
                            defaultValue={editingPlan.max_locations}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>
                            Max Staff
                          </label>
                          <input
                            type="number"
                            name="max_staff"
                            defaultValue={editingPlan.max_staff}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>
                            Max Products
                          </label>
                          <input
                            type="number"
                            name="max_products"
                            defaultValue={editingPlan.max_products}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>
                            Max Events/Month
                          </label>
                          <input
                            type="number"
                            name="max_events_per_month"
                            defaultValue={editingPlan.max_events_per_month}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>
                            Max Transactions/Month
                          </label>
                          <input
                            type="number"
                            name="max_monthly_transactions"
                            defaultValue={editingPlan.max_monthly_transactions}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>
                            Transaction Fee %
                          </label>
                          <input
                            type="number"
                            name="transaction_fee_percentage"
                            step="0.01"
                            defaultValue={editingPlan.transaction_fee_percentage}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button type="submit" className="btn-success" style={{ flex: 1, padding: '10px' }}>
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingPlan(null);
                        }}
                        className="btn-danger"
                        style={{ flex: 1, padding: '10px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
