/**
 * Dynamic Pricing Service
 * Implements Uber-style surge pricing for drinks
 * Adjusts prices based on demand, time, events, and custom rules
 */

import { supabase } from '../supabaseClient';

/**
 * Calculate dynamic price for a product
 * @param {string} productId - Product ID
 * @param {Object} context - { eventId, locationId, timestamp }
 * @returns {Promise<Object>} Price calculation result
 */
export async function calculateDynamicPrice(productId, context = {}) {
  try {
    const { eventId, locationId, timestamp = new Date() } = context;

    // Get user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }
    const { data: product } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('id', productId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!product) {
      throw new Error('Product not found');
    }

    const basePrice = parseFloat(product.price);

    // Get applicable pricing rules
    const rules = await getApplicablePricingRules(
      productId,
      profile.tenant_id,
      { eventId, locationId, timestamp },
    );

    if (rules.length === 0) {
      // No rules apply, return base price
      return {
        productId,
        productName: product.name,
        basePrice,
        finalPrice: basePrice,
        appliedRules: [],
        totalMultiplier: 1.0,
        priceChange: 0,
        priceChangePercentage: 0,
      };
    }

    // Apply rules (highest priority first)
    const appliedRules = [];
    let totalMultiplier = 1.0;

    for (const rule of rules) {
      const ruleMultiplier = calculateRuleMultiplier(rule, {
        productId,
        tenantId: profile.tenant_id,
        timestamp,
      });

      totalMultiplier *= ruleMultiplier;

      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.rule_name,
        ruleType: rule.rule_type,
        multiplier: ruleMultiplier,
        priority: rule.priority,
      });
    }

    // Calculate final price
    let finalPrice = basePrice * totalMultiplier;

    // Apply min/max constraints from rules
    for (const rule of rules) {
      if (rule.min_price && finalPrice < rule.min_price) {
        finalPrice = rule.min_price;
      }
      if (rule.max_price && finalPrice > rule.max_price) {
        finalPrice = rule.max_price;
      }
    }

    // Round to 2 decimals
    finalPrice = Math.round(finalPrice * 100) / 100;

    const priceChange = finalPrice - basePrice;
    const priceChangePercentage = ((finalPrice - basePrice) / basePrice) * 100;

    return {
      productId,
      productName: product.name,
      basePrice,
      finalPrice,
      appliedRules,
      totalMultiplier: Math.round(totalMultiplier * 100) / 100,
      priceChange: Math.round(priceChange * 100) / 100,
      priceChangePercentage: Math.round(priceChangePercentage * 100) / 100,
    };

  } catch (error) {
    console.error('Error calculating dynamic price:', error);
    throw error;
  }
}

/**
 * Get applicable pricing rules for a product
 * @param {string} productId - Product ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} context - { eventId, locationId, timestamp }
 * @returns {Promise<Array>} Applicable rules
 */
