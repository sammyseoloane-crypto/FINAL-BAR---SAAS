/**
 * Subscription Service
 * Handles subscription checkout and management
 */

import { supabase } from '../supabaseClient';
import { redirectToCheckout } from '../utils/stripe';

/**
 * Create a Stripe checkout session for subscription
 * @param {string} priceId - Stripe price ID (monthly or yearly)
 * @param {string} tier - Subscription tier name (starter, growth, pro, enterprise)
 * @returns {Promise<{sessionId: string}>}
 */
export async function createSubscriptionCheckout(priceId, tier) {
  try {
    // eslint-disable-next-line no-console
    console.log('🛒 Creating subscription checkout:', { priceId, tier });

    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('You must be logged in to subscribe');
    }

    // Get auth token
    const token = session.access_token;

    // Call edge function to create checkout session
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId,
          tier,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Checkout error:', data);
      throw new Error(data.error || 'Failed to create checkout session');
    }

    // eslint-disable-next-line no-console
    console.log('✅ Checkout session created:', data.sessionId);
    return data;
  } catch (error) {
    console.error('❌ Error creating subscription checkout:', error);
    throw error;
  }
}

/**
 * Start subscription checkout flow
 * @param {Object} plan - Subscription plan object
 * @param {string} billingPeriod - 'monthly' or 'yearly'
 */
export async function startSubscriptionCheckout(plan, billingPeriod) {
  try {
    // Get the correct Stripe price ID based on billing period
    const priceId = billingPeriod === 'yearly'
      ? plan.stripe_price_id_yearly
      : plan.stripe_price_id_monthly;

    if (!priceId) {
      throw new Error(`Stripe price ID not configured for ${plan.display_name} (${billingPeriod})`);
    }

    // Create checkout session
    const { url } = await createSubscriptionCheckout(priceId, plan.tier);

    if (!url) {
      throw new Error('No checkout URL returned from session');
    }

    // Redirect to Stripe Checkout
    // eslint-disable-next-line no-console
    console.log('🔄 Redirecting to Stripe Checkout...');
    await redirectToCheckout(url);
  } catch (error) {
    console.error('❌ Subscription checkout error:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 * @param {string} tenantId - Tenant ID
 */
export async function cancelSubscription(tenantId) {
  try {
    // Call edge function to cancel subscription in Stripe
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tenantId }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel subscription');
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }
}
