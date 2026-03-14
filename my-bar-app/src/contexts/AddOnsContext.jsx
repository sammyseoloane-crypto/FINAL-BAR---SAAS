/**
 * ADD-ONS CONTEXT
 * Manages add-on subscriptions, usage tracking, and state
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import {
  getAvailableAddOns,
  getTenantAddOns,
  checkTenantHasAddOn,
  checkAddOnUsage,
  recordAddOnUsage,
  subscribeToAddOn,
  unsubscribeFromAddOn,
  getAddOnUsageLogs,
} from '../utils/addOnsUtils';

const AddOnsContext = createContext();

export function AddOnsProvider({ children }) {
  const { userProfile } = useAuth();
  const [availableAddOns, setAvailableAddOns] = useState([]);
  const [activeAddOns, setActiveAddOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageCache, setUsageCache] = useState({});

  // Fetch available add-ons
  const fetchAvailableAddOns = useCallback(async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const addons = await getAvailableAddOns();
      setAvailableAddOns(addons);
    } catch (error) {
      console.error('Error fetching available add-ons:', error);
    }
  }, [userProfile?.tenant_id]);

  // Fetch active add-ons for tenant
  const fetchActiveAddOns = useCallback(async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      setLoading(true);
      const addons = await getTenantAddOns(userProfile.tenant_id);
      setActiveAddOns(addons);
    } catch (error) {
      console.error('Error fetching active add-ons:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.tenant_id]);

  // Check if tenant has specific add-on
  const hasAddOn = useCallback(
    async (addonType) => {
      if (!userProfile?.tenant_id) {
        return false;
      }

      // Check local state first
      const hasInState = activeAddOns.some(
        (ta) => ta.addon?.addon_type === addonType && ta.is_active,
      );

      if (hasInState) {
        return true;
      }

      // Fallback to database check
      return await checkTenantHasAddOn(userProfile.tenant_id, addonType);
    },
    [userProfile?.tenant_id, activeAddOns],
  );

  // Get usage info for add-on
  const getUsageInfo = useCallback(
    async (addonType, forceRefresh = false) => {
      if (!userProfile?.tenant_id) {
        return null;
      }

      // Check cache first (30 second TTL)
      const cacheKey = `${userProfile.tenant_id}-${addonType}`;
      const cached = usageCache[cacheKey];
      const now = Date.now();

      if (!forceRefresh && cached && now - cached.timestamp < 30000) {
        return cached.data;
      }

      try {
        const usageInfo = await checkAddOnUsage(userProfile.tenant_id, addonType);

        // Update cache
        setUsageCache((prev) => ({
          ...prev,
          [cacheKey]: {
            data: usageInfo,
            timestamp: now,
          },
        }));

        return usageInfo;
      } catch (error) {
        console.error('Error fetching usage info:', error);
        return null;
      }
    },
    [userProfile?.tenant_id, usageCache],
  );

  // Record usage for add-on
  const trackUsage = useCallback(
    async (addonType, usageType, quantity = 1, metadata = {}) => {
      if (!userProfile?.tenant_id) {
        return false;
      }

      try {
        const success = await recordAddOnUsage(
          userProfile.tenant_id,
          addonType,
          usageType,
          quantity,
          metadata,
        );

        if (success) {
          // Clear cache for this add-on
          const cacheKey = `${userProfile.tenant_id}-${addonType}`;
          setUsageCache((prev) => {
            const newCache = { ...prev };
            delete newCache[cacheKey];
            return newCache;
          });

          // Refresh active add-ons
          await fetchActiveAddOns();
        }

        return success;
      } catch (error) {
        console.error('Error tracking usage:', error);
        return false;
      }
    },
    [userProfile?.tenant_id, fetchActiveAddOns],
  );

  // Subscribe to new add-on
  const subscribe = useCallback(
    async (addonId, billingFrequency = 'monthly') => {
      if (!userProfile?.tenant_id) {
        throw new Error('No tenant ID available');
      }

      try {
        const result = await subscribeToAddOn(
          userProfile.tenant_id,
          addonId,
          billingFrequency,
        );

        // Refresh active add-ons
        await fetchActiveAddOns();

        return result;
      } catch (error) {
        console.error('Error subscribing to add-on:', error);
        throw error;
      }
    },
    [userProfile?.tenant_id, fetchActiveAddOns],
  );

  // Unsubscribe from add-on
  const unsubscribe = useCallback(
    async (addonId) => {
      if (!userProfile?.tenant_id) {
        throw new Error('No tenant ID available');
      }

      try {
        const result = await unsubscribeFromAddOn(userProfile.tenant_id, addonId);

        // Refresh active add-ons
        await fetchActiveAddOns();

        return result;
      } catch (error) {
        console.error('Error unsubscribing from add-on:', error);
        throw error;
      }
    },
    [userProfile?.tenant_id, fetchActiveAddOns],
  );

  // Get usage history
  const getUsageHistory = useCallback(
    async (options = {}) => {
      if (!userProfile?.tenant_id) {
        return [];
      }

      try {
        return await getAddOnUsageLogs(userProfile.tenant_id, options);
      } catch (error) {
        console.error('Error fetching usage history:', error);
        return [];
      }
    },
    [userProfile?.tenant_id],
  );

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([fetchAvailableAddOns(), fetchActiveAddOns()]);
  }, [fetchAvailableAddOns, fetchActiveAddOns]);

  // Initial load
  useEffect(() => {
    if (userProfile?.tenant_id) {
      refresh();
    }
  }, [userProfile?.tenant_id, refresh]);

  const value = {
    // State
    availableAddOns,
    activeAddOns,
    loading,

    // Methods
    hasAddOn,
    getUsageInfo,
    trackUsage,
    subscribe,
    unsubscribe,
    getUsageHistory,
    refresh,
  };

  return <AddOnsContext.Provider value={value}>{children}</AddOnsContext.Provider>;
}

AddOnsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Custom hooks for easier usage
export function useAddOns() {
  const context = useContext(AddOnsContext);
  if (!context) {
    throw new Error('useAddOns must be used within AddOnsProvider');
  }
  return context;
}

// Hook to check if tenant has specific add-on
export function useHasAddOn(addonType) {
  const { hasAddOn } = useAddOns();
  const [has, setHas] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      if (!addonType) {
        setChecking(false);
        return;
      }

      setChecking(true);
      const result = await hasAddOn(addonType);

      if (mounted) {
        setHas(result);
        setChecking(false);
      }
    }

    check();

    return () => {
      mounted = false;
    };
  }, [addonType, hasAddOn]);

  return { has, checking };
}

// Hook to get usage info for add-on
export function useAddOnUsage(addonType) {
  const { getUsageInfo } = useAddOns();
  const [usageInfo, setUsageInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchUsage() {
      if (!addonType) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const info = await getUsageInfo(addonType);

      if (mounted) {
        setUsageInfo(info);
        setLoading(false);
      }
    }

    fetchUsage();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [addonType, getUsageInfo]);

  return { usageInfo, loading };
}

export default AddOnsContext;
