# Enable Billing Period Support in Frontend

**Run this AFTER applying FIX_NEXT_BILLING_DATES.sql**

Once the `billing_period` column exists in the database, update the frontend to detect yearly vs monthly subscriptions.

## Step 1: Update BillingOverviewPage.jsx

Find line ~17 where tenants are queried, and add `billing_period` back:

```javascript
const { data: tenantsData, error: tenantsError } = await supabase
  .from('tenants')
  .select(`
    id,
    name,
    subscription_tier,
    subscription_status,
    billing_period,           // ← ADD THIS LINE
    stripe_subscription_id,
    stripe_customer_id,
    subscription_end,
    created_at,
    updated_at
  `)
  .order('created_at', { ascending: false });
```

Find line ~44 where billing period is determined, and update to use database value:

```javascript
// Use actual billing_period from database (after migration)
const billingPeriod = tenant.billing_period || 'monthly';
const isYearly = billingPeriod === 'yearly';
```

## Step 2: Update PlatformAnalyticsPage.jsx

Find line ~48 where active tenants are queried, and add `billing_period`:

```javascript
const { data: activeTenants } = await supabase
  .from('tenants')
  .select(`
    subscription_tier,
    billing_period          // ← ADD THIS LINE
  `)
  .eq('subscription_status', 'active');
```

Find line ~66 where MRR is calculated, and update to handle yearly:

```javascript
// Calculate MRR (Monthly Recurring Revenue)
const totalRevenue = (activeTenants || []).reduce((sum, tenant) => {
  const prices = plansMap[tenant.subscription_tier];
  if (!prices) {
    return sum;
  }

  // For yearly subscriptions: divide yearly price by 12 for MRR
  if (tenant.billing_period === 'yearly') {
    return sum + (Number(prices.yearly) / 12);
  }
  // For monthly subscriptions: use monthly price
  return sum + Number(prices.monthly);
}, 0);
```

## Verification

After making these changes:
1. Da Oceanz should show "Yearly" in Billing Period column
2. Next billing date should be ~365 days from creation
3. MRR should correctly show yearly revenue / 12

## Why This Two-Step Process?

The frontend needed to be backward-compatible before the database migration. Now that billing_period exists, we can query it properly and distinguish yearly from monthly subscriptions.
