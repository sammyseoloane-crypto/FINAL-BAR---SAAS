# Stripe Subscription Setup Guide

## 🎯 Overview

This guide will help you set up Stripe products for your subscription plans (Starter, Growth, Pro, Enterprise) with both monthly and yearly pricing.

## 📋 Prerequisites

- Stripe account (Test mode recommended first)
- Supabase project with subscription_plans table
- Environment variables configured in `.env`

## 🔧 Step 1: Create Stripe Products

### 1.1 Go to Stripe Dashboard
Visit: https://dashboard.stripe.com/test/products

### 1.2 Create Products

Create **4 products** (one for each tier):

#### Product 1: Starter Venue Plan
```
Name: Starter Venue Plan
Description: Perfect for small bars and nightclubs getting started
```
**Click "Add pricing"**
- **Monthly Price:**
  - Billing period: Monthly
  - Price: R 1,000.00 ZAR
  - Copy the Price ID (starts with `price_...`)
  
- **Click "Add another price"**
- **Yearly Price:**
  - Billing period: Yearly
  - Price: R 10,000.00 ZAR (saves R 2,000)
  - Copy the Price ID (starts with `price_...`)

#### Product 2: Growth Venue Plan
```
Name: Growth Venue Plan
Description: For growing venues with multiple locations
```
**Pricing:**
- **Monthly:** R 2,750.00 ZAR → Copy Price ID
- **Yearly:** R 27,500.00 ZAR (saves R 5,500) → Copy Price ID

#### Product 3: Pro Venue Plan
```
Name: Pro Venue Plan
Description: Advanced features for established nightclubs
```
**Pricing:**
- **Monthly:** R 5,500.00 ZAR → Copy Price ID
- **Yearly:** R 55,000.00 ZAR (saves R 11,000) → Copy Price ID

#### Product 4: Enterprise Venue Plan
```
Name: Enterprise Venue Plan
Description: Complete solution for large nightclub chains
```
**Pricing:**
- **Monthly:** R 10,000.00 ZAR → Copy Price ID
- **Yearly:** R 100,000.00 ZAR (saves R 20,000) → Copy Price ID

---

## 🗄️ Step 2: Update Database with Price IDs

### 2.1 Open Supabase SQL Editor

Go to: https://app.supabase.com → Your Project → SQL Editor

### 2.2 Run Update Queries

Replace `price_xxx...` with your actual Price IDs from Stripe:

```sql
-- Update Starter Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1234567890abcdefgh',  -- Replace with your monthly price ID
  stripe_price_id_yearly = 'price_0987654321zyxwvuts'   -- Replace with your yearly price ID
WHERE tier = 'starter';

-- Update Growth Plan (tier = 'professional' in old schema, 'growth' in new)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_abcd1234efgh5678',
  stripe_price_id_yearly = 'price_zyxw9876vuts5432'
WHERE tier = 'professional' OR tier = 'growth';

-- Update Pro Plan 
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_xyz123abc456def789',
  stripe_price_id_yearly = 'price_789fed654cba321zyx'
WHERE tier = 'pro';

-- Update Enterprise Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_enterprise_monthly_id',
  stripe_price_id_yearly = 'price_enterprise_yearly_id'
WHERE tier = 'enterprise';

-- Verify all updates
SELECT 
  tier, 
  display_name, 
  price_monthly,
  price_yearly,
  stripe_price_id_monthly, 
  stripe_price_id_yearly 
FROM subscription_plans 
WHERE tier IN ('starter', 'professional', 'pro', 'enterprise')
ORDER BY price_monthly;
```

---

## ⚙️ Step 3: Configure Edge Function Secrets

### 3.1 Set Stripe Secret Key

```bash
cd my-bar-app

# Set Stripe secret key (get from https://dashboard.stripe.com/test/apikeys)
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

### 3.2 Deploy Edge Functions

```bash
# Deploy the checkout session function
supabase functions deploy create-checkout-session

# Deploy the webhook handler
supabase functions deploy stripe-webhook
```

---

## 🔔 Step 4: Configure Stripe Webhook

### 4.1 Get Your Webhook URL

Your webhook URL format:
```
https://[YOUR_PROJECT].supabase.co/functions/v1/stripe-webhook
```

Find your project URL in Supabase Dashboard → Settings → API → Project URL

### 4.2 Add Webhook in Stripe

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://[YOUR_PROJECT].supabase.co/functions/v1/stripe-webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)

### 4.3 Set Webhook Secret

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

---

## 🧪 Step 5: Test the Integration

### 5.1 Test Checkout Flow

1. Start your dev server: `npm run dev`
2. Go to the pricing page: `http://localhost:5173/pricing`
3. Click **"Select Plan"** on any tier
4. You should be redirected to Stripe Checkout

