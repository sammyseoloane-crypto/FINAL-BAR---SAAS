/**
 * Stripe Configuration and Utilities
 * Handles client-side Stripe integration
 */

import { loadStripe } from '@stripe/stripe-js'

// Initialize Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export { stripePromise }

/**
 * Redirect to Stripe Checkout
 * @param {string} sessionId - Stripe Checkout Session ID
 */
export const redirectToCheckout = async (sessionId) => {
  const stripe = await stripePromise
  
  if (!stripe) {
    throw new Error('Stripe failed to load')
  }

  const { error } = await stripe.redirectToCheckout({ sessionId })
  
  if (error) {
    throw error
  }
}
