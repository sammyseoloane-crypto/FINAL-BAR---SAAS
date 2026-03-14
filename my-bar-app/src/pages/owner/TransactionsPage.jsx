/**
 * Transactions Page - Owner/Admin View
 * View all transactions with statistics and filtering
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTransactions, getTransactionStats } from '../../utils/paymentUtils';
import TransactionStatusBadge from '../../components/TransactionStatusBadge';
import DashboardLayout from '../../components/DashboardLayout';
import './Pages.css';

const TransactionsPage = () => {
  const { userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    searchTerm: '',
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchData = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      setLoading(true);

      // Fetch transactions
      const { data: txData, error: txError } = await getTransactions(
        userProfile.tenant_id,
        filters.status ? { status: filters.status } : {},
      );

      if (txError) {
        throw txError;
      }
      setTransactions(txData || []);

      // Fetch stats
      const { data: statsData, error: statsError } = await getTransactionStats(
        userProfile.tenant_id,
      );

      if (statsError) {
        throw statsError;
      }
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to get product/event name with fallbacks
  const getDisplayName = (transaction) => {
    // For event purchases - check events table first, then metadata
    if (transaction.type === 'event_entry') {
      if (transaction.events?.name) {
        return transaction.events.name;
      }
      if (transaction.metadata?.event_name) {
        return transaction.metadata.event_name;
      }
    }
    // For product purchases - check products table first, then metadata
    if (transaction.products?.name) {
      return transaction.products.name;
    }
    if (transaction.metadata?.product_name) {
      return transaction.metadata.product_name;
    }
    return 'Unknown Product';
  };

  // Helper function to get product type with fallbacks
  const getProductType = (transaction) => {
    // Check products table first
    if (transaction.products?.type) {
      return transaction.products.type;
    }
    // Check metadata
    if (transaction.metadata?.product_type) {
      return transaction.metadata.product_type;
    }
    // For events
    if (transaction.type === 'event_entry') {
      return 'event';
    }
    return null;
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (!filters.searchTerm) {
      return true;
    }
    const search = filters.searchTerm.toLowerCase();
    return (
      transaction.users?.full_name?.toLowerCase().includes(search) ||
      transaction.users?.email?.toLowerCase().includes(search) ||
      transaction.products?.name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading transactions...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '10px' }}>Transactions</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          View and manage all payment transactions
        </p>

        {/* Statistics */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                padding: '25px',
                background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                color: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)',
              }}
            >
              <div style={{ fontSize: '14px', marginBottom: '10px', opacity: 0.9 }}>
                Total Revenue
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700' }}>
                R{stats.totalRevenue.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                padding: '25px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Total Transactions
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#d4af37' }}>
                {stats.total}
              </div>
            </div>

            <div
              style={{
                padding: '25px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Pending Payments
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#f6ad55' }}>
                {stats.pending}
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                R{stats.pendingRevenue.toFixed(2)} pending
              </div>
            </div>

            <div
              style={{
                padding: '25px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Confirmed</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#48bb78' }}>
                {stats.confirmed}
              </div>
            </div>

            <div
              style={{
                padding: '25px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Cancelled</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#e53e3e' }}>
                {stats.cancelled}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder="Search by customer or product..."
            value={filters.searchTerm}
            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            style={{
              flex: 1,
              minWidth: '250px',
              padding: '10px 16px',
              fontSize: '14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>

          <button
            onClick={fetchData}
            className="btn btn-secondary"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Transactions table */}
        {filteredTransactions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#f7fafc',
              borderRadius: '12px',
            }}
          >
            <p style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>
              No transactions found
            </p>
            <p style={{ fontSize: '14px', color: '#999' }}>
              {filters.searchTerm || filters.status
                ? 'Try adjusting your filters'
                : 'Transactions will appear here when customers make purchases'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 120px 120px 150px 120px',
                padding: '16px 20px',
                background: '#f7fafc',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: '600',
                fontSize: '14px',
                color: '#4a5568',
              }}
            >
              <div>Customer</div>
              <div>Product</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Date</div>
              <div>Confirmed By</div>
            </div>

            {/* Table rows */}
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 120px 120px 150px 120px',
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {transaction.users?.full_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>{transaction.users?.email}</div>
                </div>

                <div>
                  <div style={{ fontWeight: '500' }}>
                    {getDisplayName(transaction)}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      borderRadius: '4px',
                      background: getProductType(transaction) === 'drink' ? '#bee3f8' : getProductType(transaction) === 'event' ? '#fbb6ce' : '#fbd38d',
                      color: getProductType(transaction) === 'drink' ? '#2c5282' : getProductType(transaction) === 'event' ? '#702459' : '#7c2d12',
                    }}
                  >
                    {getProductType(transaction) || 'other'}
                  </div>
                </div>

                <div style={{ fontSize: '18px', fontWeight: '700', color: '#d4af37' }}>
                  R{parseFloat(transaction.amount).toFixed(2)}
                </div>

                <div>
                  <TransactionStatusBadge status={transaction.status} />
                </div>

                <div style={{ fontSize: '13px', color: '#666' }}>
                  {formatDate(transaction.created_at)}
                  {transaction.confirmed_at && (
                    <div style={{ fontSize: '12px', color: '#48bb78', marginTop: '4px' }}>
                      ✓ {formatDate(transaction.confirmed_at)}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '13px', color: '#666' }}>
                  {transaction.confirmed_user?.full_name || '-'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export hint */}
        <div
          style={{
            marginTop: '30px',
            padding: '16px',
            background: '#edf2f7',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#4a5568',
          }}
        >
          <p style={{ margin: 0 }}>
            💡 <strong>Tip:</strong> Use the filters to narrow down transactions by status.
            Confirmed transactions have generated QR codes for customers. Pending transactions are
            waiting for staff confirmation.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransactionsPage;
