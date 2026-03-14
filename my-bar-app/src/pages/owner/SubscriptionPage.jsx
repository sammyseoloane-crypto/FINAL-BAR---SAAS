import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import './Pages.css';

export default function SubscriptionPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const currentPlan = {
    status: 'active',
    price: 20,
    currency: 'ZAR',
    billingPeriod: '6 months',
    nextBillingDate: '2026-08-17',
    startDate: '2026-02-17',
  };

  const handleUpgrade = () => {
    alert('Upgrade feature coming soon!');
  };

  const handleCancelSubscription = () => {
    if (confirm('Are you sure you want to cancel your subscription?')) {
      alert('Cancellation feature coming soon!');
    }
  };

  return (
    <DashboardLayout title="Subscription Management">
      <div className="page-content">
        <div className="page-header">
          <h2>Subscription & Billing</h2>
          <p>Manage your subscription plan and billing information</p>
        </div>

        <div className="subscription-container">
          {/* Current Plan Card */}
          <div className="card subscription-card">
            <div className="card-header">
              <h3>Current Plan</h3>
              <span className={`status-badge status-${currentPlan.status}`}>
                {currentPlan.status.toUpperCase()}
              </span>
            </div>
            <div className="card-body">
              <div className="plan-price">
                <span className="currency">R</span>
                <span className="amount">{currentPlan.price}</span>
                <span className="period">/ {currentPlan.billingPeriod}</span>
              </div>
              <div className="plan-details">
                <div className="detail-item">
                  <span className="label">Started:</span>
                  <span className="value">
                    {new Date(currentPlan.startDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Next Billing:</span>
                  <span className="value">
                    {new Date(currentPlan.nextBillingDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Auto-renewal:</span>
                  <span className="value">Enabled</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features Card */}
          <div className="card features-card">
            <div className="card-header">
              <h3>Plan Features</h3>
            </div>
            <div className="card-body">
              <ul className="features-list">
                <li>✅ Unlimited locations</li>
                <li>✅ Unlimited staff members</li>
                <li>✅ Unlimited products & events</li>
                <li>✅ QR code payment system</li>
                <li>✅ Task management</li>
                <li>✅ Real-time analytics</li>
                <li>✅ Multi-tenant isolation</li>
                <li>✅ 24/7 support</li>
              </ul>
            </div>
          </div>

          {/* Payment History Card */}
          <div className="card payment-history-card">
            <div className="card-header">
              <h3>Payment History</h3>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>2026-02-17</td>
                    <td>6-month subscription</td>
                    <td>R 20.00</td>
                    <td>
                      <span className="status-badge status-paid">Paid</span>
                    </td>
                  </tr>
                  <tr>
                    <td>2025-08-17</td>
                    <td>6-month subscription</td>
                    <td>R 20.00</td>
                    <td>
                      <span className="status-badge status-paid">Paid</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions Card */}
          <div className="card actions-card">
            <div className="card-header">
              <h3>Manage Subscription</h3>
            </div>
            <div className="card-body">
              <div className="action-buttons">
                <button className="btn btn-primary" onClick={handleUpgrade}>
                  Upgrade Plan
                </button>
                <button className="btn btn-secondary">Update Payment Method</button>
                <button className="btn btn-secondary">Download Invoice</button>
                <button className="btn btn-danger" onClick={handleCancelSubscription}>
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
