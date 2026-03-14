/* eslint-disable no-undef, no-unused-vars */
/**
 * Integration Example for New Features
 * This file demonstrates how to integrate the new features into existing pages
 * NOTE: This is example code for reference only - not meant to be compiled
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Routes, Route } from 'react-router-dom';

// New feature components
import OfflineQueue from './components/OfflineQueue';
import LoyaltyDashboard from './components/LoyaltyDashboard';
import RewardsManager from './components/RewardsManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CurrencySelector from './components/CurrencySelector';
import TaxCalculator from './components/TaxCalculator';

// Utility imports
import { awardPoints, calculatePointsEarned } from './utils/loyalty';
import { calculateProductTax } from './utils/tax';
import { addToOfflineQueue, syncOfflineQueue } from './utils/offline';
import { convertCurrency, formatCurrency } from './utils/currency';

/**
 * EXAMPLE 1: Add Offline Queue to Main App
 * Place this component at the root level to monitor all offline operations
 */
export function AppWithOfflineSupport() {
  return (
    <>
      {/* Global offline queue component */}
      <OfflineQueue />

      {/* Rest of your app */}
      <Routes>{/* Your existing routes */}</Routes>
    </>
  );
}

/**
 * EXAMPLE 2: Customer Loyalty Dashboard Page
 * Add to customer dashboard routes
 */
export function CustomerLoyaltyPage({ customerId }) {
  return (
    <div className="customer-loyalty-page">
      <h1>My Rewards</h1>
      <LoyaltyDashboard customerId={customerId} />
    </div>
  );
}

CustomerLoyaltyPage.propTypes = {
  customerId: PropTypes.string.isRequired,
};

/**
 * EXAMPLE 3: Owner Analytics Dashboard Page
 * Add to owner dashboard routes
 */
export function OwnerAnalyticsPage({ tenantId }) {
  return (
    <div className="owner-analytics-page">
      <AnalyticsDashboard tenantId={tenantId} />
    </div>
  );
}

OwnerAnalyticsPage.propTypes = {
  tenantId: PropTypes.string.isRequired,
};

/**
 * EXAMPLE 4: Owner Rewards Management Page
 * Add to owner dashboard routes
 */
export function OwnerRewardsPage({ tenantId }) {
  return (
    <div className="owner-rewards-page">
      <RewardsManager tenantId={tenantId} />
    </div>
  );
}

OwnerRewardsPage.propTypes = {
  tenantId: PropTypes.string.isRequired,
};

/**
 * EXAMPLE 5: Enhanced Checkout with Tax and Currency
 * Update your existing checkout component
 */
export function EnhancedCheckout({ cart, tenantId, onCheckout }) {
  const [selectedCurrency, setSelectedCurrency] = React.useState(null);
  const [taxBreakdown, setTaxBreakdown] = React.useState(null);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    calculateTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedCurrency]);

  const calculateTotal = async () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Calculate tax
    const tax = await calculateProductTax(subtotal, null, tenantId);
    setTaxBreakdown(tax);
    setTotal(tax.total);
  };

  const handleCurrencyChange = (currency, rates) => {
    setSelectedCurrency(currency);
    // Convert cart prices if needed
  };

  return (
    <div className="enhanced-checkout">
      <div className="checkout-header">
        <h2>Checkout</h2>
        <CurrencySelector tenantId={tenantId} onCurrencyChange={handleCurrencyChange} />
      </div>

      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.id}>
            {item.name} x {item.quantity} - {formatCurrency(item.price * item.quantity)}
          </div>
        ))}
      </div>

      <TaxCalculator
        amount={cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}
        tenantId={tenantId}
        onTaxCalculated={setTaxBreakdown}
      />

      <button onClick={onCheckout}>Complete Purchase - {formatCurrency(total)}</button>
    </div>
  );
}

EnhancedCheckout.propTypes = {
  cart: PropTypes.array.isRequired,
  tenantId: PropTypes.string.isRequired,
  onCheckout: PropTypes.func.isRequired,
};

/**
 * EXAMPLE 6: Transaction Processing with Offline Support and Loyalty Points
 * Update your transaction handling logic
 */
