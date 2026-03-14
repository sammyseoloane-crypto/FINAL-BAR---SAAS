# 🎉 Stripe Payment Integration - Complete!

## ✅ What Was Implemented

### 1. **Updated Subscription Utils**
- **File:** `src/utils/subscriptionUtils.js`
- **Changes:** Added Stripe price ID fields to query
  - `stripe_price_id_monthly`
  - `stripe_price_id_yearly`

### 2. **Created Subscription Service**
- **File:** `src/services/subscriptionService.js` (NEW)
- **Functions:**
  - `createSubscriptionCheckout(priceId, tier)` - Calls edge function
  - `startSubscriptionCheckout(plan, billingPeriod)` - Main checkout flow
  - `cancelSubscription(tenantId)` - Cancel subscription

### 3. **Updated Pricing Component**
- **File:** `src/components/PricingPlans.jsx`
- **Changes:**
  - Imported `startSubscriptionCheckout` service
  - Updated `handleSelectPlan` to start real Stripe checkout
  - Added validation for missing Stripe price IDs
  - Proper error handling

### 4. **Created Documentation**
- **File:** `STRIPE_SUBSCRIPTION_SETUP.md` (NEW)
  - Complete step-by-step setup guide
  - Stripe product creation instructions
  - Database update queries
  - Webhook configuration
  - Testing guide

- **File:** `supabase/UPDATE_STRIPE_PRICE_IDS.sql` (NEW)
  - Quick SQL script to update price IDs

---

## 🚀 Next Steps to Complete Setup

### Step 1: Create Stripe Products (5 minutes)

1. Go to: https://dashboard.stripe.com/test/products
2. Create 4 products with monthly + yearly prices:

   **Starter Venue Plan**
   - Monthly: R 1,000.00 ZAR
   - Yearly: R 10,000.00 ZAR

   **Growth Venue Plan**
   - Monthly: R 2,750.00 ZAR
   - Yearly: R 27,500.00 ZAR

   **Pro Venue Plan**
   - Monthly: R 5,500.00 ZAR
   - Yearly: R 55,000.00 ZAR

   **Enterprise Venue Plan**
   - Monthly: R 10,000.00 ZAR
   - Yearly: R 100,000.00 ZAR

3. **Copy each Price ID** (starts with `price_...`)

---

### Step 2: Update Database (2 minutes)

1. Open Supabase SQL Editor
2. Open `supabase/UPDATE_STRIPE_PRICE_IDS.sql`
3. Replace `price_REPLACE_WITH_...` with your actual Price IDs
4. Run the SQL script

Example:
```sql
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1QAbc123xyz789',  -- Your real ID
  stripe_price_id_yearly = 'price_2XYZ456def012'     -- Your real ID
WHERE tier = 'starter';
```

---

### Step 3: Configure Edge Functions (3 minutes)

```bash
cd my-bar-app

# Set Stripe secret key (get from https://dashboard.stripe.com/test/apikeys)
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_actual_secret_key

# Deploy edge functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

---

### Step 4: Setup Webhook (2 minutes)

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://[YOUR_PROJECT].supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with `whsec_...`)
6. Run: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret`

---

## 🧪 Test It!

### 1. Refresh Your Browser
Press **Ctrl + Shift + R** to reload with cache clear

### 2. Click "Select Plan"
The button should now:
- Show loading state
- Redirect to Stripe Checkout page

### 3. Use Test Card
```
Card: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
ZIP: 12345
```

### 4. Complete Payment
You should be redirected back to `/dashboard?success=true`

---

## ⚠️ Before Testing

Make sure you've completed:
- ✅ Created Stripe products
- ✅ Updated database with price IDs
- ✅ Set STRIPE_SECRET_KEY secret
- ✅ Deployed edge functions
- ✅ Configured webhook

---

## 🐛 Troubleshooting

### Error: "Stripe price ID not configured"
**Solution:** Run the UPDATE queries in Step 2

### Error: "Failed to create checkout session"
**Check:**
1. Edge function deployed? → `supabase functions deploy create-checkout-session`
2. Secret key set? → `supabase secrets list`
3. User logged in? → Check browser console

### Payment works but subscription not updated
**Check:** Webhook logs in Stripe Dashboard → Webhooks → Your endpoint

---

## 📚 Full Documentation

See **STRIPE_SUBSCRIPTION_SETUP.md** for:
- Detailed setup instructions
- Production deployment guide
- Complete troubleshooting section
- Testing best practices

---

## 🎯 What Happens When User Clicks "Select Plan"

1. **Validation:** Checks if Stripe price IDs are configured
2. **Get Session:** Retrieves user authentication token
3. **Call Edge Function:** Sends `priceId` and `tier` to create-checkout-session
4. **Create Customer:** Edge function creates/retrieves Stripe customer
5. **Create Session:** Stripe generates checkout session
6. **Redirect:** User sent to Stripe Checkout page
7. **Payment:** User enters card details on Stripe's secure page
8. **Webhook:** Stripe sends `checkout.session.completed` event
9. **Update DB:** Edge function updates subscription in database
10. **Redirect Back:** User returned to `/dashboard?success=true`

---

## 💰 Pricing That Will Be Charged

Based on your current plans in the database:

| Plan | Monthly | Yearly | Savings |
|------|---------|--------|---------|
| **Starter** | R 1,000 | R 10,000 | R 2,000 (17%) |
| **Growth** | R 2,750 | R 27,500 | R 5,500 (17%) |
| **Pro** | R 5,500 | R 55,000 | R 11,000 (17%) |
| **Enterprise** | R 10,000 | R 100,000 | R 20,000 (17%) |

---

## ✨ Ready to Go Live?

When you're ready for production:
1. Switch Stripe to Live mode
2. Create products in Live mode
3. Update environment with Live keys
4. Update database with Live price IDs
5. Configure Live webhook

See **STRIPE_SUBSCRIPTION_SETUP.md** → "Switch to Live Mode" section

---

**Your Stripe payment integration is now complete! Follow the Next Steps above to finish the setup.** 🚀
