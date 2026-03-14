# 🎯 Subscription Tiers Implementation Guide

**Implementation Date:** March 13, 2026  
**Status:** ✅ Complete (Ready for deployment)

## 📋 Overview

This document outlines the complete 4-tier subscription system implemented for the nightclub/bar management platform. The system includes feature gating, usage limits, and automatic tier enforcement.

---

## 🏆 Subscription Tiers

### 💰 Tier 1 — Starter Plan (R799 - R1,200/month)
**Target:** Small bars or lounges starting with digital systems

**Limits:**
- 3 staff accounts
- 2 events per month
- 1 venue location
- 100 products
- 5,000 monthly transactions

**Features:**
- ✅ POS drink sales
- ✅ Product inventory
- ✅ Basic staff accounts
- ✅ QR payment receipts
- ✅ Simple event ticket sales
- ✅ Digital drink menu
- ✅ Basic customer profiles
- ✅ Daily revenue reports
- ✅ Basic sales reports
- ❌ VIP tables
- ❌ Bottle service
- ❌ Guest lists
- ❌ Loyalty program
- ❌ AI analytics

---

### 🍸 Tier 2 — Growth Plan (R2,000 - R3,500/month)
**Target:** Busy bars and medium-sized clubs

**Limits:**
- 10 staff accounts
- 10 events per month
- 2 venue locations
- 300 products
- 15,000 monthly transactions

**Everything in Starter PLUS:**
- ✅ VIP table booking
- ✅ Guest list management
- ✅ Promoter accounts
- ✅ Bottle service system
- ✅ Digital bar tabs
- ✅ Inventory alerts
- ✅ Staff performance tracking
- ✅ Loyalty program
- ✅ VIP customer tracking
- ✅ Weekly revenue reports
- ✅ Drink popularity analytics
- ❌ AI analytics
- ❌ Dynamic pricing

---

### 🏆 Tier 3 — Pro Nightclub Plan (R4,000 - R7,000/month)
**Target:** Large nightclubs and entertainment venues

**Limits:**
- Unlimited staff
- Unlimited events
- 3 venue locations
- 1,000 products
- Unlimited transactions

**Everything in Growth PLUS:**
- ✅ Full POS system
- ✅ Table layout manager
- ✅ Bottle package management
- ✅ Multi-event management
- ✅ AI drink demand prediction
- ✅ Dynamic drink pricing
- ✅ Inventory predictions
- ✅ VIP tiers
- ✅ Customer spending analytics
- ✅ Marketing automation
- ✅ Event revenue tracking
- ✅ Hourly sales heatmaps
- ✅ Staff sales rankings
- ❌ Multi-location franchise management
- ❌ API access

---

### 👑 Tier 4 — Enterprise Venue Plan (R10,000+/month)
**Target:** Nightclub chains, festivals, and large venues

**Limits:**
- Unlimited everything

**Everything in Pro PLUS:**
- ✅ Multi-location management
- ✅ Franchise venue dashboard
- ✅ Advanced permissions
- ✅ API integrations
- ✅ Public event discovery
- ✅ Customer app access
- ✅ Cross-venue promotions
- ✅ AI revenue forecasting
- ✅ Crowd analytics
- ✅ VIP spending trends
- ✅ Dedicated support
- ✅ Custom onboarding
- ✅ White label branding
- ✅ Custom integrations

---

## 🗄️ Database Implementation

### New Migration File
**File:** `supabase/migrations/20260313900000_nightclub_subscription_tiers.sql`

**Key Components:**

1. **Updated Constraints:**
   - New tier values: `trial`, `starter`, `growth`, `pro`, `enterprise`
   - Added `max_events_per_month` column

2. **Subscription Plans Table:**
   - Stores all tier configurations
   - Includes pricing (monthly/yearly)
   - Feature flags in JSONB
   - Limits configuration

3. **Database Functions:**
   - `check_feature_access(tenant_id, feature_name)` - Check if tenant has access to feature
   - `check_usage_limit(tenant_id, limit_type)` - Check current usage vs limits
   - Returns: current count, max limit, remaining, is_at_limit

4. **View:**
   - `tenant_subscription_details` - Complete subscription info for each tenant

---

## 🛠️ Frontend Implementation

### 1. Utilities (`src/utils/subscriptionUtils.js`)

**Constants:**
```javascript
SUBSCRIPTION_TIERS = { TRIAL, STARTER, GROWTH, PRO, ENTERPRISE }
FEATURES = { VIP_TABLES, BOTTLE_SERVICE, AI_ANALYTICS, ... }
```

**Key Functions:**
- `getTenantSubscription(tenantId)` - Fetch subscription details
- `checkFeatureAccess(tenantId, featureName)` - Check feature access
- `checkUsageLimit(tenantId, limitType)` - Check usage limits
- `canPerformAction(tenantId, limitType)` - Can user perform action
- `updateTenantTier(tenantId, newTier)` - Upgrade/downgrade tier
- `getFeaturesComparison()` - Get comparison table data

---