### 5.2 Use Test Card

```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any postal code (e.g., 12345)
```

### 5.3 Complete Payment

After successful payment:
- You'll be redirected back to `/dashboard?success=true`
- Webhook will update your subscription in the database
- Check Supabase → Table Editor → subscriptions

---

## 🐛 Troubleshooting

### Error: "Stripe price ID not configured"

**Solution:** Make sure you've run the UPDATE queries in Step 2.2 with your actual Stripe price IDs.

```sql
-- Check if price IDs are set
SELECT tier, stripe_price_id_monthly, stripe_price_id_yearly 
FROM subscription_plans;
```

### Error: "Failed to create checkout session"

**Possible causes:**
1. Edge function not deployed → Run `supabase functions deploy create-checkout-session`
2. STRIPE_SECRET_KEY not set → Run `supabase secrets set STRIPE_SECRET_KEY=sk_test_...`
3. User not logged in → Ensure user is authenticated

**Debug in edge function logs:**
```bash
supabase functions logs create-checkout-session --tail
```

### Webhook Not Firing

**Solution:**
1. Check webhook is active in Stripe Dashboard
2. Verify endpoint URL matches exactly
3. Ensure webhook secret is set: `supabase secrets list`
4. Check edge function logs: `supabase functions logs stripe-webhook --tail`

### Payment Succeeds but Subscription Not Updated

**Solution:**
1. Check webhook logs in Stripe Dashboard → Webhooks → Select your endpoint
2. Look for `checkout.session.completed` event
3. Ensure webhook secret matches: `supabase secrets list`

---

## 🔄 Switch to Live Mode

### When Ready for Production:

1. **Get Live Keys:**
   - Go to: https://dashboard.stripe.com/apikeys (remove `/test`)
   - Copy **Live Publishable Key** and **Live Secret Key**

2. **Update Environment:**
```bash
# Update .env file
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key

# Update Supabase secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_live_key
```

3. **Create Products in Live Mode:**
   - Repeat Step 1 in Live mode
   - Update database with Live price IDs

4. **Update Webhook:**
   - Create new webhook in Live mode
   - Update webhook secret: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...`

---

## 📊 Verify Setup

### Quick Verification Checklist:

```sql
-- 1. Check Stripe price IDs are set
SELECT 
  tier, 
  display_name,
  CASE 
    WHEN stripe_price_id_monthly IS NOT NULL THEN '✅' 
    ELSE '❌' 
  END as monthly_configured,
  CASE 
    WHEN stripe_price_id_yearly IS NOT NULL THEN '✅' 
    ELSE '❌' 
  END as yearly_configured
FROM subscription_plans
WHERE tier IN ('starter', 'professional', 'pro', 'enterprise');

-- 2. Check environment secrets
-- Run in terminal:
-- supabase secrets list

-- Expected output:
-- STRIPE_SECRET_KEY
-- STRIPE_WEBHOOK_SECRET
-- SUPABASE_URL
-- SUPABASE_ANON_KEY
-- SUPABASE_SERVICE_ROLE_KEY
```

---

## 🎉 Success!

Once all steps are complete:
- ✅ Stripe products created
- ✅ Database updated with price IDs
- ✅ Edge functions deployed
- ✅ Webhook configured
- ✅ Test payment works

Your subscription system is now live! Users can:
1. View pricing plans
2. Select monthly or yearly billing
3. Complete secure checkout via Stripe
4. Get instant subscription activation

---

## 📚 Additional Resources

- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

---

## 💡 Tips

1. **Always test in Test mode first** before switching to Live mode
2. **Use descriptive product names** in Stripe for easy management
3. **Monitor webhook logs** regularly to catch issues early
4. **Keep price IDs secure** - don't commit them to version control
5. **Test all scenarios:** monthly, yearly, upgrades, downgrades

---

**Need Help?** Check the error logs in:
- Supabase Dashboard → Logs → Edge Functions
- Stripe Dashboard → Developers → Logs
- Browser Console (F12)
