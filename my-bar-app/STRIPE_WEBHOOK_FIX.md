# ⚠️ STRIPE WEBHOOK CONFIGURATION FIX

## Issue
Your Stripe webhook is sending `payment_intent.succeeded` events, but QR code generation requires `checkout.session.completed` events.

## Why This Matters
- **payment_intent.succeeded** - Only contains payment information, no cart metadata
- **checkout.session.completed** - Contains userId, tenantId, and cartData needed for QR codes

Without `checkout.session.completed`, the webhook cannot create QR codes because it doesn't know:
- Which user made the purchase
- Which tenant they belong to
- What items they bought

## Fix This NOW (5 minutes)

### Step 1: Go to Stripe Dashboard
1. Open: **https://dashboard.stripe.com/test/webhooks**
2. Click on your webhook endpoint (should be your Supabase function URL)

### Step 2: Update Event Selection
1. Click **"Add events"** or **"Update events"** button
2. Search for: **checkout.session.completed**
3. **CHECK** the checkbox next to it
4. You can keep **payment_intent.succeeded** checked too (optional)
5. Click **"Add events"** or **"Update"** to save

### Step 3: Verify Configuration
Your webhook should now listen to:
- ✅ **checkout.session.completed** (REQUIRED for QR codes)
- ⚠️ payment_intent.succeeded (optional, not used)

### Step 4: Test
1. Make a test payment in your app
2. Check Stripe webhook logs - you should see `checkout.session.completed`
3. Check Supabase function logs - should show:
   ```
   📧 Event type: checkout.session.completed
   💳 Session ID: cs_...
   📋 Session metadata: {"userId":"...","tenantId":"...","cartData":"..."}
   ✅ Transactions created: X
   ✅ QR codes created: X
   ```
4. QR codes should now appear in customer dashboard!

## Visual Guide

**Before (WRONG):**
```
Events to send:
[ ] checkout.session.completed  ❌
[✓] payment_intent.succeeded
```

**After (CORRECT):**
```
Events to send:
[✓] checkout.session.completed  ✅
[✓] payment_intent.succeeded (optional)
```

## Still Not Working?

### Check Webhook URL
Make sure your webhook endpoint URL is:
```
https://pgzlpwnumdoulxqssxsb.supabase.co/functions/v1/stripe-webhook
```

### Check Webhook Secret
The webhook secret in Stripe Dashboard must match your Supabase secret:
```bash
supabase secrets list | grep STRIPE_WEBHOOK_SECRET
```

### Check Webhook Logs
In Stripe Dashboard > Webhooks > Your endpoint > Logs:
- Status should be **200 Succeeded**
- If 400/500, check the response body for error details

### Check Supabase Logs
```
https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/functions/stripe-webhook/logs
```
Look for:
- ✅ "Webhook signature verified"
- ✅ "Event type: checkout.session.completed"
- ❌ Any error messages

## Quick Test Command

After fixing, trigger a test event from Stripe CLI:
```bash
stripe trigger checkout.session.completed
```

Or make a real test payment:
- Card: 4242 4242 4242 4242
- Date: Any future date
- CVC: Any 3 digits

## What Happens After Fix

**Checkout Flow:**
1. Customer adds items to cart
2. Clicks "Checkout" → Creates Stripe Checkout Session
3. Completes payment on Stripe → Payment succeeds
4. **Stripe sends `checkout.session.completed` webhook** ← YOU ARE HERE
5. Webhook extracts cart data from session metadata
6. Creates transactions in database
7. **Generates QR codes** for each transaction
8. Clears customer's cart
9. Customer sees QR codes in dashboard ✅

## Summary
**Action Required:** Add `checkout.session.completed` to your Stripe webhook events

**Where:** https://dashboard.stripe.com/test/webhooks

**Time Required:** 2 minutes

**Result:** QR codes will be generated after successful payments ✅