### 2. Context (`src/contexts/SubscriptionContext.jsx`)

**Provider:** `<SubscriptionProvider>`

**Hooks:**
- `useSubscription()` - Main subscription context
- `useFeatureAccess(feature)` - Check single feature
- `useUsageLimit(limitType)` - Get usage limit info
- `useTierInfo()` - Get tier details

**Methods:**
- `hasFeature(featureName)` - Async feature check
- `hasFeatureSync(featureName)` - Sync feature check (uses cache)
- `getUsageLimit(limitType)` - Get limit info with caching
- `canPerform(limitType)` - Check if action allowed
- `refreshSubscription()` - Refresh and clear caches

---

### 3. Components

#### FeatureGate (`src/components/FeatureGate.jsx`)
Conditionally renders content based on feature access.

**Usage:**
```jsx
<FeatureGate feature={FEATURES.VIP_TABLES}>
  <VIPTablesDashboard />
</FeatureGate>
```

**Props:**
- `feature` - Feature name to check
- `children` - Content to show if access granted
- `fallback` - Alternative content if no access
- `showUpgradePrompt` - Show upgrade overlay (default: true)
- `upgradeMessage` - Custom upgrade message
- `onUpgradeClick` - Custom upgrade handler

**Sub-components:**
- `<FeatureLock>` - Small lock badge
- `<DisabledFeatureButton>` - Button that shows upgrade modal when clicked

---

#### UsageLimitDisplay (`src/components/UsageLimitDisplay.jsx`)
Shows usage vs limits with progress bars.

**Usage:**
```jsx
<UsageLimitDisplay limitType="staff" />
<UsageLimitDisplay limitType="locations" />
<UsageLimitDisplay limitType="events" />
<UsageLimitDisplay limitType="products" />
```

**Features:**
- Progress bar visualization
- Color-coded status (green/warning/danger)
- Warning messages when at limit
- Skeleton loading state

**Sub-components:**
- `<CompactUsageDisplay>` - Compact version for headers
- `<AllLimitsDisplay>` - Grid showing all limits

---

#### PricingPlans (`src/components/PricingPlans.jsx`)
Complete pricing page with all tiers.

**Features:**
- Monthly/yearly billing toggle
- Current plan indicator
- Savings calculation
- Feature comparison table
- FAQ section
- Responsive design
- Dark mode support

**Usage:**
```jsx
<PricingPlans />
```

---

### 4. Integration Points

#### App.jsx
```jsx
<AuthProvider>
  <SubscriptionProvider>
    <CartProvider>
      {/* Routes */}
    </CartProvider>
  </SubscriptionProvider>
</AuthProvider>
```

#### VIPTablesDashboard.jsx
```jsx
<FeatureGate feature={FEATURES.VIP_TABLES}>
  {/* VIP dashboard content */}
</FeatureGate>
```

#### EventsPage.jsx
```jsx
// Show usage limit
<UsageLimitDisplay limitType="events" />

// Check before creating
const canAddEvent = await canPerform('events');
if (!canAddEvent) {
  alert('Event limit reached. Please upgrade.');
  return;
}
```

---

## 🚀 Deployment Instructions

### 1. Deploy Database Migration

```bash
cd "d:\MULTI-TENANT BAR SAAS APP\my-bar-app"
supabase db push
```

This will:
- Update tenant constraints
- Create subscription_plans table
- Insert 5 default plans (trial, starter, growth, pro, enterprise)
- Create helper functions
- Create subscription view

### 2. Deploy Edge Functions (Already Done ✅)

All 5 edge functions deployed to `pgzlpwnumdoulxqssxsb`:
- ✅ create-checkout-session
- ✅ create-payment-intent
- ✅ request-data-deletion
- ✅ stripe-webhook
- ✅ validate-qr

### 3. Deploy Frontend

```bash
npm run build
# Deploy to your hosting (Netlify, Vercel, etc.)
```

---

## 🧪 Testing Checklist

### Database Tests
- [ ] Verify subscription plans inserted correctly
- [ ] Test `check_feature_access()` function
- [ ] Test `check_usage_limit()` function
- [ ] Verify tenant_subscription_details view

### Feature Gating Tests
- [ ] VIP Tables visible only for Growth+ tiers
- [ ] Feature lock badges appear for locked features
- [ ] Upgrade prompts display correctly
- [ ] Fallback content works

### Usage Limits Tests
- [ ] Create events up to limit
- [ ] Verify error when exceeding limit
- [ ] Add staff up to limit
- [ ] Create locations up to limit
- [ ] Usage displays update in real-time

### UI Tests
- [ ] Pricing page displays all tiers
- [ ] Monthly/yearly toggle works
- [ ] Feature comparison table accurate
- [ ] Current plan highlighted
- [ ] Upgrade buttons functional

---

## 📊 Feature Access Matrix

