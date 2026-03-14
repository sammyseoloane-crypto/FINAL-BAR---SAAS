import { useState } from 'react';
import PropTypes from 'prop-types';
import { useFeatureAccess } from '../contexts/SubscriptionContext';
import { FEATURE_NAMES, getUpgradeTierForFeature, TIER_INFO } from '../utils/subscriptionUtils';
import './FeatureGate.css';

/**
 * FeatureGate Component
 * Conditionally renders children based on feature access
 * Shows upgrade prompt if feature is not available
 */
const FeatureGate = ({
  feature,
  children,
  fallback = null,
  showUpgradePrompt = true,
  upgradeMessage,
  onUpgradeClick,
}) => {
  const hasAccess = useFeatureAccess(feature);
  const [showPrompt, setShowPrompt] = useState(true);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt || !showPrompt) {
    return null;
  }

  const requiredTier = getUpgradeTierForFeature(feature);
  const tierInfo = TIER_INFO[requiredTier];
  const featureName = FEATURE_NAMES[feature] || feature;

  const defaultMessage = upgradeMessage ||
    `Unlock ${featureName} with ${tierInfo?.name || 'a higher tier'}`;

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick(requiredTier);
    } else {
      // Default: navigate to pricing page
      window.location.href = '/pricing';
    }
  };

  return (
    <div className="feature-gate-locked">
      <div className="feature-gate-overlay">
        <div className="feature-gate-content">
          <div className="feature-gate-icon">🔒</div>
          <h3 className="feature-gate-title">Premium Feature</h3>
          <p className="feature-gate-message">{defaultMessage}</p>
          <div className="feature-gate-actions">
            <button className="btn-upgrade" onClick={handleUpgrade}>
              Upgrade to {tierInfo?.name}
            </button>
            <button className="btn-dismiss" onClick={() => setShowPrompt(false)}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
      <div className="feature-gate-blurred">
        {children}
      </div>
    </div>
  );
};

FeatureGate.propTypes = {
  feature: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
  showUpgradePrompt: PropTypes.bool,
  upgradeMessage: PropTypes.string,
  onUpgradeClick: PropTypes.func,
};

/**
 * FeatureLock Component
 * Simple lock icon with tooltip for locked features
 */
export const FeatureLock = ({ feature, className = '' }) => {
  const hasAccess = useFeatureAccess(feature);

  if (hasAccess) {
    return null;
  }

  const requiredTier = getUpgradeTierForFeature(feature);
  const tierInfo = TIER_INFO[requiredTier];

  return (
    <span className={`feature-lock ${className}`} title={`Requires ${tierInfo?.name}`}>
      <span className="lock-icon">🔒</span>
      <span className="lock-text">{tierInfo?.name}</span>
    </span>
  );
};

FeatureLock.propTypes = {
  feature: PropTypes.string.isRequired,
  className: PropTypes.string,
};

/**
 * DisabledFeatureButton Component
 * Button that shows upgrade prompt when clicked if feature is locked
 */
export const DisabledFeatureButton = ({
  feature,
  children,
  onClick,
  className = '',
  disabled = false,
  ...props
}) => {
  const hasAccess = useFeatureAccess(feature);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleClick = (e) => {
    if (!hasAccess) {
      e.preventDefault();
      setShowUpgradeModal(true);
    } else if (onClick) {
      onClick(e);
    }
  };

  const requiredTier = getUpgradeTierForFeature(feature);
  const tierInfo = TIER_INFO[requiredTier];

  return (
    <>
      <button
        className={`${className} ${!hasAccess ? 'feature-locked-button' : ''}`}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
        {!hasAccess && <span className="lock-badge">🔒</span>}
      </button>

      {showUpgradeModal && (
        <div className="upgrade-modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>
              ✕
            </button>
            <div className="modal-icon">🔒</div>
            <h2>Premium Feature</h2>
            <p>This feature requires {tierInfo?.name}</p>
            <p className="modal-price">{tierInfo?.price}</p>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => (window.location.href = '/pricing')}
              >
                View Pricing
              </button>
              <button className="btn-secondary" onClick={() => setShowUpgradeModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

DisabledFeatureButton.propTypes = {
  feature: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default FeatureGate;
