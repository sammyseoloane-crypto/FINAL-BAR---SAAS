/**
 * ADD-ONS UTILITIES
 * Helper functions and constants for managing subscription add-ons
 */

import { supabase } from '../supabaseClient';

// =====================================================
// ADD-ON TYPES
// =====================================================
export const ADDON_TYPES = {
  SMS_MARKETING: 'sms_marketing',
  BOOKING_FEES: 'booking_fees',
  TRANSACTION_FEES: 'transaction_fees',
  CUSTOM: 'custom',
};

// =====================================================
// ADD-ON METADATA
// =====================================================
export const ADDON_INFO = {
  [ADDON_TYPES.SMS_MARKETING]: {
    name: 'SMS Marketing',
    icon: '📱',
    color: '#10B981',
    description: 'Send SMS campaigns for events, specials, and VIP invitations',
    benefits: [
      'Bulk SMS campaigns',
      'Event reminders',
      'Drink specials alerts',
      'VIP invitations',
      'Automated notifications',
      'SMS templates',
      'Delivery reports',
    ],
  },
  [ADDON_TYPES.BOOKING_FEES]: {
    name: 'Table Booking Fees',
    icon: '💰',
    color: '#F59E0B',
    description: 'Earn revenue on every VIP table reservation',
    benefits: [
      'R5 per reservation',
      'Automated fee collection',
      'Revenue reports',
      'Integration with VIP Tables',
      'Monthly summaries',
    ],
  },
  [ADDON_TYPES.TRANSACTION_FEES]: {
    name: 'Transaction Fees',
    icon: '💳',
    color: '#d4af37',
    description: 'Earn passive income on payment processing',
    benefits: [
      '0.5% - 1% per transaction',
      'Automated fee calculation',
      'Transaction analytics',
      'Monthly reports',
      'Priority support',
    ],
  },
};

// =====================================================
// FETCH ALL AVAILABLE ADD-ONS
// =====================================================
export async function getAvailableAddOns(tierFilter = null) {
  try {
    let query = supabase
      .from('subscription_addons')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (tierFilter) {
      query = query.contains('available_for_tiers', [tierFilter]);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching available add-ons:', error);
    return [];
  }
}

// =====================================================
// FETCH TENANT'S ACTIVE ADD-ONS
// =====================================================
export async function getTenantAddOns(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenant_addons')
      .select(`
        *,
        addon:subscription_addons(*)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching tenant add-ons:', error);
    return [];
  }
}

// =====================================================
// CHECK IF TENANT HAS SPECIFIC ADD-ON
// =====================================================
export async function checkTenantHasAddOn(tenantId, addonType) {
  try {
    const { data, error } = await supabase.rpc('check_tenant_has_addon', {
      p_tenant_id: tenantId,
      p_addon_type: addonType,
    });

    if (error) {
      throw error;
    }
    return data === true;
  } catch (error) {
    console.error('Error checking tenant add-on:', error);
    return false;
  }
}

// =====================================================
// CHECK ADD-ON USAGE LIMITS
// =====================================================
export async function checkAddOnUsage(tenantId, addonType) {
  try {
    const { data, error } = await supabase.rpc('check_addon_usage_limit', {
      p_tenant_id: tenantId,
      p_addon_type: addonType,
    });

    if (error) {
      throw error;
    }
    return data?.[0] || null;
  } catch (error) {
    console.error('Error checking add-on usage:', error);
    return null;
  }
}

// =====================================================
// RECORD ADD-ON USAGE
// =====================================================
export async function recordAddOnUsage(
  tenantId,
  addonType,
  usageType,
  quantity = 1,
  metadata = {}) {
  try {
    const { data, error } = await supabase.rpc('record_addon_usage', {
      p_tenant_id: tenantId,
      p_addon_type: addonType,
      p_usage_type: usageType,
      p_quantity: quantity,
      p_metadata: metadata,
    });

    if (error) {
      throw error;
    }
    return data === true;
  } catch (error) {
    console.error('Error recording add-on usage:', error);
    return false;
  }
}

// =====================================================
// SUBSCRIBE TO ADD-ON
// =====================================================
export async function subscribeToAddOn(tenantId, addonId, billingFrequency = 'monthly') {
  try {
    const { data: addon, error: addonError } = await supabase
      .from('subscription_addons')
      .select('*')
      .eq('id', addonId)
      .single();

    if (addonError) {
      throw addonError;
    }

    // Calculate next billing date
    const nextBillingDate = new Date();
    if (billingFrequency === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    const { data, error } = await supabase
      .from('tenant_addons')
      .insert({
        tenant_id: tenantId,
        addon_id: addonId,
        billing_frequency: billingFrequency,
        is_active: true,
        current_usage: 0,
        usage_limit: addon.is_usage_based ? addon.included_units : null,
        next_billing_date: nextBillingDate.toISOString(),
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error subscribing to add-on:', error);
    throw error;
  }
}

// =====================================================
// UNSUBSCRIBE FROM ADD-ON
// =====================================================
export async function unsubscribeFromAddOn(tenantId, addonId) {
  try {
    const { data, error } = await supabase
      .from('tenant_addons')
      .update({
        is_active: false,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('addon_id', addonId)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error unsubscribing from add-on:', error);
    throw error;
  }
}

// =====================================================
// GET ADD-ON USAGE LOGS
// =====================================================
export async function getAddOnUsageLogs(tenantId, options = {}) {
  try {
    const { addonType, startDate, endDate, limit = 100 } = options;

    let query = supabase
      .from('addon_usage_logs')
      .select(`
        *,
        addon:subscription_addons(name, addon_type)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (addonType) {
      query = query.eq('addon.addon_type', addonType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    return [];
  }
}

// =====================================================
// CALCULATE ADD-ON COSTS
// =====================================================
export function calculateAddOnCost(addon, billingFrequency = 'monthly', usage = 0) {
  if (!addon) {
    return 0;
  }

  // Base subscription cost
  let baseCost = billingFrequency === 'monthly'
    ? addon.price_monthly
    : addon.price_yearly;

  // Add usage-based costs
  if (addon.is_usage_based && usage > addon.included_units) {
    const billableUsage = usage - addon.included_units;
    baseCost += billableUsage * addon.price_per_unit;
  }

  return baseCost;
}

// =====================================================
// FORMAT CURRENCY
// =====================================================
export function formatCurrency(amount) {
  return `R${parseFloat(amount || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// =====================================================
// GET ADD-ON SAVINGS (YEARLY VS MONTHLY)
// =====================================================
export function getAddOnSavings(addon) {
  if (!addon) {
    return 0;
  }
  const yearlyMonthly = addon.price_yearly / 12;
  const monthlyCost = addon.price_monthly;
  const savings = (monthlyCost - yearlyMonthly) * 12;
  return Math.max(0, savings);
}

// =====================================================
// GET USAGE PERCENTAGE
// =====================================================
export function getUsagePercentage(current, limit) {
  if (!limit || limit === 0 || limit >= 999999) {
    return 0;
  }
  return Math.min(100, (current / limit) * 100);
}

// =====================================================
// GET USAGE STATUS COLOR
// =====================================================
export function getUsageStatusColor(percentage) {
  if (percentage >= 100) {
    return 'danger';
  }
  if (percentage >= 80) {
    return 'warning';
  }
  return 'success';
}
