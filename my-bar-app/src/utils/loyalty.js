/**
 * Loyalty Utilities
 * Helper functions for loyalty points and rewards management
 */

import { supabase } from '../supabaseClient';

/**
 * Get customer loyalty data
 */
export const getCustomerLoyalty = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('customer_loyalty')
      .select(
        `
        *,
        loyalty_programs (
          name,
          points_per_dollar,
          points_per_visit,
          tier_system
        )
      `,
      )
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching customer loyalty:', error);
    return null;
  }
};

/**
 * Calculate points earned for a purchase
 */
export const calculatePointsEarned = async (amount, userId) => {
  try {
    const loyaltyData = await getCustomerLoyalty(userId);

    if (!loyaltyData || !loyaltyData.loyalty_programs) {
      return 0;
    }

    const pointsPerDollar = loyaltyData.loyalty_programs.points_per_dollar || 1;
    const points = Math.floor(parseFloat(amount) * pointsPerDollar);

    return points;
  } catch (error) {
    console.error('Error calculating points:', error);
    return 0;
  }
};

/**
 * Award points to customer
 */
export const awardPoints = async (userId, points, description, referenceId = null) => {
  try {
    // Get customer loyalty record
    const loyaltyData = await getCustomerLoyalty(userId);

    if (!loyaltyData) {
      console.error('Customer loyalty record not found');
      return { success: false, error: 'Loyalty record not found' };
    }

    // Create loyalty transaction
    const { data: transaction, error: transError } = await supabase
      .from('loyalty_transactions')
      .insert([
        {
          customer_loyalty_id: loyaltyData.id,
          points_earned: points,
          points_redeemed: 0,
          description: description,
          reference_type: referenceId ? 'transaction' : null,
          reference_id: referenceId,
        },
      ])
      .select()
      .single();

    if (transError) {
      throw transError;
    }

    // Update customer loyalty balance
    const newBalance = (loyaltyData.points_balance || 0) + points;
    const newLifetime = (loyaltyData.lifetime_points || 0) + points;

    const { error: updateError } = await supabase
      .from('customer_loyalty')
      .update({
        points_balance: newBalance,
        lifetime_points: newLifetime,
        last_transaction_date: new Date().toISOString(),
      })
      .eq('id', loyaltyData.id);

    if (updateError) {
      throw updateError;
    }

    return { success: true, transaction, newBalance };
  } catch (error) {
    console.error('Error awarding points:', error);
    return { success: false, error };
  }
};

/**
 * Redeem reward
 */
export const redeemReward = async (userId, rewardId) => {
  try {
    const loyaltyData = await getCustomerLoyalty(userId);

    if (!loyaltyData) {
      return { success: false, error: 'Loyalty record not found' };
    }

    // Fetch reward details
    const { data: reward, error: rewardError } = await supabase
      .from('rewards_catalog')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError) {
      throw rewardError;
    }

    // Check if customer has enough points
    if (loyaltyData.points_balance < reward.points_cost) {
      return { success: false, error: 'Insufficient points' };
    }

    // Check if reward is active and not expired
    if (!reward.active) {
      return { success: false, error: 'Reward is not active' };
    }

    if (reward.expiry_date && new Date(reward.expiry_date) < new Date()) {
      return { success: false, error: 'Reward has expired' };
    }

    // Create redemption transaction
    const { data: transaction, error: transError } = await supabase
      .from('loyalty_transactions')
      .insert([
        {
          customer_loyalty_id: loyaltyData.id,
          points_earned: 0,
          points_redeemed: reward.points_cost,
          description: `Redeemed: ${reward.name}`,
          reference_type: 'reward',
          reference_id: reward.id,
        },
      ])
      .select()
      .single();

    if (transError) {
      throw transError;
    }

    // Update customer balance
    const newBalance = loyaltyData.points_balance - reward.points_cost;
    const newRedeemed = (loyaltyData.points_redeemed || 0) + reward.points_cost;

    const { error: updateError } = await supabase
      .from('customer_loyalty')
      .update({
        points_balance: newBalance,
        points_redeemed: newRedeemed,
        last_transaction_date: new Date().toISOString(),
      })
      .eq('id', loyaltyData.id);

    if (updateError) {
      throw updateError;
    }

    return { success: true, transaction, reward, newBalance };
  } catch (error) {
    console.error('Error redeeming reward:', error);
    return { success: false, error };
  }
};

/**
 * Get loyalty transaction history
 */
export const getLoyaltyHistory = async (userId, limit = 50) => {
  try {
    const loyaltyData = await getCustomerLoyalty(userId);

    if (!loyaltyData) {
      return [];
    }

    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_loyalty_id', loyaltyData.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching loyalty history:', error);
    return [];
  }
};

/**
 * Check and update customer tier
 */
export const updateCustomerTier = async (userId) => {
  try {
    const loyaltyData = await getCustomerLoyalty(userId);

    if (!loyaltyData || !loyaltyData.loyalty_programs?.tier_system) {
      return { success: false, error: 'No tier system configured' };
    }

    // tierSystem available for future customization
    // const tierSystem = loyaltyData.loyalty_programs.tier_system;
    const lifetimePoints = loyaltyData.lifetime_points || 0;

    let newTier = 'bronze';

    // Example tier logic (customize based on your tier system)
    if (lifetimePoints >= 10000) {
      newTier = 'vip';
    } else if (lifetimePoints >= 5000) {
      newTier = 'platinum';
    } else if (lifetimePoints >= 2000) {
      newTier = 'gold';
    } else if (lifetimePoints >= 500) {
      newTier = 'silver';
    }

    // Only update if tier changed
    if (newTier !== loyaltyData.current_tier) {
      const { error } = await supabase
        .from('customer_loyalty')
        .update({ current_tier: newTier })
        .eq('id', loyaltyData.id);

      if (error) {
        throw error;
      }

      return { success: true, oldTier: loyaltyData.current_tier, newTier };
    }

    return { success: true, tier: newTier, changed: false };
  } catch (error) {
    console.error('Error updating customer tier:', error);
    return { success: false, error };
  }
};

/**
 * Get available rewards for customer
 */
export const getAvailableRewards = async (userId, tenantId) => {
  try {
    const loyaltyData = await getCustomerLoyalty(userId);

    const { data: rewards, error } = await supabase
      .from('rewards_catalog')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('points_cost', { ascending: true });

    if (error) {
      throw error;
    }

    // Filter rewards customer can afford
    const affordable = rewards.filter(
      (r) =>
        (!r.expiry_date || new Date(r.expiry_date) >= new Date()) &&
        (loyaltyData ? r.points_cost <= loyaltyData.points_balance : false),
    );

    return {
      all: rewards,
      affordable: affordable,
      currentBalance: loyaltyData?.points_balance || 0,
    };
  } catch (error) {
    console.error('Error fetching available rewards:', error);
    return {
      all: [],
      affordable: [],
      currentBalance: 0,
    };
  }
};

/**
 * Format points with comma separator
 */
export const formatPoints = (points) => {
  return parseInt(points || 0).toLocaleString();
};
