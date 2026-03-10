# Fix Edge Function 500 Error - Stripe Checkout

## Problem
The `create-checkout-session` Edge Function is returning a 500 error because environment variables are not configured on Supabase servers.

## Solution: Configure Supabase Secrets

### Method 1: Via Supabase Dashboard (Easiest)

1. **Go to Edge Functions Settings:**
   - Open: https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/functions
   - Or navigate to: Project → Edge Functions → Configuration

2. **Add these secrets:**
   ```
   Name: STRIPE_SECRET_KEY
   Value: YOUR_STRIPE_SECRET_KEY
   
   Name: STRIPE_WEBHOOK_SECRET
   Value: YOUR_STRIPE_WEBHOOK_SECRET
   
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: YOUR_SUPABASE_SERVICE_ROLE_KEY
   ```

3. **Save and redeploy your Edge Functions**

**Note:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are automatically available in Edge Functions, you don't need to add them manually.

### Method 2: Via Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY

# Set Stripe webhook secret
supabase secrets set STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

# Set service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Verify secrets are set
supabase secrets list
```

### Method 3: Check Edge Function Logs

To see the exact error:

1. **Go to Edge Function Logs:**
   - https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/functions/create-checkout-session/logs

2. **Look for error messages** like:
   - "Stripe key not configured"
   - "Missing required environment variables"
   - Stripe API errors

## Testing After Configuration

1. **Refresh your app** (hard refresh: Ctrl+Shift+R)
2. **Try checkout again**
3. **Check browser console** for new error messages
4. **Check Edge Function logs** to see if environment variables are now loaded

## Common Issues

### Issue: Still getting 500 after setting secrets
**Solution:** Edge Functions may be cached. Try:
1. Redeploy the function from Supabase Dashboard
2. Wait 1-2 minutes for changes to propagate
3. Clear browser cache and try again

### Issue: "Stripe customer creation failed"
**Solution:** 
- Verify your Stripe API key is in test mode (starts with `sk_test_`)
- Check Stripe Dashboard for any restrictions on the API key
- Ensure the API key has permissions for checkout sessions

### Issue: Authentication errors
**Solution:**
- Make sure you're logged in
- Check that your session hasn't expired
- Try logging out and back in

## Deployment Commands

If you need to redeploy your Edge Functions:

```bash
# Deploy specific function
supabase functions deploy create-checkout-session

# Deploy all functions
supabase functions deploy

# View function logs in real-time
supabase functions logs create-checkout-session --tail
```

## Quick Verification

After setting up secrets, you should see in the Edge Function logs:
```
🔑 Stripe key loaded: sk_test_51T6W...
✅ Environment variables configured
```

Instead of:
```
❌ Stripe key not configured
❌ Missing required environment variables
```
