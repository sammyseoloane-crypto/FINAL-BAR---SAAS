-- ================================================
-- FIX: Platform Analytics Page 404 Errors
-- Issue: Querying non-existent subscriptions table
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- PROBLEM
-- ============================================================

-- Platform Analytics page was getting 404 errors:
-- GET /rest/v1/subscriptions?select=*&status=eq.active 404

-- Root cause:
-- ❌ Code tried to query 'subscriptions' table that doesn't exist
-- ❌ Subscription data is actually stored in 'tenants' table
-- ❌ Field is 'subscription_status' not 'status'

-- ============================================================
-- SOLUTION APPLIED (Frontend Only)
-- ============================================================

-- Updated PlatformAnalyticsPage.jsx to:
-- ✅ Query tenants table instead of subscriptions
-- ✅ Count active subscriptions from tenants.subscription_status = 'active'
-- ✅ Count trial accounts from tenants.subscription_status = 'trial'
-- ✅ Calculate MRR from active tenants + subscription_plans pricing
-- ✅ Added conversion rate metric (active/total)
-- ✅ Added average revenue per user
-- ✅ Added average users per venue
-- ✅ Enhanced summary section with detailed breakdown

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check total venues/tenants
SELECT COUNT(*) as total_tenants
FROM tenants;

-- Check active subscriptions
SELECT COUNT(*) as active_subscriptions
FROM tenants
WHERE subscription_status = 'active';

-- Check trial accounts
SELECT COUNT(*) as trial_accounts
FROM tenants
WHERE subscription_status = 'trial';

-- Check all subscription statuses
SELECT 
  subscription_status,
  COUNT(*) as count
FROM tenants
GROUP BY subscription_status
ORDER BY count DESC;

-- Calculate MRR (Monthly Recurring Revenue)
SELECT 
  SUM(sp.price_monthly) as mrr
FROM tenants t
JOIN subscription_plans sp ON sp.tier = t.subscription_tier
WHERE t.subscription_status = 'active';

-- Average users per venue
SELECT 
  COUNT(DISTINCT p.id)::DECIMAL / NULLIF(COUNT(DISTINCT t.id), 0) as avg_users_per_venue
FROM tenants t
LEFT JOIN profiles p ON p.tenant_id = t.id;

-- Conversion rate
SELECT 
  (COUNT(*) FILTER (WHERE subscription_status = 'active')::DECIMAL / 
   NULLIF(COUNT(*), 0) * 100) as conversion_rate_percent
FROM tenants;

-- ============================================================
-- NO DATABASE CHANGES REQUIRED
-- ============================================================

-- This was purely a frontend fix
-- No SQL migrations needed
-- The database schema is correct - just the frontend was querying wrong

-- ============================================================
-- NEW METRICS DISPLAYED
-- ============================================================

-- First Row:
-- 🏢 Total Venues - Count of all tenants
-- 👥 Total Users - Count of all profiles
-- 💰 Monthly Recurring Revenue - Sum of active subscriptions' pricing
-- 💳 Active Subscriptions - Count where subscription_status = 'active'

-- Second Row:
-- 🎯 Trial Accounts - Count where subscription_status = 'trial'
-- 📈 Conversion Rate - (Active / Total) * 100%
-- 💵 Avg Revenue Per User - MRR / Active Subscriptions
-- 👤 Avg Users Per Venue - Total Users / Total Venues

-- Summary Section:
-- • Detailed breakdown of all metrics
-- • Conversion percentage
-- • Trial accounts count
-- • Total MRR
-- • Total platform users

-- ============================================================
-- SUMMARY
-- ============================================================

-- What was wrong:
-- ❌ Tried to query non-existent subscriptions table
-- ❌ Got 404 errors repeatedly

-- What was fixed:
-- ✅ Query tenants table for subscription data
-- ✅ Calculate metrics from real data
-- ✅ Added 8 meaningful KPIs for platform health
-- ✅ Show conversion rates and revenue metrics
-- ✅ Detailed summary of platform performance

-- Result:
-- ✅ No more 404 errors
-- ✅ Analytics page now shows real data
-- ✅ Platform admins can see business health at a glance
