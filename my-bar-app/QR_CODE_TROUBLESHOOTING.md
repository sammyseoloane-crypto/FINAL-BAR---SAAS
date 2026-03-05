# QR Code Generation Troubleshooting Guide

## Problem
Stripe payment completes successfully but QR codes are not being generated.

## Possible Causes

### 1. **Webhook Not Being Triggered**
- Stripe webhook endpoint not configured correctly
- Webhook secret mismatch
- Network/firewall blocking requests

### 2. **Webhook Executing But Failing Silently**
- Database insert errors (foreign key constraints, user_id mismatch)
- RLS policies blocking inserts
- Environment variables not set

### 3. **QR Codes Created But Not Visible**
- RLS policies preventing SELECT
- User viewing wrong tenant data
- Frontend not refreshing

## Debugging Steps

### Step 1: Check Stripe Webhook Status
1. Go to **Stripe Dashboard** > **Developers** > **Webhooks**
2. Click on your webhook endpoint
3. Check recent webhook events:
   - Status should be "Succeeded" (200 response)
   - Look for `checkout.session.completed` events
   - If failing, check the error message

### Step 2: Check Supabase Function Logs
1. Go to **Supabase Dashboard** > **Edge Functions** > **stripe-webhook**
2. Click **Logs** tab
3. Look for recent executions when payment was made
4. Check for error messages, especially:
   - `❌ Error creating QR codes:`
   - `❌ Error creating transactions:`
   - Look for the actual error details in the logs

### Step 3: Verify Environment Variables
Run in terminal:
```bash
supabase secrets list
```

Required secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Check Database Directly
Run the queries in `DEBUG_QR_CODES.sql`:

1. In Supabase Dashboard, go to **SQL Editor**
2. Run the queries to check:
   - Recent transactions (should see your payment)
   - QR codes (should exist for each transaction)
   - Transactions WITHOUT QR codes (this shows the problem)

### Step 5: Check User ID Format
**COMMON ISSUE**: The user_id in metadata might not match auth.users format

In the webhook logs, look for:
```
📋 Session metadata: {"userId":"...","tenantId":"..."}
```

The `userId` must match the UUID format in `auth.users`.

**Fix**: Ensure the checkout session metadata contains the correct user ID:
```javascript
// When creating Stripe checkout session
metadata: {
  userId: user.id,  // Must be auth.uid() from Supabase
  tenantId: tenantId,
  cartData: JSON.stringify(cartItems)
}
```

### Step 6: Test Webhook Locally
```bash
# Deploy updated webhook
supabase functions deploy stripe-webhook

# Test with Stripe CLI
stripe listen --forward-to YOUR_WEBHOOK_URL
stripe trigger checkout.session.completed
```

## Common Fixes

### Fix 1: User ID Mismatch
If transactions are created but QR codes fail with foreign key error:

```sql
-- Check if user_id exists in auth.users
SELECT id FROM auth.users WHERE id = 'YOUR_USER_ID';
```

The webhook uses `session.metadata.userId` - ensure this matches the actual auth user ID.

### Fix 2: Re-deploy Webhook
```bash
cd my-bar-app
supabase functions deploy stripe-webhook
```

### Fix 3: Manual QR Code Creation (Temporary)
If you have transactions without QR codes:

```sql
-- Find transactions without QR codes
SELECT id, user_id FROM transactions 
WHERE id NOT IN (SELECT transaction_id FROM qr_codes);

-- Manually create QR codes (replace IDs)
INSERT INTO qr_codes (transaction_id, user_id, code)
SELECT 
  id, 
  user_id, 
  'QR-' || id || '-' || extract(epoch from now())::bigint
FROM transactions
WHERE id NOT IN (SELECT transaction_id FROM qr_codes)
  AND status = 'confirmed'
  AND stripe_session_id IS NOT NULL;
```

### Fix 4: RLS Policy Issue
If service role key is not set correctly:

```bash
# Check secrets
supabase secrets list

# Set service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Next Steps

1. **Redeploy the webhook** with enhanced logging:
   ```bash
   supabase functions deploy stripe-webhook
   ```

2. **Make a test payment** and immediately check:
   - Stripe webhook logs
   - Supabase function logs
   - Database for new QR codes

3. **Check the logs** for detailed error messages with the new logging

4. If still failing, provide:
   - Webhook error logs
   - Output from `DEBUG_QR_CODES.sql`
   - User ID from the session metadata

## Expected Behavior

After successful payment:
1. ✅ Stripe webhook fires `checkout.session.completed`
2. ✅ Webhook creates transactions in database
3. ✅ Webhook creates QR codes for each transaction
4. ✅ Webhook clears user's cart
5. ✅ User can view QR codes in their dashboard

## Webhook Enhanced Logging

The webhook now provides detailed logging:
- 📝 User ID and transaction IDs
- 🎫 QR codes being inserted (full JSON)
- ❌ Detailed error information if insert fails
- ✅ Success confirmation with QR code IDs
