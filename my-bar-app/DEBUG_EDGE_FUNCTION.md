# Debug Edge Function 500 Error

Since secrets are already configured, we need to check the actual Edge Function logs to see what's failing.

## Step 1: View Edge Function Logs

1. **Go to Edge Function Logs:**
   - https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/functions/create-checkout-session/logs

2. **Look for recent errors** (refresh and try checkout again to see new logs)

3. **Common issues to look for:**
   - ❌ Stripe API errors (invalid API key, test vs. live mode mismatch)
   - ❌ Database errors (missing tables, RLS blocking access)
   - ❌ JSON parsing errors
   - ❌ Import/module errors in Deno

## Step 2: Test the Function Directly

You can test the Edge Function directly from the Supabase dashboard:

1. Go to: https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/functions/create-checkout-session
2. Click "Invoke Function"
3. Use this test payload:

```json
{
  "cartItems": [
    {
      "id": "test-1",
      "name": "Test Item",
      "price": 100,
      "quantity": 1,
      "type": "product",
      "tenant_id": "252c1a12-8422-4e60-ba7f-5b595148335e"
    }
  ],
  "totalAmount": 100,
  "userId": "1067b6d9-9cbc-4672-b9fb-bd8ce8746516",
  "tenantId": "252c1a12-8422-4e60-ba7f-5b595148335e"
}
```

## Common 500 Error Causes

### 1. Stripe API Key Issues
- Using live key instead of test key
- API key doesn't have proper permissions
- Stripe account not activated

### 2. Database/RLS Issues
- Service role key not allowing profile queries
- Missing indexes or slow queries timing out
- RLS policies blocking service role access

### 3. Code Errors
- TypeScript/Deno import issues
- Stripe API version mismatch
- JSON serialization errors

## Quick Test: Simplify Function Temporarily

If you want to isolate the issue, I can create a minimal version of the Edge Function that just returns success without calling Stripe. This will tell us if the issue is:
- Code/imports (minimal will work)
- Stripe API (minimal will work, full won't)
- Auth/database (both will fail)

Let me know what you see in the logs and I can help debug further!
