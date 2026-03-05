# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing for checkout.

## Prerequisites

- Stripe account (sign up at https://stripe.com)
- Supabase CLI installed (https://supabase.com/docs/guides/cli)

## 1. Get Your Stripe Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

## 2. Configure Environment Variables

### Frontend (.env file)

Update your `.env` file with your Stripe publishable key:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Supabase Edge Functions

You need to set environment secrets in Supabase for the Edge Functions:

```bash
# Navigate to your project directory
cd my-bar-app

# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Set Stripe webhook secret (you'll get this after setting up webhooks)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 3. Deploy Supabase Edge Functions

Deploy the two Edge Functions that handle Stripe payments:

```bash
# Deploy create-checkout-session function
supabase functions deploy create-checkout-session

# Deploy stripe-webhook function
supabase functions deploy stripe-webhook
```

After deployment, note the function URLs. They will look like:
- `https://your-project.supabase.co/functions/v1/create-checkout-session`
- `https://your-project.supabase.co/functions/v1/stripe-webhook`

## 4. Configure Stripe Webhooks

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Update your Supabase secrets:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 5. Update Database Schema (Optional)

Add Stripe-related columns to the transactions table:

```sql
-- Add columns to track Stripe payment data
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session 
ON transactions(stripe_session_id);
```

## 6. Test the Integration

### Test Mode

1. Make sure you're using test keys (starts with `pk_test_` and `sk_test_`)
2. Add items to cart
3. Click "Pay with Stripe"
4. Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any postal code

### Successful Payment Flow

1. User clicks "Pay with Stripe - R100.00"
2. Redirected to Stripe Checkout page
3. Enters test card details
4. Stripe processes payment
5. Redirected back to `/customer/orders?session_id=xxx&success=true`
6. Webhook receives `checkout.session.completed` event
7. Transactions created in database with `status='confirmed'`
8. Cart is cleared automatically

### Failed/Cancelled Payment

If payment is cancelled:
1. User clicks "Cancel" on Stripe page
2. Redirected to `/customer/orders?canceled=true`
3. Cart remains intact
4. User can try again

## 7. Go Live (Production)

When ready for production:

1. Activate your Stripe account
2. Get your live API keys from https://dashboard.stripe.com/apikeys
3. Update production environment variables:
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here`
   - `supabase secrets set STRIPE_SECRET_KEY=sk_live_your_secret_key_here`
4. Create production webhook endpoint in Stripe
5. Update webhook secret: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_xxx`

## Currency Configuration

The integration uses **South African Rand (ZAR)** by default. To change currency:

Edit `supabase/functions/create-checkout-session/index.ts`:

```typescript
currency: 'usd', // Change from 'zar' to your currency code
```

Supported currencies: https://stripe.com/docs/currencies

## Troubleshooting

### "Stripe failed to load"

- Check that `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env`
- Restart your dev server after adding environment variables

### "Failed to create checkout session"

- Verify Edge Function is deployed: `supabase functions list`
- Check function logs: `supabase functions logs create-checkout-session`
- Ensure Stripe secret key is set in Supabase secrets

### Webhook not firing

- Check webhook configuration in Stripe Dashboard
- Verify webhook URL matches your Edge Function URL
- Check Edge Function logs: `supabase functions logs stripe-webhook`
- In test mode, use Stripe CLI for local webhook testing:
  ```bash
  stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
  ```

### Transactions not created after payment

- Check webhook is receiving events
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check Edge Function logs for errors
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (automatically available in Edge Functions)

## Security Notes

- Never commit `.env` file to version control
- Use test keys during development
- Keep secret keys secure and never expose them client-side
- The publishable key (`pk_`) is safe to use client-side
- Webhooks verify signatures to prevent tampering

## Cost Considerations

Stripe charges:
- **2.9% + $0.30** per successful card charge in the US
- Check https://stripe.com/pricing for your region's pricing

## Support Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe Testing: https://stripe.com/docs/testing
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Stripe Webhooks Guide: https://stripe.com/docs/webhooks

## Quick Start Commands

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link your project
supabase link --project-ref your-project-ref

# 4. Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# 5. Deploy functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook

# 6. Start development
npm run dev
```

You're all set! 🎉
