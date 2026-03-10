/**
 * My Purchases Page - Customer View
 * View transaction history and active QR codes
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyTransactions } from '../../utils/paymentUtils';
import TransactionStatusBadge from '../../components/TransactionStatusBadge';
import QRCodeGenerator from '../../components/QRCodeGenerator';
import DashboardLayout from '../../components/DashboardLayout';

const MyPurchasesPage = () => {
  const { userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchMyTransactions();
  }, [userProfile]);

  const fetchMyTransactions = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await getMyTransactions(userProfile.id);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowQR = (transaction) => {
    setSelectedTransaction(transaction);
    setShowQRModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (qrCode) => {
    if (!qrCode || !qrCode.created_at) return false;
    const now = new Date();
    const createdAt = new Date(qrCode.created_at);
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
    return hoursSinceCreation > 24;
  };

  const getDisplayName = (transaction) => {
    // For event purchases (stored in metadata)
    if (transaction.type === 'event_entry' && transaction.metadata?.event_name) {
      return transaction.metadata.event_name;
    }
    // For product purchases (from products table)
    if (transaction.products?.name) {
      return transaction.products.name;
    }
    // Fallback: check metadata for product_name
    if (transaction.metadata?.product_name) {
      return transaction.metadata.product_name;
    }
    // Last resort: show amount
    return `Purchase - $${parseFloat(transaction.amount).toFixed(2)}`;
  };

  const getDisplayType = (transaction) => {
    if (transaction.type === 'event_entry') {
      return { label: 'Event', bg: '#e0f2fe', color: '#075985' };
    }
    if (transaction.products?.type === 'drink') {
      return { label: 'Drink', bg: '#bee3f8', color: '#2c5282' };
    }
    if (transaction.products?.type === 'food') {
      return { label: 'Food', bg: '#fbd38d', color: '#7c2d12' };
    }
    if (transaction.products?.type === 'entrance_fee') {
      return { label: 'Entrance', bg: '#d4fc79', color: '#2d5016' };
    }
    if (transaction.metadata?.product_type) {
      return { label: transaction.metadata.product_type, bg: '#e2e8f0', color: '#1a202c' };
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading your purchases...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '10px' }}>My Purchases</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          View your transaction history and QR codes
        </p>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '30px'
        }}
      >
        <div
          style={{
            padding: '20px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Total Purchases
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#667eea' }}>
            {transactions.length}
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Pending
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f6ad55' }}>
            {transactions.filter(t => t.status === 'pending').length}
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Confirmed
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#48bb78' }}>
            {transactions.filter(t => t.status === 'confirmed').length}
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Active QR Codes
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#667eea' }}>
            {transactions.filter(t => 
              t.qr_codes?.length > 0 && !t.qr_codes[0].scanned_at && !isExpired(t.qr_codes[0])
            ).length}
          </div>
        </div>
      </div>

      {/* Transactions list */}
      {transactions.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#f7fafc',
            borderRadius: '12px'
          }}
        >
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>
            No purchases yet
          </p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            Visit the Products page to make your first purchase
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
          {transactions.map((transaction, index) => (
            <div
              key={transaction.id}
              style={{
                padding: '20px',
                borderBottom: index < transactions.length - 1 ? '1px solid #e2e8f0' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>
                    {transaction.type === 'event_entry' && '🎉 '}
                    {getDisplayName(transaction)}
                  </h3>
                  {transaction.metadata?.event_date && (
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      📅 {new Date(transaction.metadata.event_date).toLocaleDateString()}
                    </div>
                  )}
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {formatDate(transaction.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#667eea', marginBottom: '8px' }}>
                    ${parseFloat(transaction.amount).toFixed(2)}
                  </div>
                  <TransactionStatusBadge status={transaction.status} />
                </div>
              </div>

              {/* Product/Event details */}
              {getDisplayType(transaction) && (
                <div style={{ marginBottom: '12px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      borderRadius: '6px',
                      background: getDisplayType(transaction).bg,
                      color: getDisplayType(transaction).color
                    }}
                  >
                    {getDisplayType(transaction).label}
                  </span>
                  {transaction.products?.description && (
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '8px', margin: 0 }}>
                      {transaction.products.description}
                    </p>
                  )}
                  {transaction.metadata?.quantity && transaction.metadata.quantity > 1 && (
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '8px', margin: 0 }}>
                      Quantity: {transaction.metadata.quantity}
                    </p>
                  )}
                </div>
              )}

              {/* QR Code info - only show if not expired */}
              {transaction.qr_codes && transaction.qr_codes.length > 0 && !isExpired(transaction.qr_codes[0]) && (
                <div
                  style={{
                    background: '#f7fafc',
                    padding: '12px',
                    borderRadius: '8px',
                    marginTop: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {transaction.qr_codes[0].scanned_at ? (
                        <div style={{ color: '#666', fontSize: '14px' }}>
                          ✓ Scanned on {formatDate(transaction.qr_codes[0].scanned_at)}
                        </div>
                      ) : (
                        <div style={{ color: '#48bb78', fontSize: '14px', fontWeight: '600' }}>
                          🎫 QR Code Ready (Not scanned yet)
                        </div>
                      )}
                    </div>
                    {!transaction.qr_codes[0].scanned_at && (
                      <button
                        onClick={() => handleShowQR(transaction)}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#fff',
                          background: '#667eea',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Show QR Code
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Pending status help */}
              {transaction.status === 'pending' && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#fff3cd',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#856404'
                  }}
                >
                  ⏳ Waiting for staff to confirm payment. QR code will be generated after confirmation.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedTransaction && (
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
            padding: '20px'
          }}
          onClick={() => setShowQRModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '10px' }}>Your Entry QR Code</h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              {getDisplayName(selectedTransaction)}
            </p>

            {selectedTransaction.qr_codes && selectedTransaction.qr_codes.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <QRCodeGenerator 
                  value={selectedTransaction.qr_codes[0].code}
                  size={280}
                />
              </div>
            )}

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              Show this QR code to staff at the entrance
            </p>

            <button
              onClick={() => setShowQRModal(false)}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#fff',
                background: '#667eea',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default MyPurchasesPage;
