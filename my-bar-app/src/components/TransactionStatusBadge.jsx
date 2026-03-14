/**
 * Transaction Status Badge Component
 * Displays a colored badge based on transaction status
 */

import React from 'react';

const TransactionStatusBadge = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'pending':
        return {
          background: '#fff3cd',
          color: '#856404',
          label: 'Pending',
        };
      case 'confirmed':
        return {
          background: '#d4edda',
          color: '#155724',
          label: 'Confirmed',
        };
      case 'cancelled':
        return {
          background: '#f8d7da',
          color: '#721c24',
          label: 'Cancelled',
        };
      case 'refunded':
        return {
          background: '#d1ecf1',
          color: '#0c5460',
          label: 'Refunded',
        };
      default:
        return {
          background: '#e2e8f0',
          color: '#4a5568',
          label: status || 'Unknown',
        };
    }
  };

  const style = getStatusStyle();

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        borderRadius: '12px',
        background: style.background,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
};

export default TransactionStatusBadge;
