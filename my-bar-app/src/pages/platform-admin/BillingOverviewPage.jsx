import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function BillingOverviewPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      // Fetch tenants - query all available columns
      // Note: billing_period may not exist yet if SQL migration not run
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          subscription_tier,
          subscription_status,
          stripe_subscription_id,
          stripe_customer_id,
          subscription_end,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (tenantsError) {
        throw tenantsError;
      }

      // Fetch subscription plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('tier, display_name, price_monthly, price_yearly');

      if (plansError) {
        throw plansError;
      }

      // Create a map of plans by tier for easy lookup
      const plansMap = (plansData || []).reduce((acc, plan) => {
        acc[plan.tier] = plan;
        return acc;
      }, {});

      // Transform data to match the component's expected format
      const transformedData = (tenantsData || []).map(tenant => {
        const plan = plansMap[tenant.subscription_tier];
        // Default to monthly if billing_period doesn't exist (before migration)
        const billingPeriod = tenant.billing_period || 'monthly';
        const isYearly = billingPeriod === 'yearly';

        // Calculate next billing date based on billing_period
        let nextBilling = tenant.subscription_end;
        if (!nextBilling && tenant.subscription_status === 'active') {
          const createdDate = new Date(tenant.created_at);
          const nextDate = new Date(createdDate);
          // Add 365 days for yearly, 30 days for monthly
          nextDate.setDate(nextDate.getDate() + (isYearly ? 365 : 30));
          nextBilling = nextDate.toISOString();
        }

        return {
          id: tenant.id,
          tenants: { name: tenant.name },
          plan_name: plan?.display_name || tenant.subscription_tier || 'N/A',
          status: tenant.subscription_status || 'inactive',
          amount: isYearly ? (plan?.price_yearly || 0) : (plan?.price_monthly || 0),
          billing_period: isYearly ? 'Yearly' : 'Monthly',
          current_period_end: nextBilling,
          stripe_subscription_id: tenant.stripe_subscription_id,
          created_at: tenant.created_at,
        };
      });

      setSubscriptions(transformedData);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>💰 Billing Overview</h1>
          <p>Monitor all tenant subscriptions and payments</p>
        </div>

        {loading ? (
          <div className="loading">Loading billing data...</div>
        ) : subscriptions.length === 0 ? (
          <div className="info-box">
            <strong>ℹ️ No Venues Found</strong>
            <p>No tenant venues have been created yet. Billing information will appear here once venues are added to the system.</p>
          </div>
        ) : (
          <>
            <div className="stats-summary" style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div className="stat-card">
                <div className="stat-label">Total Venues</div>
                <div className="stat-value">{subscriptions.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Subscriptions</div>
                <div className="stat-value">{subscriptions.filter(s => s.status === 'active').length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Trial Accounts</div>
                <div className="stat-value">{subscriptions.filter(s => s.status === 'trial').length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total MRR</div>
                <div className="stat-value">
                  R{subscriptions
                    .filter(s => s.status === 'active')
                    .reduce((sum, s) => {
                      const amount = Number(s.amount) || 0;
                      // Yearly subscriptions: divide by 12 for MRR
                      const mrr = s.billing_period === 'Yearly' ? amount / 12 : amount;
                      return sum + mrr;
                    }, 0)
                    .toFixed(2)}
                </div>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Billing Period</th>
                    <th>Amount</th>
                    <th>Next Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.tenants?.name || 'Unknown'}</td>
                      <td>{sub.plan_name || 'N/A'}</td>
                      <td>
                        <span className={`status-badge status-${sub.status}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td>{sub.billing_period || 'Monthly'}</td>
                      <td>R{sub.amount || 0}</td>
                      <td>
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
