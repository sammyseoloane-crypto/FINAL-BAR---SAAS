/**
 * ADD-ONS MANAGEMENT COMPONENT
 * Allows tenants to subscribe/unsubscribe to add-ons
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAddOns, useAddOnUsage } from '../contexts/AddOnsContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  ADDON_INFO,
  formatCurrency,
  calculateAddOnCost,
  getAddOnSavings,
  getUsagePercentage,
  getUsageStatusColor,
} from '../utils/addOnsUtils';
import './AddOnsManagement.css';

export default function AddOnsManagement() {
  const { availableAddOns, activeAddOns, loading, subscribe, unsubscribe } = useAddOns();
  const { subscription } = useSubscription();
  const [selectedBilling, setSelectedBilling] = useState({});
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState(null);

  // Initialize billing frequency state
  useEffect(() => {
    const initialBilling = {};
    availableAddOns.forEach((addon) => {
      initialBilling[addon.id] = 'monthly';
    });
    setSelectedBilling(initialBilling);
  }, [availableAddOns]);

  // Check if addon is active
  const isAddonActive = (addonId) => {
    return activeAddOns.some((ta) => ta.addon_id === addonId && ta.is_active);
  };

  // Get active addon details
  const getActiveAddon = (addonId) => {
    return activeAddOns.find((ta) => ta.addon_id === addonId && ta.is_active);
  };

  // Handle subscribe
  const handleSubscribe = async (addonId) => {
    try {
      setProcessing(addonId);
      setError(null);

      const billingFreq = selectedBilling[addonId] || 'monthly';
      await subscribe(addonId, billingFreq);

      alert('Successfully subscribed to add-on!');
    } catch (err) {
      console.error('Error subscribing:', err);
      setError('Failed to subscribe. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  // Handle unsubscribe
  const handleUnsubscribe = async (addonId) => {
    if (!confirm('Are you sure you want to unsubscribe from this add-on?')) {
      return;
    }

    try {
      setProcessing(addonId);
      setError(null);

      await unsubscribe(addonId);

      alert('Successfully unsubscribed from add-on.');
    } catch (err) {
      console.error('Error unsubscribing:', err);
      setError('Failed to unsubscribe. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="addons-loading">
        <div className="spinner"></div>
        <p>Loading add-ons...</p>
      </div>
    );
  }

  return (
    <div className="addons-management">
      <header className="addons-header">
        <h1>🚀 Add-Ons & Revenue Boosters</h1>
        <p>Enhance your system with powerful add-ons and additional revenue streams</p>
        {subscription && (
          <div className="current-plan-badge">
            Current Plan: <strong>{subscription.tier}</strong>
          </div>
        )}
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="addons-grid">
        {availableAddOns.map((addon) => {
          const isActive = isAddonActive(addon.id);
          const activeAddon = getActiveAddon(addon.id);
          const info = ADDON_INFO[addon.addon_type] || {};
          const billingFreq = selectedBilling[addon.id] || 'monthly';
          const cost = calculateAddOnCost(addon, billingFreq);
          const savings = getAddOnSavings(addon);

          return (
            <AddonCard
              key={addon.id}
              addon={addon}
              info={info}
              isActive={isActive}
              activeAddon={activeAddon}
              billingFreq={billingFreq}
              cost={cost}
              savings={savings}
              processing={processing === addon.id}
              onBillingChange={(freq) =>
                setSelectedBilling((prev) => ({ ...prev, [addon.id]: freq }))
              }
              onSubscribe={() => handleSubscribe(addon.id)}
              onUnsubscribe={() => handleUnsubscribe(addon.id)}
            />
          );
        })}
      </div>

      <section className="addons-info-section">
        <h2>📊 Why Add-Ons?</h2>
        <div className="info-cards">
          <div className="info-card">
            <div className="info-icon">💰</div>
            <h3>Additional Revenue</h3>
            <p>Earn passive income through transaction fees and booking charges</p>
          </div>
          <div className="info-card">
            <div className="info-icon">📱</div>
            <h3>Better Engagement</h3>
            <p>SMS marketing keeps customers informed about events and specials</p>
          </div>
          <div className="info-card">
            <div className="info-icon">📈</div>
            <h3>Scalable Growth</h3>
            <p>Pay only for what you use with flexible usage-based pricing</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Add-on Card Component
function AddonCard({
  addon,
  info,
  isActive,
  activeAddon,
  billingFreq,
  cost,
  savings,
  processing,
  onBillingChange,
  onSubscribe,
  onUnsubscribe,
}) {
  const hasMonthlyPrice = addon.price_monthly > 0;

  return (
    <div className={`addon-card ${isActive ? 'active' : ''}`}>
      {isActive && (
        <div className="active-badge">
          <span>✓ Active</span>
        </div>
      )}

      <div className="addon-icon" style={{ backgroundColor: info.color }}>
        {info.icon}
      </div>

      <h3 className="addon-name">{addon.name}</h3>
      <p className="addon-description">{info.description || addon.description}</p>

      {/* Usage Display for Active Add-ons */}
      {isActive && activeAddon && addon.is_usage_based && (
        <UsageDisplay addonType={addon.addon_type} activeAddon={activeAddon} />
      )}

      {/* Pricing */}
      <div className="addon-pricing">
        {hasMonthlyPrice ? (
          <>
            <div className="price-display">
              <span className="price-amount">{formatCurrency(cost)}</span>
              <span className="price-period">/{billingFreq === 'monthly' ? 'month' : 'year'}</span>
            </div>

            {!isActive && (
              <div className="billing-toggle">
                <button
                  className={billingFreq === 'monthly' ? 'active' : ''}
                  onClick={() => onBillingChange('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={billingFreq === 'yearly' ? 'active' : ''}
                  onClick={() => onBillingChange('yearly')}
                >
                  Yearly
                </button>
              </div>
            )}

            {billingFreq === 'yearly' && savings > 0 && (
              <div className="savings-badge">Save {formatCurrency(savings)}/year</div>
            )}
          </>
        ) : (
          <div className="price-display">
            <span className="price-amount">Usage-Based</span>
            <span className="price-period">
              {formatCurrency(addon.price_per_unit)}/{addon.usage_unit}
            </span>
          </div>
        )}
      </div>

      {/* Benefits */}
      {info.benefits && info.benefits.length > 0 && (
        <ul className="addon-benefits">
          {info.benefits.slice(0, 4).map((benefit, index) => (
            <li key={index}>
              <span className="benefit-check">✓</span>
              {benefit}
            </li>
          ))}
        </ul>
      )}

      {/* Action Button */}
      <div className="addon-actions">
        {isActive ? (
          <button
            className="btn-unsubscribe"
            onClick={onUnsubscribe}
            disabled={processing}
          >
            {processing ? 'Processing...' : 'Unsubscribe'}
          </button>
        ) : (
          <button
            className="btn-subscribe"
            onClick={onSubscribe}
            disabled={processing}
          >
            {processing ? 'Processing...' : 'Subscribe Now'}
          </button>
        )}
      </div>
    </div>
  );
}

