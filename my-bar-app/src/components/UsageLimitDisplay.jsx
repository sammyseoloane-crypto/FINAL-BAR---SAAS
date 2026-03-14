import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useUsageLimit } from '../contexts/SubscriptionContext';
import './UsageLimitDisplay.css';

/**
 * UsageLimitDisplay Component
 * Shows current usage vs limits with progress bar
 */
const UsageLimitDisplay = ({ limitType, showDetails = true }) => {
  const { limitInfo, loading } = useUsageLimit(limitType);
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    if (limitInfo) {
      const pct = limitInfo.max > 0 ? (limitInfo.current / limitInfo.max) * 100 : 0;
      setPercentage(Math.min(pct, 100));
    }
  }, [limitInfo]);

  if (loading) {
    return (
      <div className="usage-limit-skeleton">
        <div className="skeleton-bar"></div>
      </div>
    );
  }

  if (!limitInfo) {
    return null;
  }

  const getStatusColor = () => {
    if (percentage >= 100) {
      return 'danger';
    }
    if (percentage >= 80) {
      return 'warning';
    }
    return 'success';
  };

  const getLimitLabel = () => {
    switch (limitType) {
      case 'staff':
        return 'Staff Accounts';
      case 'locations':
        return 'Venue Locations';
      case 'products':
        return 'Products';
      case 'events':
        return 'Events This Month';
      default:
        return limitType;
    }
  };

  const isUnlimited = limitInfo.max >= 999999;

  return (
    <div className={`usage-limit-display ${getStatusColor()}`}>
      {showDetails && (
        <div className="usage-limit-header">
          <span className="usage-limit-label">{getLimitLabel()}</span>
          <span className="usage-limit-count">
            {limitInfo.current} / {isUnlimited ? '∞' : limitInfo.max}
          </span>
        </div>
      )}

      {!isUnlimited && (
        <div className="usage-limit-progress">
          <div
            className="usage-limit-bar"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      )}

      {showDetails && limitInfo.is_at_limit && (
        <div className="usage-limit-warning">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">
            Limit reached. Upgrade to add more {getLimitLabel().toLowerCase()}.
          </span>
        </div>
      )}

      {showDetails && !limitInfo.is_at_limit && limitInfo.remaining <= 2 && limitInfo.max < 999999 && (
        <div className="usage-limit-info">
          <span className="info-icon">ℹ️</span>
          <span className="info-text">
            {limitInfo.remaining} {getLimitLabel().toLowerCase()} remaining
          </span>
        </div>
      )}
    </div>
  );
};

UsageLimitDisplay.propTypes = {
  limitType: PropTypes.string.isRequired,
  showDetails: PropTypes.bool,
};

/**
 * CompactUsageDisplay Component
 * Compact version for sidebar or header
 */
export const CompactUsageDisplay = ({ limitType }) => {
  const { limitInfo } = useUsageLimit(limitType);

  if (!limitInfo) {
    return null;
  }

  const isUnlimited = limitInfo.max >= 999999;
  const isNearLimit = limitInfo.remaining <= 2 && !isUnlimited;
  const isAtLimit = limitInfo.is_at_limit;

  return (
    <div className={`compact-usage ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
      <span className="compact-count">
        {limitInfo.current}/{isUnlimited ? '∞' : limitInfo.max}
      </span>
    </div>
  );
};

CompactUsageDisplay.propTypes = {
  limitType: PropTypes.string.isRequired,
};

/**
 * AllLimitsDisplay Component
 * Shows all usage limits in a grid
 */
export const AllLimitsDisplay = () => {
  return (
    <div className="all-limits-grid">
      <UsageLimitDisplay limitType="staff" />
      <UsageLimitDisplay limitType="locations" />
      <UsageLimitDisplay limitType="products" />
      <UsageLimitDisplay limitType="events" />
    </div>
  );
};

export default UsageLimitDisplay;