export async function processTransaction(transactionData, userId, tenantId) {
  try {
    // Check if online
    if (!navigator.onLine) {
      // Add to offline queue
      addToOfflineQueue('create_transaction', transactionData);
      return {
        success: true,
        offline: true,
        message: 'Transaction saved. Will sync when online.',
      };
    }

    // Process transaction online
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert([transactionData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Award loyalty points
    const points = await calculatePointsEarned(transactionData.amount, userId);
    if (points > 0) {
      await awardPoints(userId, points, `Purchase #${transaction.id}`, transaction.id);
    }

    return {
      success: true,
      transaction,
      pointsEarned: points,
      message: `Transaction complete! You earned ${points} points.`,
    };
  } catch (error) {
    console.error('Transaction error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * EXAMPLE 7: Product Display with Multi-Currency Pricing
 * Update your product list component
 */
export function ProductListWithCurrency({ products, selectedCurrency, exchangeRates }) {
  return (
    <div className="product-list">
      {products.map((product) => {
        const convertedPrice = selectedCurrency
          ? convertCurrency(product.price, 'USD', selectedCurrency.code, exchangeRates)
          : product.price;

        return (
          <div key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <div className="price">
              {formatCurrency(convertedPrice, selectedCurrency?.code || 'USD')}
            </div>
            <button>Add to Cart</button>
          </div>
        );
      })}
    </div>
  );
}

ProductListWithCurrency.propTypes = {
  products: PropTypes.array.isRequired,
  selectedCurrency: PropTypes.object,
  exchangeRates: PropTypes.object,
};

/**
 * EXAMPLE 8: Staff Dashboard with Analytics Summary
 * Add analytics widget to staff dashboard
 */
export function StaffDashboardWithAnalytics({ tenantId }) {
  const [todayStats, setTodayStats] = React.useState({
    revenue: 0,
    transactions: 0,
    customers: 0,
  });

  React.useEffect(() => {
    fetchTodayStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchTodayStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('transactions')
      .select('amount, user_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('created_at', today);

    const revenue = data.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const customers = new Set(data.map((t) => t.user_id)).size;

    setTodayStats({
      revenue,
      transactions: data.length,
      customers,
    });
  };

  return (
    <div className="staff-dashboard">
      <h1>Staff Dashboard</h1>

      <div className="quick-stats">
        <div className="stat-card">
          <h3>Today&apos;s Revenue</h3>
          <p>{formatCurrency(todayStats.revenue)}</p>
        </div>
        <div className="stat-card">
          <h3>Transactions</h3>
          <p>{todayStats.transactions}</p>
        </div>
        <div className="stat-card">
          <h3>Customers</h3>
          <p>{todayStats.customers}</p>
        </div>
      </div>

      {/* Link to full analytics */}
      <a href="/owner/analytics">View Full Analytics</a>
    </div>
  );
}

StaffDashboardWithAnalytics.propTypes = {
  tenantId: PropTypes.string.isRequired,
};

/**
 * EXAMPLE 9: Reward Redemption Modal
 * Show available rewards during checkout
 */
export function RewardRedemptionModal({ userId, tenantId, cartTotal, onRewardApplied }) {
  const [rewards, setRewards] = React.useState([]);
  const [loyaltyData, setLoyaltyData] = React.useState(null);

  React.useEffect(() => {
    fetchLoyaltyAndRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchLoyaltyAndRewards = async () => {
    // Fetch customer loyalty
    const loyalty = await getCustomerLoyalty(userId);
    setLoyaltyData(loyalty);

    // Fetch available rewards
    const { data } = await supabase
      .from('rewards_catalog')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .lte('points_cost', loyalty?.points_balance || 0);

    setRewards(data || []);
  };

  const handleRedeemReward = async (reward) => {
    const result = await redeemReward(userId, reward.id);

    if (result.success) {
      // Apply reward to cart
      onRewardApplied(reward);
      alert(`Reward redeemed! ${reward.name}`);
    } else {
      alert(`Failed to redeem: ${result.error}`);
    }
  };

  return (
    <div className="reward-redemption-modal">
      <h3>Available Rewards</h3>
      <p>Your Points: {loyaltyData?.points_balance || 0}</p>

      {rewards.length === 0 ? (
        <p>No rewards available with your current points</p>
      ) : (
        rewards.map((reward) => (
          <div key={reward.id} className="reward-option">
            <h4>{reward.name}</h4>
            <p>{reward.description}</p>
            <p>Cost: {reward.points_cost} points</p>
            <button onClick={() => handleRedeemReward(reward)}>Use Reward</button>
          </div>
        ))
      )}
    </div>
  );
}

RewardRedemptionModal.propTypes = {
  userId: PropTypes.string.isRequired,
  tenantId: PropTypes.string.isRequired,
  cartTotal: PropTypes.number.isRequired,
  onRewardApplied: PropTypes.func.isRequired,
};

/**
 * EXAMPLE 10: Sync Status Indicator
 * Show offline queue status in navigation bar
 */
export function SyncStatusIndicator() {
  const [queueStats, setQueueStats] = React.useState({ pending: 0, failed: 0 });
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setQueueStats(getQueueStats());
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    await syncOfflineQueue();
    setQueueStats(getQueueStats());
  };

  if (queueStats.pending === 0 && queueStats.failed === 0) {
    return null;
  }

  return (
    <div className="sync-status-indicator">
      <span className={isOnline ? 'online' : 'offline'}>{isOnline ? '🟢' : '🔴'}</span>
      <span>
        {queueStats.pending} pending, {queueStats.failed} failed
      </span>
      {isOnline && <button onClick={handleManualSync}>Sync Now</button>}
    </div>
  );
}

// Export all examples
export default {
  AppWithOfflineSupport,
  CustomerLoyaltyPage,
  OwnerAnalyticsPage,
  OwnerRewardsPage,
  EnhancedCheckout,
  processTransaction,
  ProductListWithCurrency,
  StaffDashboardWithAnalytics,
  RewardRedemptionModal,
  SyncStatusIndicator,
};