async function getApplicablePricingRules(productId, tenantId, context) {
  const { eventId, locationId, timestamp } = context;

  const dayOfWeek = timestamp.getDay();
  const currentDate = timestamp.toISOString().split('T')[0];
  const currentTime = timestamp.toTimeString().split(' ')[0].substring(0, 5);

  // Get recent demand (transactions in last hour)
  const oneHourAgo = new Date(timestamp);
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('created_at', oneHourAgo.toISOString())
    .eq('status', 'completed');

  const recentDemand = recentTransactions ? recentTransactions.length : 0;

  // Query pricing rules
  const query = supabase
    .from('pricing_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  const { data: allRules, error } = await query;

  if (error) {
    console.error('Error fetching pricing rules:', error);
    return [];
  }

  if (!allRules || allRules.length === 0) {
    return [];
  }

  // Filter rules based on conditions
  const applicableRules = allRules.filter(rule => {
    // Check product match
    if (rule.product_id && rule.product_id !== productId) {
      return false;
    }

    // Check location match
    if (rule.location_id && rule.location_id !== locationId) {
      return false;
    }

    // Check event match
    if (rule.event_id && rule.event_id !== eventId) {
      return false;
    }

    // Check date range
    if (rule.valid_date_start && currentDate < rule.valid_date_start) {
      return false;
    }
    if (rule.valid_date_end && currentDate > rule.valid_date_end) {
      return false;
    }

    // Check time range
    if (rule.valid_time_start && currentTime < rule.valid_time_start) {
      return false;
    }
    if (rule.valid_time_end && currentTime > rule.valid_time_end) {
      return false;
    }

    // Check day of week
    if (rule.valid_days_of_week) {
      const validDays = rule.valid_days_of_week;
      // eslint-disable-next-line no-undef
      if (Array.isArray(validDays) && !validDays.includes(dayOfWeek)) {
        return false;
      }
    }

    // Check demand threshold
    if (rule.demand_threshold && recentDemand < rule.demand_threshold) {
      return false;
    }

    return true;
  });

  return applicableRules;
}

/**
 * Calculate multiplier from a pricing rule
 * @param {Object} rule - Pricing rule
 * @param {Object} _context - Additional context
 * @returns {number} Multiplier
 */
function calculateRuleMultiplier(rule, _context) {
  let multiplier = 1.0;

  // Apply each multiplier type
  if (rule.peak_multiplier) {
    multiplier *= parseFloat(rule.peak_multiplier);
  }

  if (rule.event_multiplier) {
    multiplier *= parseFloat(rule.event_multiplier);
  }

  if (rule.time_multiplier) {
    multiplier *= parseFloat(rule.time_multiplier);
  }

  if (rule.demand_multiplier) {
    multiplier *= parseFloat(rule.demand_multiplier);
  }

  return multiplier;
}

/**
 * Calculate dynamic prices for multiple products
 * @param {Array<string>} productIds - Array of product IDs
 * @param {Object} context - { eventId, locationId, timestamp }
 * @returns {Promise<Array>} Array of price calculations
 */
export async function calculateBatchDynamicPrices(productIds, context = {}) {
  try {
    const priceCalculations = await Promise.all(
      productIds.map(productId => calculateDynamicPrice(productId, context)),
    );

    return priceCalculations;

  } catch (error) {
    console.error('Error calculating batch prices:', error);
    throw error;
  }
}

/**
 * Create a new pricing rule
 * @param {Object} ruleData - Pricing rule data
 * @returns {Promise<Object>} Created rule
 */
export async function createPricingRule(ruleData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      throw new Error('Insufficient permissions');
    }

    const rule = {
      tenant_id: profile.tenant_id,
      created_by: user.id,
      ...ruleData,
    };

    const { data, error } = await supabase
      .from('pricing_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      rule: data,
    };

  } catch (error) {
    console.error('Error creating pricing rule:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update a pricing rule
 * @param {string} ruleId - Rule ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated rule
 */
export async function updatePricingRule(ruleId, updates) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      throw new Error('Insufficient permissions');
    }

    const { data, error } = await supabase
      .from('pricing_rules')
      .update(updates)
      .eq('id', ruleId)
      .eq('tenant_id', profile.tenant_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      rule: data,
    };

  } catch (error) {
    console.error('Error updating pricing rule:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete a pricing rule
 * @param {string} ruleId - Rule ID
 * @returns {Promise<Object>} Result
 */
export async function deletePricingRule(ruleId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      throw new Error('Insufficient permissions');
    }

    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', ruleId)
      .eq('tenant_id', profile.tenant_id);

    if (error) {
      throw error;
    }

    return {
      success: true,
    };

  } catch (error) {
    console.error('Error deleting pricing rule:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get all pricing rules for current tenant
 * @returns {Promise<Array>} Pricing rules
 */
export async function getPricingRules() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const { data, error } = await supabase
      .from('pricing_rules')
      .select(`
        *,
        products (
          name,
          sku
        ),
        locations (
          name
        ),
        events (
          name
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .order('priority', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    return [];
  }
}

/**
 * Log price change to price history
 * @param {string} productId - Product ID
 * @param {number} oldPrice - Old price
 * @param {number} newPrice - New price
 * @param {string} reason - Change reason
 * @param {Object} appliedMultipliers - Multipliers object
 * @returns {Promise<void>}
 */
export async function logPriceChange(productId, oldPrice, newPrice, reason, appliedMultipliers = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return;
    }

    const priceChangePercentage = ((newPrice - oldPrice) / oldPrice) * 100;

    await supabase
      .from('price_history')
      .insert({
        tenant_id: profile.tenant_id,
        product_id: productId,
        old_price: oldPrice,
        new_price: newPrice,
        price_change_percentage: Math.round(priceChangePercentage * 100) / 100,
        change_reason: reason,
        applied_multipliers: appliedMultipliers,
        changed_by: user.id,
      });

  } catch (error) {
    console.error('Error logging price change:', error);
  }
}

/**
 * Get price history for a product
 * @param {string} productId - Product ID
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Price history
 */
export async function getPriceHistory(productId, limit = 50) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('product_id', productId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching price history:', error);
    return [];
  }
}

/**
 * Create pre-defined pricing rules (Happy Hour, Peak Hours, Events)
 * @returns {Promise<Object>} Results
 */
export async function createDefaultPricingRules() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      throw new Error('Insufficient permissions');
    }
    const defaultRules = [
      {
        tenant_id: profile.tenant_id,
        rule_name: 'Happy Hour - 50% Off',
        rule_type: 'happy_hour',
        priority: 10,
        base_price: 0,
        time_multiplier: 0.5, // 50% discount
        valid_days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
        valid_time_start: '17:00:00',
        valid_time_end: '19:00:00',
        is_active: true,
        created_by: user.id,
      },
      {
        tenant_id: profile.tenant_id,
        rule_name: 'Peak Hours - 30% Surge',
        rule_type: 'time_based',
        priority: 5,
        base_price: 0,
        peak_multiplier: 1.3, // 30% increase
        valid_days_of_week: [5, 6], // Friday, Saturday
        valid_time_start: '22:00:00',
        valid_time_end: '02:00:00',
        is_active: true,
        created_by: user.id,
      },
      {
        tenant_id: profile.tenant_id,
        rule_name: 'High Demand Surge - 50%',
        rule_type: 'demand_based',
        priority: 8,
        base_price: 0,
        demand_multiplier: 1.5, // 50% increase
        demand_threshold: 30, // When 30+ transactions in last hour
        is_active: true,
        created_by: user.id,
      },
    ];

    const { data, error } = await supabase
      .from('pricing_rules')
      .insert(defaultRules)
      .select();

    if (error) {
      throw error;
    }

    return {
      success: true,
      rules: data,
      count: data.length,
    };

  } catch (error) {
    console.error('Error creating default pricing rules:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