| Feature | Starter | Growth | Pro | Enterprise |
|---------|---------|--------|-----|------------|
| POS System | ✓ | ✓ | ✓ | ✓ |
| Inventory | ✓ | ✓ | ✓ | ✓ |
| QR Payments | ✓ | ✓ | ✓ | ✓ |
| Events | ✓ | ✓ | ✓ | ✓ |
| VIP Tables | ✗ | ✓ | ✓ | ✓ |
| Bottle Service | ✗ | ✓ | ✓ | ✓ |
| Guest Lists | ✗ | ✓ | ✓ | ✓ |
| Bar Tabs | ✗ | ✓ | ✓ | ✓ |
| Loyalty Program | ✗ | ✓ | ✓ | ✓ |
| AI Analytics | ✗ | ✗ | ✓ | ✓ |
| Dynamic Pricing | ✗ | ✗ | ✓ | ✓ |
| API Access | ✗ | ✗ | ✗ | ✓ |
| Franchise Dashboard | ✗ | ✗ | ✗ | ✓ |

---

## 🔧 Customization Guide

### Adding a New Feature

1. **Add to subscriptionUtils.js:**
```javascript
export const FEATURES = {
  // ... existing
  MY_NEW_FEATURE: 'my_new_feature',
};

export const FEATURE_TIER_REQUIREMENTS = {
  // ... existing
  [FEATURES.MY_NEW_FEATURE]: SUBSCRIPTION_TIERS.PRO,
};
```

2. **Update database plan features:**
```sql
UPDATE subscription_plans 
SET features = features || '{"my_new_feature": true}'
WHERE tier IN ('pro', 'enterprise');
```

3. **Use in components:**
```jsx
<FeatureGate feature={FEATURES.MY_NEW_FEATURE}>
  <MyNewComponent />
</FeatureGate>
```

### Adding a New Tier

1. **Update constraint:**
```sql
ALTER TABLE tenants DROP CONSTRAINT tenants_subscription_tier_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_tier_check 
  CHECK (subscription_tier IN ('trial', 'starter', 'growth', 'pro', 'enterprise', 'new_tier'));
```

2. **Insert plan:**
```sql
INSERT INTO subscription_plans (...) VALUES (...);
```

3. **Update TIER_HIERARCHY in subscriptionUtils.js**

---

## 🐛 Troubleshooting

### Feature Not Accessible
1. Check tenant's subscription_tier in database
2. Verify feature exists in subscription_plans.features
3. Check `check_feature_access()` function returns true
4. Clear subscription cache: `refreshSubscription()`

### Usage Limit Not Working
1. Verify column exists: `max_events_per_month`, `max_staff`, etc.
2. Check `check_usage_limit()` function
3. Ensure SQL counting logic is correct
4. Check cache (30-second TTL)

### Pricing Page Issues
1. Verify subscription_plans table has data
2. Check `getSubscriptionPlans()` function
3. Ensure is_active = true for plans
4. Check console for errors

---

## 📈 Future Enhancements

### Planned Features
- [ ] Stripe integration for automated billing
- [ ] Grace period for expired subscriptions
- [ ] Usage analytics dashboard
- [ ] Email notifications for limit warnings
- [ ] Self-service tier upgrades
- [ ] Promo codes and discounts
- [ ] Annual billing discounts
- [ ] Add-on purchases (extra staff, locations, etc.)

### Improvements
- [ ] Add webhook for Stripe subscription events
- [ ] Implement trial period tracking
- [ ] Add subscription history logs
- [ ] Create admin panel for plan management
- [ ] Add usage forecasting
- [ ] Implement soft limits with warnings

---

## 📞 Support

For questions or issues:
1. Check this documentation
2. Review code comments in implementation files
3. Test database functions directly in Supabase SQL editor
4. Check browser console for errors

---

## ✅ Implementation Status

| Component | Status | File |
|-----------|--------|------|
| Database Migration | ✅ Ready | `supabase/migrations/20260313900000_nightclub_subscription_tiers.sql` |
| Subscription Utils | ✅ Complete | `src/utils/subscriptionUtils.js` |
| Subscription Context | ✅ Complete | `src/contexts/SubscriptionContext.jsx` |
| FeatureGate Component | ✅ Complete | `src/components/FeatureGate.jsx` |
| UsageLimit Component | ✅ Complete | `src/components/UsageLimitDisplay.jsx` |
| Pricing Page | ✅ Complete | `src/components/PricingPlans.jsx` |
| App Integration | ✅ Complete | `src/App.jsx` |
| VIP Tables Gating | ✅ Complete | `src/components/VIPTablesDashboard.jsx` |
| Events Limit Check | ✅ Complete | `src/pages/owner/EventsPage.jsx` |
| Edge Functions | ✅ Deployed | All 5 functions live |
| Database Deployment | ⏳ Pending | Need to run `supabase db push` |

---

**Next Steps:**
1. Deploy database migration: `supabase db push`
2. Test subscription features
3. Configure Stripe webhooks (optional)
4. Update existing components with feature gates
5. Add usage limit displays to other pages

**Total Implementation Time:** ~2 hours  
**Files Created:** 9 new files  
**Files Modified:** 3 existing files  
**Lines of Code:** ~2,500 lines

---

*Documentation generated: March 13, 2026*
