import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../owner/Pages.css';

export default function PlatformRevenueStreamsPage() {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({
    vipDepositFees: 0,
    transactionFees: 0,
    totalFees: 0,
    feeCount: 0,
  });
  const [topTenants, setTopTenants] = useState([]);
  const [dateRange, setDateRange] = useState('30');

  const loadRevenueData = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      // Get platform fee revenue
      const { data: revenue, error } = await supabase.rpc('get_platform_fee_revenue', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: new Date().toISOString().split('T')[0],
      });

      if (error) {
        throw error;
      }

      // Calculate totals
      let vipFees = 0;
      let txFees = 0;
      let total = 0;
      let count = 0;

      revenue?.forEach((item) => {
        if (item.fee_type === 'vip_deposit') {
          vipFees = parseFloat(item.total_fees || 0);
          count += parseInt(item.fee_count || 0);
        }
        if (item.fee_type === 'transaction') {
          txFees = parseFloat(item.total_fees || 0);
          count += parseInt(item.fee_count || 0);
        }
        total += parseFloat(item.total_fees || 0);
      });

      setRevenueData({
        vipDepositFees: vipFees,
        transactionFees: txFees,
        totalFees: total,
        feeCount: count,
      });

      // Get top tenants by fees
      const { data: tenants, error: tenantsError } = await supabase.rpc(
        'get_platform_fees_by_tenant',
        {
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: new Date().toISOString().split('T')[0],
        },
      );

      if (tenantsError) {
        throw tenantsError;
      }
      setTopTenants(tenants || []);
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenueData();
  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>💰 Platform Revenue Streams</h2>
          <p>Hidden revenue from VIP deposits and transaction fees</p>
        </div>

        {/* Date Range Filter */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Time Period:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px',
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>

        {loading ? (
          <div>Loading revenue data...</div>
        ) : (
          <>
            {/* Revenue Summary Cards */}
            <div className="stats-grid">
              <div className="stat-card" style={{ borderLeft: '4px solid #d4af37' }}>
                <div className="stat-value" style={{ color: '#d4af37' }}>
                  R {revenueData.totalFees.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </div>
                <div className="stat-label">Total Platform Revenue</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #48bb78' }}>
                <div className="stat-value" style={{ color: '#48bb78' }}>
                  R{' '}
                  {revenueData.vipDepositFees.toLocaleString('en-ZA', {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="stat-label">VIP Deposit Fees (5%)</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #4299e1' }}>
                <div className="stat-value" style={{ color: '#4299e1' }}>
                  R{' '}
                  {revenueData.transactionFees.toLocaleString('en-ZA', {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="stat-label">Transaction Fees</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #9f7aea' }}>
                <div className="stat-value" style={{ color: '#9f7aea' }}>
                  {revenueData.feeCount.toLocaleString()}
                </div>
                <div className="stat-label">Total Fee Transactions</div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="card" style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '15px' }}>💡 Revenue Breakdown</h3>
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px',
                    marginBottom: '15px',
                  }}
                >
                  <div>
                    <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                      <strong>VIP Deposit Fees:</strong>
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '24px', color: '#48bb78' }}>
                      R{' '}
                      {revenueData.vipDepositFees.toLocaleString('en-ZA', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '12px', color: '#999' }}>
                      Automatic 5% on all VIP table deposits
                    </p>
                  </div>

                  <div>
                    <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                      <strong>Transaction Fees:</strong>
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '24px', color: '#4299e1' }}>
                      R{' '}
                      {revenueData.transactionFees.toLocaleString('en-ZA', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '12px', color: '#999' }}>
                      Tier-based fees: 1% - 5%
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '15px',
                    marginTop: '15px',
                  }}
                >
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                    <strong>Percentage Split:</strong>
                  </p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <div
                      style={{
                        flex: revenueData.vipDepositFees,
                        background: '#48bb78',
                        height: '30px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      VIP:{' '}
                      {revenueData.totalFees > 0
                        ? ((revenueData.vipDepositFees / revenueData.totalFees) * 100).toFixed(1)
                        : 0}
                      %
                    </div>
                    <div
                      style={{
                        flex: revenueData.transactionFees,
                        background: '#4299e1',
                        height: '30px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      TX:{' '}
                      {revenueData.totalFees > 0
                        ? ((revenueData.transactionFees / revenueData.totalFees) * 100).toFixed(1)
                        : 0}
                      %
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Revenue Tenants */}
            <div className="card" style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '15px' }}>🏆 Top Revenue Generating Tenants</h3>
              {topTenants.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No fee revenue data yet
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Total Fees</th>
                        <th>VIP Deposit Fees</th>
                        <th>Transaction Fees</th>
                        <th>Fee Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTenants.map((tenant) => (
                        <tr key={tenant.tenant_id}>
                          <td style={{ fontWeight: 'bold' }}>{tenant.tenant_name}</td>
                          <td style={{ color: '#d4af37', fontWeight: 'bold' }}>
                            R{' '}
                            {parseFloat(tenant.total_fees || 0).toLocaleString('en-ZA', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ color: '#48bb78' }}>
                            R{' '}
                            {parseFloat(tenant.vip_deposit_fees || 0).toLocaleString('en-ZA', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ color: '#4299e1' }}>
                            R{' '}
                            {parseFloat(tenant.transaction_fees || 0).toLocaleString('en-ZA', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td>{tenant.fee_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div
              className="card"
              style={{
                marginTop: '30px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
              }}
            >
              <h3 style={{ marginBottom: '15px', color: 'white' }}>💡 About Platform Fees</h3>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <p>
                  <strong>VIP Deposit Fees (5%):</strong> Automatically collected when customers pay
                  VIP table deposits. This is a hidden revenue stream that scales with platform
                  usage.
                </p>
                <p style={{ marginTop: '10px' }}>
                  <strong>Example:</strong> Customer pays R1,000 deposit → Platform keeps R50 (5%)
                  → Tenant receives R950
                </p>
                <p style={{ marginTop: '10px', fontSize: '12px', opacity: 0.9 }}>
                  💰 This is pure profit with zero additional cost or effort. Industry standard for
                  booking platforms.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
