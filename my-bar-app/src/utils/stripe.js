/**
 * Stripe Configuration and Utilities
 * Handles client-side Stripe integration
 */

import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export { stripePromise };

/**
 * Redirect to Stripe Checkout (Modern approach)
 * @param {string} checkoutUrl - Direct checkout URL from Stripe session
 */
export const redirectToCheckout = async (checkoutUrl) => {
  if (!checkoutUrl) {
    throw new Error('No checkout URL provided');
  }
  
  // Direct redirect to Stripe hosted checkout page
  window.location.href = checkoutUrl;
};
