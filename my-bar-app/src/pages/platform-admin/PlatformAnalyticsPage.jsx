import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function PlatformAnalyticsPage() {
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
  });

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchPlatformStats = async () => {
    try {
      // Fetch tenants count
      const { count: tenantsCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      // Fetch users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch active subscriptions count (from tenants table)
      const { count: activeCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active');

      // Fetch trial subscriptions count
      const { count: trialCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'trial');

      // Calculate revenue from active tenants
      // Note: billing_period may not exist yet if SQL migration not run
      const { data: activeTenants } = await supabase
        .from('tenants')
        .select(`
          subscription_tier
        `)
        .eq('subscription_status', 'active');

      // Get subscription plans for revenue calculation
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('tier, price_monthly, price_yearly');

      const plansMap = (plansData || []).reduce((acc, plan) => {
        acc[plan.tier] = {
          monthly: plan.price_monthly || 0,
          yearly: plan.price_yearly || 0,
        };
        return acc;
      }, {});

      // Calculate MRR (Monthly Recurring Revenue)
      // Default to monthly pricing since billing_period doesn't exist yet
      const totalRevenue = (activeTenants || []).reduce((sum, tenant) => {
        const prices = plansMap[tenant.subscription_tier];
        if (!prices) {
          return sum;
        }

        // Use monthly price for MRR calculation
        // TODO: After billing_period migration, check tenant.billing_period
        // and divide yearly by 12 for accurate MRR
        return sum + Number(prices.monthly);
      }, 0);

      setStats({
        totalTenants: tenantsCount || 0,
        totalUsers: usersCount || 0,
        totalRevenue: totalRevenue,
        activeSubscriptions: activeCount || 0,
        trialSubscriptions: trialCount || 0,
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📊 Platform Analytics</h1>
          <p>System-wide performance metrics</p>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalTenants}</div>
              <div className="stat-label">Total Venues</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Total Users</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">R{stats.totalRevenue.toFixed(2)}</div>
              <div className="stat-label">Monthly Recurring Revenue</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💳</div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeSubscriptions}</div>
              <div className="stat-label">Active Subscriptions</div>
            </div>
          </div>
        </div>

        <div className="dashboard-stats" style={{ marginTop: '20px' }}>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <div className="stat-value">{stats.trialSubscriptions}</div>
              <div className="stat-label">Trial Accounts</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-value">
                {stats.totalTenants > 0
                  ? ((stats.activeSubscriptions / stats.totalTenants) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="stat-label">Conversion Rate</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💵</div>
            <div className="stat-content">
              <div className="stat-value">
                R{stats.activeSubscriptions > 0
                  ? (stats.totalRevenue / stats.activeSubscriptions).toFixed(2)
                  : 0}
              </div>
              <div className="stat-label">Avg Revenue Per User</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-content">
              <div className="stat-value">
                {stats.totalTenants > 0
                  ? (stats.totalUsers / stats.totalTenants).toFixed(1)
                  : 0}
              </div>
              <div className="stat-label">Avg Users Per Venue</div>
            </div>
          </div>
        </div>

        <div className="info-box" style={{ marginTop: '30px' }}>
          <strong>📈 Platform Health Summary</strong>
          <ul style={{ marginTop: '10px', lineHeight: '1.8' }}>
            <li>
              <strong>Total Venues:</strong> {stats.totalTenants} venues registered on the platform
            </li>
            <li>
              <strong>Active Subscriptions:</strong> {stats.activeSubscriptions} paying customers
              ({stats.totalTenants > 0
                ? ((stats.activeSubscriptions / stats.totalTenants) * 100).toFixed(1)
                : 0}% conversion)
            </li>
            <li>
              <strong>Trial Accounts:</strong> {stats.trialSubscriptions} venues in trial period
            </li>
            <li>
              <strong>Monthly Revenue:</strong> R{stats.totalRevenue.toFixed(2)} MRR from active subscriptions
            </li>
            <li>
              <strong>Platform Users:</strong> {stats.totalUsers} total users across all venues
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
