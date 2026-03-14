import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import {
  getTenantSubscription,
  checkFeatureAccess,
  checkUsageLimit,
  canPerformAction,
  SUBSCRIPTION_TIERS,
  TIER_INFO,
} from '../utils/subscriptionUtils';

const SubscriptionContext = createContext({});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [featureCache, setFeatureCache] = useState({});
  const [limitCache, setLimitCache] = useState({});

  const fetchSubscription = useCallback(async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      setLoading(true);
      const data = await getTenantSubscription(userProfile.tenant_id);
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.tenant_id]);

  // Fetch subscription details when user profile changes
  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [userProfile?.tenant_id, fetchSubscription]);

  // Check if a feature is available
  const hasFeature = useCallback(
    async (featureName) => {
      if (!userProfile?.tenant_id) {
        return false;
      }

      // Check cache first
      const cacheKey = `${userProfile.tenant_id}_${featureName}`;
      if (featureCache[cacheKey] !== undefined) {
        return featureCache[cacheKey];
      }

      // Fetch from database
      const hasAccess = await checkFeatureAccess(userProfile.tenant_id, featureName);

      // Update cache
      setFeatureCache((prev) => ({
        ...prev,
        [cacheKey]: hasAccess,
      }));

      return hasAccess;
    },
    [userProfile?.tenant_id, featureCache],
  );

  // Check if a feature is available synchronously (use cached subscription data)
  const hasFeatureSync = useCallback(
    (featureName) => {
      if (!subscription?.features) {
        return false;
      }
      return subscription.features[featureName] === true;
    },
    [subscription],
  );

  // Get usage limits
  const getUsageLimit = useCallback(
    async (limitType) => {
      if (!userProfile?.tenant_id) {
        return null;
      }

      // Check cache first (with 30 second TTL)
      const cacheKey = `${userProfile.tenant_id}_${limitType}`;
      const cachedData = limitCache[cacheKey];
      if (cachedData && Date.now() - cachedData.timestamp < 30000) {
        return cachedData.data;
      }

      // Fetch from database
      const limitData = await checkUsageLimit(userProfile.tenant_id, limitType);

      // Update cache
      setLimitCache((prev) => ({
        ...prev,
        [cacheKey]: {
          data: limitData,
          timestamp: Date.now(),
        },
      }));

      return limitData;
    },
    [userProfile?.tenant_id, limitCache],
  );

  // Check if an action can be performed
  const canPerform = useCallback(
    async (limitType) => {
      if (!userProfile?.tenant_id) {
        return false;
      }
      return await canPerformAction(userProfile.tenant_id, limitType);
    },
    [userProfile?.tenant_id],
  );

  // Refresh subscription and clear caches
  const refreshSubscription = useCallback(async () => {
    setFeatureCache({});
    setLimitCache({});
    await fetchSubscription();
  }, [fetchSubscription]);

  // Get current tier info
  const getCurrentTierInfo = useCallback(() => {
    if (!subscription?.subscription_tier) {
      return null;
    }
    return TIER_INFO[subscription.subscription_tier];
  }, [subscription?.subscription_tier]);

  // Check if subscription is active
  const isActive = useCallback(() => {
    return subscription?.subscription_status === 'active';
  }, [subscription?.subscription_status]);

  // Check if subscription is trial
  const isTrial = useCallback(() => {
    return subscription?.subscription_tier === SUBSCRIPTION_TIERS.TRIAL;
  }, [subscription?.subscription_tier]);

  const value = {
    subscription,
    loading,
    hasFeature,
    hasFeatureSync,
    getUsageLimit,
    canPerform,
    refreshSubscription,
    getCurrentTierInfo,
    isActive,
    isTrial,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

SubscriptionProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to check feature access
 */
export const useFeatureAccess = (featureName) => {
  const { hasFeatureSync, subscription } = useSubscription();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (subscription) {
      setHasAccess(hasFeatureSync(featureName));
    }
  }, [featureName, subscription, hasFeatureSync]);

  return hasAccess;
};

/**
 * Hook to check usage limits
 */
export const useUsageLimit = (limitType) => {
  const { getUsageLimit } = useSubscription();
  const [limitInfo, setLimitInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLimit = async () => {
      setLoading(true);
      const data = await getUsageLimit(limitType);
      setLimitInfo(data);
      setLoading(false);
    };

    fetchLimit();
  }, [limitType, getUsageLimit]);

  return { limitInfo, loading };
};

/**
 * Hook to get tier-specific data
 */
export const useTierInfo = () => {
  const { subscription, getCurrentTierInfo } = useSubscription();

  return {
    tier: subscription?.subscription_tier,
    tierInfo: getCurrentTierInfo(),
    planName: subscription?.plan_name,
    priceMonthly: subscription?.price_monthly,
    priceYearly: subscription?.price_yearly,
    features: subscription?.features,
  };
};
