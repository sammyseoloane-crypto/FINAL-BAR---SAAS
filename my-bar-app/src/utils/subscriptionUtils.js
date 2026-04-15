import { supabase } from '../supabaseClient';

/**
 * Subscription tier definitions matching database
 */
export const SUBSCRIPTION_TIERS = {
  TRIAL: 'trial',
  STARTER: 'starter',
  GROWTH: 'growth',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

/**
 * Tier hierarchy for upgrade comparisons
 */
export const TIER_HIERARCHY = {
  trial: 0,
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4,
};

/**
 * Tier display information
 */
export const TIER_INFO = {
  trial: {
    name: '🎯 Free Trial',
    price: 'Free for 14 days',
    color: 'gray',
  },
  starter: {
    name: '💰 Starter Plan',
    price: 'R1,200 /month',
    color: 'blue',
  },
  growth: {
    name: '🍸 Growth Plan ⭐',
    price: 'R2,900 /month',
    color: 'green',
  },
  pro: {
    name: '🏆 Pro Nightclub Plan',
    price: 'R5,900 /month',
    color: 'purple',
  },
  enterprise: {
    name: '👑 Enterprise Venue Plan',
    price: 'R9,500 /month',
    color: 'gold',
  },
};

/**
 * Feature access definitions
 */
export const FEATURES = {
  // Core features (all tiers)
  POS_SYSTEM: 'pos_system',
  INVENTORY_MANAGEMENT: 'inventory_management',
  QR_PAYMENTS: 'qr_payments',
  EVENT_TICKETING: 'event_ticketing',
  DIGITAL_MENU: 'digital_menu',
  BASIC_CUSTOMER_PROFILES: 'basic_customer_profiles',
  DAILY_REVENUE_REPORTS: 'daily_revenue_reports',
  BASIC_SALES_REPORTS: 'basic_sales_reports',

  // Growth+ features
  VIP_TABLES: 'vip_tables',
  BOTTLE_SERVICE: 'bottle_service',
  GUEST_LISTS: 'guest_lists',
  PROMOTER_ACCOUNTS: 'promoter_accounts',
  BAR_TABS: 'bar_tabs',
  LOYALTY_PROGRAM: 'loyalty_program',
  VIP_CUSTOMER_TRACKING: 'vip_customer_tracking',
  STAFF_PERFORMANCE: 'staff_performance',
  INVENTORY_ALERTS: 'inventory_alerts',
  WEEKLY_REVENUE_REPORTS: 'weekly_revenue_reports',
  DRINK_ANALYTICS: 'drink_analytics',

  // Pro+ features
  FULL_POS: 'full_pos',
  TABLE_LAYOUT_MANAGER: 'table_layout_manager',
  BOTTLE_PACKAGES: 'bottle_packages',
  MULTI_EVENT_MANAGEMENT: 'multi_event_management',
  VIP_TIERS: 'vip_tiers',
  CUSTOMER_SPENDING_ANALYTICS: 'customer_spending_analytics',
  MARKETING_AUTOMATION: 'marketing_automation',
  AI_ANALYTICS: 'ai_analytics',
  AI_DEMAND_PREDICTION: 'ai_demand_prediction',
  DYNAMIC_PRICING: 'dynamic_pricing',
  INVENTORY_PREDICTIONS: 'inventory_predictions',
  EVENT_REVENUE_TRACKING: 'event_revenue_tracking',
  HOURLY_SALES_HEATMAPS: 'hourly_sales_heatmaps',
  STAFF_SALES_RANKINGS: 'staff_sales_rankings',

  // Enterprise features
  MULTI_LOCATION_MANAGEMENT: 'multi_location_management',
  FRANCHISE_DASHBOARD: 'franchise_dashboard',
  ADVANCED_PERMISSIONS: 'advanced_permissions',
  API_ACCESS: 'api_access',
  CUSTOM_INTEGRATIONS: 'custom_integrations',
  PUBLIC_EVENT_DISCOVERY: 'public_event_discovery',
  CUSTOMER_APP_ACCESS: 'customer_app_access',
  CROSS_VENUE_PROMOTIONS: 'cross_venue_promotions',
  AI_REVENUE_FORECASTING: 'ai_revenue_forecasting',
  CROWD_ANALYTICS: 'crowd_analytics',
  VIP_SPENDING_TRENDS: 'vip_spending_trends',
  WHITE_LABEL: 'white_label',
  DEDICATED_SUPPORT: 'dedicated_support',
  ONBOARDING: 'onboarding',
};

/**
 * Feature display names
 */
export const FEATURE_NAMES = {
  [FEATURES.VIP_TABLES]: 'VIP Table Booking',
  [FEATURES.BOTTLE_SERVICE]: 'Bottle Service',
  [FEATURES.GUEST_LISTS]: 'Guest List Management',
  [FEATURES.PROMOTER_ACCOUNTS]: 'Promoter Accounts',
  [FEATURES.BAR_TABS]: 'Digital Bar Tabs',
  [FEATURES.LOYALTY_PROGRAM]: 'Loyalty Program',
  [FEATURES.AI_ANALYTICS]: 'AI Analytics',
  [FEATURES.DYNAMIC_PRICING]: 'Dynamic Pricing',
  [FEATURES.TABLE_LAYOUT_MANAGER]: 'Table Layout Manager',
  [FEATURES.MULTI_LOCATION_MANAGEMENT]: 'Multi-Location Management',
  [FEATURES.FRANCHISE_DASHBOARD]: 'Franchise Dashboard',
  [FEATURES.API_ACCESS]: 'API Access',
  // Add more as needed
};

/**
 * Minimum tier required for each feature
 */
export const FEATURE_TIER_REQUIREMENTS = {
  [FEATURES.VIP_TABLES]: SUBSCRIPTION_TIERS.GROWTH,
  [FEATURES.BOTTLE_SERVICE]: SUBSCRIPTION_TIERS.GROWTH,
  [FEATURES.GUEST_LISTS]: SUBSCRIPTION_TIERS.GROWTH,
  [FEATURES.PROMOTER_ACCOUNTS]: SUBSCRIPTION_TIERS.GROWTH,
  [FEATURES.BAR_TABS]: SUBSCRIPTION_TIERS.GROWTH,
  [FEATURES.LOYALTY_PROGRAM]: SUBSCRIPTION_TIERS.GROWTH,
  [FEATURES.AI_ANALYTICS]: SUBSCRIPTION_TIERS.PRO,
  [FEATURES.DYNAMIC_PRICING]: SUBSCRIPTION_TIERS.PRO,
  [FEATURES.TABLE_LAYOUT_MANAGER]: SUBSCRIPTION_TIERS.PRO,
  [FEATURES.MULTI_LOCATION_MANAGEMENT]: SUBSCRIPTION_TIERS.ENTERPRISE,
  [FEATURES.FRANCHISE_DASHBOARD]: SUBSCRIPTION_TIERS.ENTERPRISE,
  [FEATURES.API_ACCESS]: SUBSCRIPTION_TIERS.ENTERPRISE,
};

/**
 * Get tenant's subscription details
 */
export async function getTenantSubscription(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenant_subscription_details')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching tenant subscription:', error);
    return null;
  }
}

