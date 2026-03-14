# 🚀 Quick Fix: Stripe Not Configured Error

## Problem
When clicking "Select Plan", you see: **"Stripe is not configured for [Plan Name]. Please contact support to set up your subscription."**

## Root Cause
The `subscription_plans` table doesn't have Stripe price IDs set yet.

---

## ⚡ Quick Fix (5 minutes)

### Option A: Add Placeholder IDs (Testing Only)

**Use this to test the checkout flow without real Stripe setup:**

1. Open **Supabase Dashboard** → SQL Editor
2. Open file: `supabase/ADD_PLACEHOLDER_STRIPE_IDS.sql`
3. Click **Run**
4. Refresh your pricing page
5. Click "Select Plan" - it will proceed to checkout (but fail at Stripe since these aren't real IDs)

⚠️ **Note:** This is for testing only. The checkout will fail at Stripe because these aren't real price IDs.

---

### Option B: Set Up Real Stripe (Production Ready)

**Follow these steps for full working Stripe integration:**

#### Step 1: Create Stripe Products (10 minutes)

1. Go to: https://dashboard.stripe.com/test/products
2. Click **"Add product"**

Create these 4 products:

**1. Starter Venue Plan**
- Name: `Starter Venue Plan`
- Monthly price: **R 1,000**
- Yearly price: **R 10,000**
- Copy both Price IDs (starts with `price_...`)

**2. Growth Venue Plan**
- Name: `Growth Venue Plan`
- Monthly price: **R 2,750**
- Yearly price: **R 27,500**
- Copy both Price IDs

**3. Pro Nightclub Plan**
- Name: `Pro Nightclub Plan`
- Monthly price: **R 5,500**
- Yearly price: **R 55,000**
- Copy both Price IDs

**4. Enterprise Venue Plan**
- Name: `Enterprise Venue Plan`
- Monthly price: **R 10,000**
- Yearly price: **R 100,000**
- Copy both Price IDs

#### Step 2: Update Database (2 minutes)

Open Supabase SQL Editor and run:

```sql
-- Replace 'price_xxxxx' with your ACTUAL Stripe Price IDs

-- Starter Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1234567890abcdefgh',  -- Your real monthly ID
  stripe_price_id_yearly = 'price_0987654321zyxwvuts'    -- Your real yearly ID
WHERE tier = 'starter';

-- Growth Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_abcd1234efgh5678',
  stripe_price_id_yearly = 'price_zyxw9876vuts5432'
WHERE tier IN ('professional', 'growth');

-- Pro Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_xyz123abc456def789',
  stripe_price_id_yearly = 'price_789fed654cba321zyx'
WHERE tier = 'pro';

-- Enterprise Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_enterprise_monthly',
  stripe_price_id_yearly = 'price_enterprise_yearly'
WHERE tier = 'enterprise';

-- Verify
SELECT tier, display_name, stripe_price_id_monthly, stripe_price_id_yearly 
FROM subscription_plans 
WHERE tier IN ('starter', 'professional', 'growth', 'pro', 'enterprise');
```

#### Step 3: Configure Edge Function (3 minutes)

```bash
cd my-bar-app

# Set your Stripe secret key (from https://dashboard.stripe.com/test/apikeys)
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_actual_secret_key

# Deploy edge functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

#### Step 4: Set Up Webhook (2 minutes)

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copy webhook secret (starts with `whsec_...`)
6. Run: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret`

---

## 🧪 Test It

1. **Refresh** your pricing page (Ctrl+Shift+R)
2. Click **"Select Plan"** on any tier
3. You should be redirected to **Stripe Checkout**
4. Use test card: `4242 4242 4242 4242`
5. Complete payment
6. You'll be redirected back to dashboard

---

## ✅ Verification Checklist

Run this in Supabase SQL Editor to check configuration:

```sql
SELECT 
  tier, 
  display_name,
  CASE 
    WHEN stripe_price_id_monthly IS NOT NULL THEN '✅' 
    ELSE '❌' 
  END as monthly_set,
  CASE 
    WHEN stripe_price_id_yearly IS NOT NULL THEN '✅' 
    ELSE '❌' 
  END as yearly_set,
  stripe_price_id_monthly,
  stripe_price_id_yearly
FROM subscription_plans
WHERE tier IN ('starter', 'professional', 'growth', 'pro', 'enterprise')
ORDER BY price_monthly;
```

Expected output: All rows should show ✅ ✅

---

## 🆘 Still Having Issues?

### Error: "Stripe is not configured"
- Run the SQL query above to verify price IDs are set
- Check that you're updating the correct tier name (starter, growth, pro, enterprise)

### Error: "Failed to create checkout session"
- Check: `supabase secrets list` - should show STRIPE_SECRET_KEY
- Check: `supabase functions list` - should show create-checkout-session
- View logs: `supabase functions logs create-checkout-session --tail`

### Payment succeeds but subscription not updated
- Check webhook is configured in Stripe Dashboard
- Verify webhook secret: `supabase secrets list`
- Check logs: `supabase functions logs stripe-webhook --tail`

---

## 📚 More Documentation

- Full setup guide: `STRIPE_SUBSCRIPTION_SETUP.md`
- Quick update script: `supabase/UPDATE_STRIPE_PRICE_IDS.sql`
- Integration overview: `STRIPE_INTEGRATION_COMPLETE.md`

---

**Choose Option A for quick testing or Option B for full production setup!** 🎯
