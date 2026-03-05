# Stripe Integration - Quick Test Guide

## ⚡ Quick Setup (5 minutes)

### 1. Get Stripe Test Keys
```
Visit: https://dashboard.stripe.com/test/apikeys
Copy: Publishable key (pk_test_...)
```

### 2. Add to .env
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 3. Deploy Edge Functions
```bash
cd my-bar-app

# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Deploy functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### 4. Configure Webhook
```
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Add endpoint: https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
3. Select event: checkout.session.completed
4. Copy webhook secret (whsec_...)
5. Run: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 5. Apply Database Migration
```bash
# In Supabase Dashboard SQL Editor, run:
supabase/migrations/20260302100000_add_stripe_columns.sql
```

## 🧪 Test Payment

### Test Card
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any postal code (e.g., 12345)
```

### Test Flow
1. ✅ Add items to cart
2. ✅ Click "Pay with Stripe"
3. ✅ Enter test card above
4. ✅ Complete payment
5. ✅ Redirected back with success message
6. ✅ Order appears in "Order History" with ✓ confirmed status
7. ✅ Cart is cleared

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| "Stripe failed to load" | Restart dev server after adding `.env` |
| "No session ID returned" | Check Edge Function deployment |
| Payment success but no order | Verify webhook is configured |
| Webhook not firing | Match webhook URL exactly |

## 📍 File Locations

```
.env                                          # Add VITE_STRIPE_PUBLISHABLE_KEY
src/utils/stripe.js                          # Stripe client configuration
src/pages/customer/OrdersPage.jsx           # Checkout implementation
supabase/functions/create-checkout-session/ # Creates Stripe session
supabase/functions/stripe-webhook/          # Processes payments
supabase/migrations/20260302100000_*.sql    # Database updates
```

## ✨ What Changed

**Before:**
- Manual checkout → "Pay at counter" message
- Transactions created as `pending`
- No payment processing

**After:**
- Stripe Checkout → Secure card payment
- Redirect to Stripe hosted page
- Webhook creates transactions as `confirmed`
- Cart cleared automatically after payment

## 🔗 Quick Links

- [Full Setup Guide](./STRIPE_SETUP.md)
- [Stripe Dashboard](https://dashboard.stripe.com/test)
- [Test Cards](https://stripe.com/docs/testing)
- [Supabase Project](https://app.supabase.com)

---

**Need help?** See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for detailed troubleshooting.
