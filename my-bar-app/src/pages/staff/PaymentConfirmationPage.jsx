/**
 * Payment Confirmation Page - Staff View
 * Staff confirms pending customer payments
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getPendingTransactions, 
  confirmTransaction,
  bulkConfirmTransactions 
} from '../../utils/paymentUtils';
import TransactionStatusBadge from '../../components/TransactionStatusBadge';
import PageHeader from '../../components/PageHeader';

const PaymentConfirmationPage = () => {
  const { userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPendingTransactions();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPendingTransactions, 30000);
    return () => clearInterval(interval);
  }, [userProfile]);

  const fetchPendingTransactions = async () => {
    if (!userProfile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, error } = await getPendingTransactions(userProfile.tenant_id);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
      setMessage({ type: 'error', text: 'Failed to load pending payments' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (transactionId) => {
    try {
      setConfirmingId(transactionId);
      
      const { transaction, qrCode, error } = await confirmTransaction(
        transactionId,
        userProfile.id
      );

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: `Payment confirmed! QR code generated for customer.` 
      });

      // Remove from list
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      
      // Auto-clear message
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error confirming payment:', error);
      setMessage({ type: 'error', text: 'Failed to confirm payment' });
    } finally {
      setConfirmingId(null);
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      setBulkConfirming(true);
      
      const result = await bulkConfirmTransactions(selectedIds, userProfile.id);

      setMessage({ 
        type: 'success', 
        text: `Confirmed ${result.successCount} of ${result.total} payments. ${result.failCount > 0 ? `${result.failCount} failed.` : ''}` 
      });

      // Remove confirmed from list
      setTransactions(prev => prev.filter(t => !selectedIds.includes(t.id)));
      setSelectedIds([]);
      
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error bulk confirming:', error);
      setMessage({ type: 'error', text: 'Failed to bulk confirm payments' });
    } finally {
      setBulkConfirming(false);
    }
  };

  const toggleSelect = (transactionId) => {
    setSelectedIds(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map(t => t.id));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      transaction.users?.full_name?.toLowerCase().includes(search) ||
      transaction.users?.email?.toLowerCase().includes(search) ||
      transaction.products?.name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading pending payments...</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '10px' }}>Payment Confirmation</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Confirm customer payments to generate entry QR codes
      </p>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: '12px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
          }}
        >
          {message.text}
        </div>
      )}

      {/* Summary and actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}
      >
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            <strong style={{ fontSize: '24px', color: '#f6ad55' }}>
              {filteredTransactions.length}
            </strong>{' '}
            Pending Payments
          </div>
          {selectedIds.length > 0 && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <strong style={{ fontSize: '18px', color: '#667eea' }}>
                {selectedIds.length}
              </strong>{' '}
              Selected
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by customer or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              minWidth: '250px'
            }}
          />

          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkConfirm}
              disabled={bulkConfirming}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                background: bulkConfirming ? '#a0aec0' : '#48bb78',
                border: 'none',
                borderRadius: '8px',
                cursor: bulkConfirming ? 'not-allowed' : 'pointer'
              }}
            >
              {bulkConfirming ? 'Confirming...' : `Confirm ${selectedIds.length} Selected`}
            </button>
          )}

          <button
            onClick={fetchPendingTransactions}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#667eea',
              background: '#fff',
              border: '1px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Transactions table */}
      {filteredTransactions.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#f7fafc',
            borderRadius: '12px'
          }}
        >
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>
            ✓ No pending payments
          </p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            All payments have been processed
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 1fr 150px 120px 150px',
              padding: '16px 20px',
              background: '#f7fafc',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: '600',
              fontSize: '14px',
              color: '#4a5568'
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.length === filteredTransactions.length}
              onChange={toggleSelectAll}
              style={{ cursor: 'pointer' }}
            />
            <div>Customer</div>
            <div>Product</div>
            <div>Amount</div>
            <div>Date</div>
            <div>Action</div>
          </div>

          {/* Table rows */}
          {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 150px 120px 150px',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                alignItems: 'center',
                background: selectedIds.includes(transaction.id) ? '#f7fafc' : '#fff'
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(transaction.id)}
                onChange={() => toggleSelect(transaction.id)}
                style={{ cursor: 'pointer' }}
              />

              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {transaction.users?.full_name || 'Unknown'}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {transaction.users?.email}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: '500' }}>
                  {transaction.products?.name || 'Unknown Product'}
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
                    background: transaction.products?.type === 'drink' ? '#bee3f8' : '#fbd38d',
                    color: transaction.products?.type === 'drink' ? '#2c5282' : '#7c2d12'
                  }}
                >
                  {transaction.products?.type}
                </div>
              </div>

              <div style={{ fontSize: '18px', fontWeight: '700', color: '#667eea' }}>
                ${parseFloat(transaction.amount).toFixed(2)}
              </div>

              <div style={{ fontSize: '13px', color: '#666' }}>
                {formatDate(transaction.created_at)}
              </div>

              <div>
                <button
                  onClick={() => handleConfirm(transaction.id)}
                  disabled={confirmingId === transaction.id}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff',
                    background: confirmingId === transaction.id ? '#a0aec0' : '#48bb78',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: confirmingId === transaction.id ? 'not-allowed' : 'pointer'
                  }}
                >
                  {confirmingId === transaction.id ? 'Confirming...' : 'Confirm'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div
        style={{
          marginTop: '30px',
          padding: '16px',
          background: '#edf2f7',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#4a5568'
        }}
      >
        <p style={{ margin: 0 }}>
          💡 <strong>Tip:</strong> Select multiple payments using checkboxes and click "Confirm Selected" 
          to process them in bulk. Confirming a payment automatically generates a QR code for the customer.
        </p>
      </div>
    </div>
    </div>
  );
};

export default PaymentConfirmationPage;
