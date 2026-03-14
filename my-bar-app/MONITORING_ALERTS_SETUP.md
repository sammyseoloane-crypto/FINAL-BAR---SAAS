# Monitoring & Alerts Setup Guide

Complete guide for production monitoring and alerting using Sentry, Supabase logs, and Stripe dashboard.

## 📋 Table of Contents
1. [Overview](#overview)
2. [Sentry Setup](#sentry-setup)
3. [Supabase Monitoring](#supabase-monitoring)
4. [Stripe Alerts](#stripe-alerts)
5. [Alert Configuration](#alert-configuration)
6. [Testing Alerts](#testing-alerts)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### Monitoring Stack
- **Sentry**: Error tracking and performance monitoring for frontend and backend
- **Supabase Logs**: Database and Edge Function monitoring
- **Stripe Dashboard**: Payment and webhook failure alerts

### What's Being Monitored
✅ **Payment Failures**: Stripe checkout errors, webhook failures, transaction creation issues  
✅ **Webhook Failures**: Signature verification, event processing, metadata issues  
✅ **Database Errors**: Query failures, constraint violations, RLS policy issues  
✅ **API Errors**: Request failures, timeout issues, rate limiting  
✅ **Authentication Failures**: Login errors, token validation issues  
✅ **Security Issues**: Unauthorized access attempts, SQL injection attempts

### Alert Severity Levels
- **CRITICAL**: Requires immediate attention (payment failures, security breaches)
- **ERROR**: Important but not urgent (database errors, API failures)
- **WARNING**: Should be reviewed (authentication failures, performance issues)
- **INFO**: Informational only (successful operations, audit logs)

---

## Sentry Setup

### 1. Create Sentry Project

1. **Sign up for Sentry**:
   - Go to https://sentry.io
   - Create a free account (up to 5,000 errors/month free)
   - Click "Create Project"

2. **Configure Project**:
   - Platform: **React**
   - Give it a name: `my-bar-app-production`
   - Alert frequency: **Every time a new issue is created**
   - Click "Create Project"

3. **Get DSN**:
   - After project creation, copy the DSN (looks like: `https://xxx@oyyy.ingest.sentry.io/zzz`)
   - Save this for environment variables

### 2. Configure Environment Variables

#### Frontend (.env)
```bash
# Sentry Configuration
VITE_SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
VITE_ENVIRONMENT=production
```

#### Edge Functions (Supabase Dashboard)
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add environment variables:
```bash
SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
ENVIRONMENT=production
```

### 3. Verify Sentry Integration

**Frontend Test**:
```javascript
// In browser console
import { captureMessage } from './utils/sentry.js';
captureMessage('Test message from frontend', 'info');
```

**Edge Function Test**:
```bash
# Trigger a test error
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "error"}'
```

Check Sentry dashboard - you should see the test messages.

### 4. Configure Sentry Alerts

#### Email Alerts
1. Go to Sentry → **Settings** → **Notifications**
2. Enable:
   - ✅ **All new issues**
   - ✅ **Issue regressions**
   - ✅ **Performance issues**
3. Add your email address

#### Slack Integration (Optional)
1. Go to Sentry → **Settings** → **Integrations**
2. Find **Slack** → Click "Install"
3. Authorize Slack workspace
4. Configure alert rules:
   - Go to **Alerts** → **Create Alert Rule**
   - When: `A new issue is created`
   - If: `The event's tags match: severity equals critical`
   - Then: `Send a notification via Slack`

#### Alert Rules for Critical Errors

**Payment Failure Alerts**:
```
Rule Name: Payment Failures
When: A new issue is created
If: The event's tags match:
  - category equals payment
  - severity equals critical
Then:
  - Send a notification via email
  - Send a notification via Slack (#payments-alerts)
```

**Webhook Failure Alerts**:
```
Rule Name: Webhook Failures
When: A new issue is created
If: The event's tags match:
  - category equals webhook
  - severity equals critical
Then:
  - Send a notification via email
  - Send a notification via Slack (#webhook-alerts)
```

**Database Error Alerts**:
```
Rule Name: Database Errors
When: An issue's frequency is:
  - more than 10 events in 5 minutes
If: The event's tags match:
  - category equals database
Then:
  - Send a notification via email
```

**Security Issue Alerts**:
```
Rule Name: Security Issues
When: A new issue is created
If: The event's tags match:
  - category equals security
Then:
  - Send a notification via email (HIGH PRIORITY)
  - Send a notification via Slack (#security-alerts)
```

---

## Supabase Monitoring

### 1. Enable Database Logs

1. Go to Supabase Dashboard → **Logs** → **Database Logs**
2. Filter by:
   - ⚠️ **Error** level for production issues
   - 🔴 **Fatal** level for critical database failures
3. Enable log retention (7-30 days recommended)

### 2. Monitor Edge Functions

1. Go to Supabase Dashboard → **Edge Functions**
2. For each function (`stripe-webhook`, `create-checkout-session`):
   - Click function name
   - View **Logs** tab
   - Monitor for errors (red indicators)

**Useful Log Queries**:
```sql
-- Find payment failures
SELECT *
FROM edge_logs
WHERE function_name = 'stripe-webhook'
  AND level = 'error'
  AND message LIKE '%PAYMENT FAILURE%'
ORDER BY timestamp DESC
LIMIT 50;

-- Find webhook signature failures
SELECT *
FROM edge_logs
WHERE function_name = 'stripe-webhook'
  AND message LIKE '%signature verification failed%'
ORDER BY timestamp DESC;

-- Find database errors
SELECT *
FROM edge_logs
WHERE message LIKE '%DATABASE ERROR%'
ORDER BY timestamp DESC;
```

### 3. Set Up Database Performance Alerts

1. Go to Supabase Dashboard → **Settings** → **Monitoring**
2. Enable alerts for:
   - ✅ **Database CPU usage** > 80%
   - ✅ **Database memory usage** > 80%
   - ✅ **Connection pool exhaustion** > 90%
   - ✅ **Slow queries** > 5 seconds

### 4. Enable Realtime Monitoring

For critical tables that affect payments:
```sql
-- Monitor transaction failures
CREATE OR REPLACE FUNCTION notify_transaction_failure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' THEN
    PERFORM pg_notify(
      'transaction_failure',
      json_build_object(
        'transaction_id', NEW.id,
        'user_id', NEW.user_id,
        'amount', NEW.amount,
        'error', NEW.metadata->>'error'
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_failure_trigger
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION notify_transaction_failure();
```

---

## Stripe Alerts

### 1. Webhook Settings

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click your webhook endpoint
3. Configure:
   - ✅ **Send me an email when this endpoint is failing**
   - ✅ **Send event notifications to email**

### 2. Payment Alerts

1. Go to Stripe Dashboard → **Settings** → **Emails**
2. Enable notifications for:
   - ✅ **Successful payments** (daily summary)
   - ✅ **Failed payments** (immediate)
   - ✅ **Disputed charges** (immediate)
   - ✅ **Refunds** (immediate)

### 3. Webhook Failure Monitoring

Stripe automatically monitors webhook health:
- After 5 consecutive failures, webhook is disabled
- You'll receive email notification
- Check webhook delivery status in dashboard

**Webhook Health Indicators**:
- ✅ Green: All webhooks delivered successfully
- ⚠️ Yellow: Some delivery issues (retrying)
- 🔴 Red: Multiple failures (needs attention)

### 4. Custom Stripe Alerts (Radar)

If using Stripe Radar for fraud detection:
1. Go to Stripe Dashboard → **Radar** → **Rules**
2. Create custom alerts:
   - Unusual payment volume (>50 in 1 hour)
   - High-value transactions (>R5000)
   - Failed payment attempts (>3 in 10 minutes)

---

## Alert Configuration

### Recommended Alert Matrix

| Alert Type | Severity | Channel | Response Time | Action |
|------------|----------|---------|---------------|--------|
| Payment Failure | CRITICAL | Email + Slack | < 5 min | Investigate immediately |
| Webhook Failure | CRITICAL | Email + Slack | < 10 min | Check Stripe dashboard |
| Database Error (batch) | ERROR | Email | < 30 min | Review query logs |
| API Downtime | CRITICAL | Email + SMS | < 5 min | Check Supabase status |
| Security Issue | CRITICAL | Email + Slack | < 5 min | Review and block if needed |
| Auth Failure (high volume) | WARNING | Email | < 1 hour | Check for attack pattern |
| Performance Degradation | WARNING | Email (daily) | < 24 hours | Optimize queries |

### Environment-Specific Settings

**Production**:
- All alerts enabled
- Email + Slack notifications
- Immediate delivery for CRITICAL
- Hourly digest for WARNING

**Staging**:
- Only CRITICAL alerts
- Email only
- Daily digest

**Development**:
- Console logging only
- No external alerts

---

## Testing Alerts

### 1. Test Sentry Integration

**Frontend Error Test**:
```javascript
// Add to browser console
import { trackPaymentFailure } from './utils/monitoring.js';

trackPaymentFailure(new Error('Test payment failure'), {
  amount: 100,
  currency: 'ZAR',
  userId: 'test-user-123',
  tenantId: 'test-tenant-456',
  errorCode: 'TEST_ERROR',
});
```

**Expected Result**:
- Error appears in Sentry dashboard within 10 seconds
- Email notification received (if configured)
- Slack message posted (if configured)

### 2. Test Webhook Monitoring

**Trigger Invalid Webhook**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid_signature" \
  -d '{"type": "checkout.session.completed"}'
```

**Expected Result**:
- Error logged in Supabase Edge Function logs
- Sentry receives webhook failure event
- Alert triggered if configured

### 3. Test Database Error Tracking

**Trigger Constraint Violation**:
```javascript
// In your app, try to create invalid data
const { error } = await supabase
  .from('transactions')
  .insert({
    user_id: 'non-existent-user', // Will fail foreign key constraint
    amount: 100,
  });

// Should trigger trackDatabaseError()
```

**Expected Result**:
- Database error tracked in Sentry
- Error context includes table name, operation, error code
- Alert sent if error rate threshold exceeded

### 4. Verify Alert Delivery

**Check Email Delivery**:
1. Trigger test error
2. Wait 1-2 minutes
3. Check spam folder if not in inbox
4. Verify email contains:
   - Error message
   - Stack trace
   - Link to Sentry issue
   - Severity tag

**Check Slack Delivery** (if configured):
1. Trigger critical error
2. Check Slack channel within 30 seconds
3. Verify message contains:
   - Error summary
   - Severity indicator
   - Link to Sentry
   - Timestamp

---

## Troubleshooting

### Sentry Not Receiving Errors

**Problem**: No errors showing in Sentry dashboard

**Solutions**:
1. ✅ Check DSN is correct in environment variables:
   ```bash
   # Frontend
   echo $VITE_SENTRY_DSN
   
   # Should output: https://xxx@oyyy.ingest.sentry.io/zzz
   ```

2. ✅ Verify Sentry initialized in `main.jsx`:
   ```javascript
   import { initSentry } from './utils/sentry.js';
   initSentry(); // Should be called before React renders
   ```

3. ✅ Check browser console for Sentry warnings:
   ```
   Look for: "Sentry DSN not configured" or "Sentry init failed"
   ```

4. ✅ Test with simple error:
   ```javascript
   import * as Sentry from '@sentry/react';
   Sentry.captureMessage('Test message', 'info');
   ```

5. ✅ Check Sentry project is not paused:
   - Go to Sentry → Settings → Project Settings
   - Ensure "Event Submission" is enabled

### Alerts Not Being Sent

**Problem**: Errors in Sentry but no email/Slack alerts

**Solutions**:
1. ✅ Verify alert rules are enabled:
   - Sentry → Alerts → View all alert rules
   - Check status column shows "Enabled"

2. ✅ Check email address is verified:
   - Sentry → Settings → Account → Emails
   - Resend verification if needed

3. ✅ Review alert rule conditions:
   - Make sure tags match exactly (case-sensitive)
   - Check filter conditions aren't too restrictive

4. ✅ Test with Sentry's "Test Alert" feature:
   - Go to specific alert rule
   - Click "Test Rule"
   - Should send test notification

### Edge Function Monitoring Not Working

**Problem**: Edge Function errors not appearing in Sentry

**Solutions**:
1. ✅ Check Edge Function environment variables:
   ```bash
   # In Supabase Dashboard
   Settings → Edge Functions → Environment Variables
   SENTRY_DSN should be set
   ```

2. ✅ Verify monitoring.ts is imported:
   ```typescript
   // stripe-webhook/index.ts
   import { trackWebhookFailure } from '../_shared/monitoring.ts';
   ```

3. ✅ Check Edge Function logs for errors:
   ```
   Look for: "Failed to send error to Sentry"
   ```

4. ✅ Redeploy Edge Functions:
   ```bash
   supabase functions deploy stripe-webhook
   supabase functions deploy create-checkout-session
   ```

### High Alert Volume

**Problem**: Too many alerts being sent

**Solutions**:
1. ✅ Adjust alert frequency:
   ```
   Change from: "Every new issue"
   To: "When issue frequency > 10 in 5 minutes"
   ```

2. ✅ Add filters to reduce noise:
   ```
   Ignore errors with:
   - Error message contains "Network request failed"
   - Browser name equals "Chrome Extension"
   ```

3. ✅ Group similar errors:
   ```
   Sentry → Settings → Grouping
   Enable: "Group by stack trace"
   ```

4. ✅ Use error sampling for low-priority issues:
   ```javascript
   // In sentry.js
   beforeSend(event, hint) {
     // Sample 10% of warnings, 100% of errors
     if (event.level === 'warning' && Math.random() > 0.1) {
       return null;
     }
     return event;
   }
   ```

### Stripe Webhook Failures

**Problem**: Stripe webhooks failing repeatedly

**Solutions**:
1. ✅ Verify webhook secret is correct:
   ```bash
   # Compare these two values:
   echo $STRIPE_WEBHOOK_SECRET
   # vs Stripe Dashboard → Developers → Webhooks → Signing Secret
   ```

2. ✅ Check webhook URL is reachable:
   ```bash
   curl https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
   # Should return: {"status":"ok"}
   ```

3. ✅ Review webhook event logs in Stripe:
   - Stripe Dashboard → Developers → Webhooks
   - Click your endpoint
   - View "Recent Deliveries"
   - Check response codes and error messages

4. ✅ Test webhook locally:
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   stripe trigger checkout.session.completed
   ```

---

## Monitoring Dashboard Checklist

### Daily Monitoring Tasks
- [ ] Check Sentry for new critical errors (< 5 minutes)
- [ ] Review Supabase Edge Function logs for failed webhooks
- [ ] Verify Stripe dashboard shows no webhook failures
- [ ] Check database performance metrics (CPU, memory)

### Weekly Monitoring Tasks
- [ ] Review error trends in Sentry (are errors increasing?)
- [ ] Analyze slow query reports from Supabase
- [ ] Check payment success rate in Stripe (should be >95%)
- [ ] Review security alerts for suspicious patterns

### Monthly Monitoring Tasks
- [ ] Audit alert rules (add/remove based on patterns)
- [ ] Review Sentry quota usage (upgrade if needed)
- [ ] Clean up resolved issues in Sentry
- [ ] Update on-call rotation and alert contacts

---

## Quick Reference

### Environment Variables Required
```bash
# Frontend (.env)
VITE_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
VITE_ENVIRONMENT=production

# Edge Functions (Supabase)
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
ENVIRONMENT=production
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Useful Commands
```bash
# Test Sentry from browser console
import { captureMessage } from './utils/sentry.js';
captureMessage('Test', 'info');

# Deploy Edge Functions with monitoring
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session

# View Edge Function logs
supabase functions logs stripe-webhook

# Test webhook locally
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

### Support Resources
- **Sentry Docs**: https://docs.sentry.io/
- **Supabase Logs**: https://supabase.com/docs/guides/platform/logs
- **Stripe Webhooks**: https://stripe.com/docs/webhooks/test
- **Your Sentry Dashboard**: https://sentry.io/organizations/YOUR_ORG/issues/

---

## Summary

✅ **Sentry configured** for frontend and Edge Functions error tracking  
✅ **Monitoring utilities** track payment, webhook, database, API, auth, and security errors  
✅ **Alert rules** configured for critical, error, and warning severity levels  
✅ **Supabase logs** monitored for database and Edge Function issues  
✅ **Stripe alerts** enabled for payment and webhook failures  
✅ **Testing procedures** documented to verify all alerts work correctly  

**Next Steps**:
1. Set up Sentry project and get DSN
2. Add environment variables to frontend and Supabase
3. Configure alert rules in Sentry
4. Enable Stripe webhook failure emails
5. Test all alert channels
6. Monitor daily for first week to tune alert thresholds

**Alert Delivery Time Goals**:
- CRITICAL alerts: < 5 minutes
- ERROR alerts: < 30 minutes
- WARNING alerts: < 24 hours (daily digest)