AddonCard.propTypes = {
  addon: PropTypes.object.isRequired,
  info: PropTypes.object.isRequired,
  isActive: PropTypes.bool.isRequired,
  activeAddon: PropTypes.object,
  billingFreq: PropTypes.string.isRequired,
  cost: PropTypes.number.isRequired,
  savings: PropTypes.number.isRequired,
  processing: PropTypes.bool.isRequired,
  onBillingChange: PropTypes.func.isRequired,
  onSubscribe: PropTypes.func.isRequired,
  onUnsubscribe: PropTypes.func.isRequired,
};

// Usage Display Component
function UsageDisplay({ addonType, activeAddon }) {
  const { usageInfo, loading } = useAddOnUsage(addonType);

  if (loading || !usageInfo) {
    return null;
  }

  const percentage = getUsagePercentage(usageInfo.current_usage, usageInfo.usage_limit);
  const statusColor = getUsageStatusColor(percentage);
  const isUnlimited = usageInfo.usage_limit >= 999999;

  return (
    <div className={`usage-display ${statusColor}`}>
      <div className="usage-header">
        <span className="usage-label">Current Usage</span>
        <span className="usage-count">
          {usageInfo.current_usage} / {isUnlimited ? '∞' : usageInfo.usage_limit}
        </span>
      </div>

      {!isUnlimited && (
        <div className="usage-progress">
          <div className="usage-bar" style={{ width: `${percentage}%` }}></div>
        </div>
      )}

      {usageInfo.is_at_limit && (
        <div className="usage-warning">
          <span>⚠️</span> Limit reached
        </div>
      )}

      {activeAddon.amount_to_bill > 0 && (
        <div className="pending-charges">
          Pending charges: {formatCurrency(activeAddon.amount_to_bill)}
        </div>
      )}
    </div>
  );
}

UsageDisplay.propTypes = {
  addonType: PropTypes.string.isRequired,
  activeAddon: PropTypes.object.isRequired,
};