/**
 * Check if tenant has access to a feature
 */
export async function checkFeatureAccess(tenantId, featureName) {
  try {
    const { data, error } = await supabase.rpc('check_feature_access', {
      p_tenant_id: tenantId,
      p_feature_name: featureName,
    });

    if (error) {
      throw error;
    }
    return data === true;
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
}

/**
 * Check usage limits for staff, locations, products, or events
 */
export async function checkUsageLimit(tenantId, limitType) {
  try {
    const { data, error } = await supabase.rpc('check_usage_limit', {
      p_tenant_id: tenantId,
      p_limit_type: limitType,
    });

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return null;
  }
}

/**
 * Check if user can perform an action based on limits
 */
export async function canPerformAction(tenantId, limitType) {
  const limitInfo = await checkUsageLimit(tenantId, limitType);
  if (!limitInfo) {
    return false;
  }

  return !limitInfo.is_at_limit;
}

/**
 * Compare two tiers
 */
export function compareTiers(tier1, tier2) {
  const level1 = TIER_HIERARCHY[tier1] || 0;
  const level2 = TIER_HIERARCHY[tier2] || 0;
  return level1 - level2;
}

/**
 * Check if a tier is higher than another
 */
export function isTierHigherOrEqual(currentTier, requiredTier) {
  return compareTiers(currentTier, requiredTier) >= 0;
}

/**
 * Get upgrade suggestions for a feature
 */
export function getUpgradeTierForFeature(featureName) {
  return FEATURE_TIER_REQUIREMENTS[featureName] || SUBSCRIPTION_TIERS.ENTERPRISE;
}

/**
 * Format subscription price
 */
export function formatPrice(amount, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get all subscription plans
 */
export async function getSubscriptionPlans() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return [];
  }
}

/**
 * Update tenant subscription tier
 */
export async function updateTenantTier(tenantId, newTier) {
  try {
    // Get the plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('tier', newTier)
      .single();

    if (planError) {
      throw planError;
    }

    // Update tenant with new tier and limits
    const { data, error } = await supabase
      .from('tenants')
      .update({
        subscription_tier: newTier,
        max_locations: plan.max_locations,
        max_staff: plan.max_staff,
        max_products: plan.max_products,
        max_monthly_transactions: plan.max_monthly_transactions,
        max_events_per_month: plan.max_events_per_month,
        transaction_fee_percentage: plan.transaction_fee_percentage,
        features: plan.features,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error updating tenant tier:', error);
    throw error;
  }
}

/**
 * Get features comparison for all tiers
 */
export function getFeaturesComparison() {
  return [
    { feature: 'POS System', starter: true, growth: true, pro: true, enterprise: true },
    { feature: 'Inventory Management', starter: true, growth: true, pro: true, enterprise: true },
    { feature: 'QR Payments', starter: true, growth: true, pro: true, enterprise: true },
    { feature: 'Event Ticketing', starter: true, growth: true, pro: true, enterprise: true },
    { feature: 'Staff Accounts', starter: '3', growth: '10', pro: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'Events per Month', starter: '2', growth: '10', pro: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'Venue Locations', starter: '1', growth: '2', pro: '3', enterprise: 'Unlimited' },
    { feature: 'VIP Table Booking', starter: false, growth: true, pro: true, enterprise: true },
    { feature: 'Bottle Service', starter: false, growth: true, pro: true, enterprise: true },
    { feature: 'Guest Lists', starter: false, growth: true, pro: true, enterprise: true },
    { feature: 'Loyalty Program', starter: false, growth: true, pro: true, enterprise: true },
    { feature: 'Digital Bar Tabs', starter: false, growth: true, pro: true, enterprise: true },
    { feature: 'AI Analytics', starter: false, growth: false, pro: true, enterprise: true },
    { feature: 'Dynamic Pricing', starter: false, growth: false, pro: true, enterprise: true },
    { feature: 'Multi-Venue Management', starter: false, growth: 'Limited', pro: 'Limited', enterprise: true },
    { feature: 'API Access', starter: false, growth: false, pro: false, enterprise: true },
    { feature: 'Franchise Dashboard', starter: false, growth: false, pro: false, enterprise: true },
    { feature: 'Dedicated Support', starter: false, growth: false, pro: false, enterprise: true },
  ];
}
