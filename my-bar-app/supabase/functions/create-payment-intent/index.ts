// Supabase Edge Function: create-payment-intent
// File: supabase/functions/create-payment-intent/index.ts
// Deploy: supabase functions deploy create-payment-intent

// @ts-ignore: Deno is available in Supabase Edge Runtime
import Stripe from 'stripe';

// @ts-ignore: Deno is available in Supabase Edge Runtime
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore: Deno is available in Supabase Edge Runtime
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tabId, amount, customerPhone } = await req.json();

    if (!tabId || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid tab ID or amount' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: 'zar', // South African Rand
      metadata: {
        tab_id: tabId,
        customer_phone: customerPhone || '',
      },
      // Optional: Add customer email if available
      receipt_email: null, // Can be set from customer_email
    });

    // Return client secret to frontend
    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Payment intent creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error creating payment intent';
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
