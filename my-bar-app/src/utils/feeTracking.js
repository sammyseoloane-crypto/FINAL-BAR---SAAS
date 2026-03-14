/**
 * TRANSACTION FEE TRACKING
 * Helper functions for tracking transaction fees from add-ons
 */

import { ADDON_TYPES, recordAddOnUsage } from './addOnsUtils';
import { supabase } from '../supabaseClient';

/**
 * Calculate transaction fee based on amount and fee percentage
 */
export function calculateTransactionFee(amount, feePercentage) {
  if (!amount || !feePercentage) {
    return 0;
  }
  return parseFloat(amount) * parseFloat(feePercentage);
}

/**
 * Track transaction fee for a payment
 * Call this whenever a payment is processed
 */
export async function trackTransactionFee(
  tenantId,
  transactionAmount,
  paymentMethod = 'card',
  metadata = {},
) {
  if (!tenantId || !transactionAmount) {
    return {
      success: false,
      fee: 0,
    };
  }

  try {
    // Check if tenant has transaction fees add-on
    const { data: tenantAddons, error } = await supabase
      .from('tenant_addons')
      .select(
        `
        *,
        addon:subscription_addons(*)
      `      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    // Find active transaction fees add-on
    const transactionAddon = tenantAddons?.find(
      (ta) => ta.addon?.addon_type === ADDON_TYPES.TRANSACTION_FEES,
    );

    if (!transactionAddon) {
      return {
        success: false,
        fee: 0,
        message: 'No transaction fees add-on active',
      };
    }

    const feePercentage = transactionAddon.addon.price_per_unit;
    const calculatedFee = calculateTransactionFee(transactionAmount, feePercentage);

    // Record the usage
    const usageMetadata = {
      transaction_amount: transactionAmount,
      fee_percentage: feePercentage,
      fee_amount: calculatedFee,
      payment_method: paymentMethod,
      ...metadata,
    };

    const success = await recordAddOnUsage(
      tenantId,
      ADDON_TYPES.TRANSACTION_FEES,
      'transaction_processed',
      1,
      usageMetadata    );

    return {
      success,
      fee: calculatedFee,
      feePercentage,
      message: success ? 'Transaction fee recorded' : 'Failed to record fee',
    };
  } catch (error) {
    console.error('Error tracking transaction fee:', error);
    return {
      success: false,
      fee: 0,
      error: error.message,
    };
  }
}

/**
 * Track booking fee for VIP table reservations
 * Call this when a VIP table reservation is created
 */
export async function trackBookingFee(tenantId, reservationDetails = {}) {
  if (!tenantId) {
    return {
      success: false,
      fee: 0,
    };
  }

  try {
    // Check if tenant has booking fees add-on
    const { data: tenantAddons, error } = await supabase
      .from('tenant_addons')
      .select(
        `
        *,
        addon:subscription_addons(*)
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    // Find active booking fees add-on
    const bookingAddon = tenantAddons?.find(
      (ta) => ta.addon?.addon_type === ADDON_TYPES.BOOKING_FEES,
    );

    if (!bookingAddon) {
      return {
        success: false,
        fee: 0,
        message: 'No booking fees add-on active',
      };
    }

    const feePerReservation = bookingAddon.addon.price_per_unit;

    // Record the usage
    const usageMetadata = {
      fee_amount: feePerReservation,
      ...reservationDetails,
    };

    const success = await recordAddOnUsage(
      tenantId,
      ADDON_TYPES.BOOKING_FEES,
      'reservation_created',
      1,
      usageMetadata,
    );

    return {
      success,
      fee: feePerReservation,
      message: success ? 'Booking fee recorded' : 'Failed to record fee',
    };
  } catch (error) {
    console.error('Error tracking booking fee:', error);
    return {
      success: false,
      fee: 0,
      error: error.message,
    };
  }
}

/**
 * Track SMS usage for marketing campaigns
 * Call this when SMS messages are sent
 */
export async function trackSMSUsage(tenantId, smsCount, campaignDetails = {}) {
  if (!tenantId || !smsCount) {
    return {
      success: false,
      cost: 0,
    };
  }

  try {
    // Check if tenant has SMS marketing add-on
    const { data: tenantAddons, error } = await supabase
      .from('tenant_addons')
      .select(
        `
        *,
        addon:subscription_addons(*)
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    // Find active SMS marketing add-on
    const smsAddon = tenantAddons?.find(
      (ta) => ta.addon?.addon_type === ADDON_TYPES.SMS_MARKETING,
    );

    if (!smsAddon) {
      return {
        success: false,
        cost: 0,
        message: 'No SMS marketing add-on active',
      };
    }

    const costPerSMS = smsAddon.addon.price_per_unit;
    const totalCost = costPerSMS * smsCount;

    // Record the usage
    const usageMetadata = {
      sms_count: smsCount,
      cost_per_sms: costPerSMS,
      total_cost: totalCost,
      ...campaignDetails,
    };

    const success = await recordAddOnUsage(
      tenantId,
      ADDON_TYPES.SMS_MARKETING,
      'sms_sent',
      smsCount,
      usageMetadata,
    );

    return {
      success,
      cost: totalCost,
      costPerSMS,
      message: success ? 'SMS usage recorded' : 'Failed to record usage',
    };
  } catch (error) {
    console.error('Error tracking SMS usage:', error);
    return {
      success: false,
      cost: 0,
      error: error.message,
    };
  }
}

/**
 * Get transaction fee summary for a date range
 */
export async function getTransactionFeeSummary(tenantId, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('addon_usage_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('usage_type', 'transaction_processed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw error;
    }

    const summary = {
      total_transactions: data?.length || 0,
      total_fees: 0,
      total_transaction_amount: 0,
      average_fee: 0,
    };

    data?.forEach((log) => {
      summary.total_fees += parseFloat(log.total_cost || 0);
      summary.total_transaction_amount += parseFloat(
        log.metadata?.transaction_amount || 0      );
    });

    if (summary.total_transactions > 0) {
      summary.average_fee = summary.total_fees / summary.total_transactions;
    }

    return summary;
  } catch (error) {
    console.error('Error fetching transaction fee summary:', error);
    return null;
  }
}

/**
 * Get booking fee summary for a date range
 */
export async function getBookingFeeSummary(tenantId, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('addon_usage_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('usage_type', 'reservation_created')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw error;
    }

    const summary = {
      total_reservations: data?.length || 0,
      total_fees: 0,
    };

    data?.forEach((log) => {
      summary.total_fees += parseFloat(log.total_cost || 0);
    });

    return summary;
  } catch (error) {
    console.error('Error fetching booking fee summary:', error);
    return null;
  }
}
