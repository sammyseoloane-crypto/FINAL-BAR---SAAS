# Monitoring & Alerts - Implementation Summary

## ✅ What Was Implemented

### 1. Frontend Monitoring (`src/utils/monitoring.js`)
Comprehensive error tracking utilities for client-side monitoring:
- **trackPaymentFailure**: Monitors Stripe checkout errors and payment processing issues
- **trackWebhookFailure**: Tracks webhook signature verification and processing errors
- **trackDatabaseError**: Monitors database query failures and constraint violations
- **trackAPIError**: Tracks API request failures and timeouts
- **trackAuthError**: Monitors authentication and authorization failures
- **trackSecurityIssue**: Critical security issue tracking (unauthorized access, injection attempts)
- **trackPerformanceIssue**: Performance degradation monitoring
- **performHealthCheck**: System health verification
- **initializeMonitoring**: Global error handlers and periodic health checks

### 2. Edge Function Monitoring (`supabase/functions/_shared/monitoring.ts`)
Server-side error tracking for Deno Edge Functions:
- **EdgeFunctionMonitor class**: Centralized monitoring for all Edge Functions
- **Sentry integration**: Direct API calls to Sentry from Edge Functions
- **Error categorization**: Automatic tagging by severity and category
- **Context capture**: Detailed error context for debugging
- **Stack trace parsing**: Proper stack trace formatting for Sentry

### 3. Enhanced Edge Functions
Updated with comprehensive error tracking:

**stripe-webhook/index.ts**:
- Signature verification failure tracking
- Payment metadata validation errors
- Transaction creation failures
- QR code generation errors
- General webhook processing errors

**create-checkout-session/index.ts**:
- Authentication failure tracking
- Stripe API error monitoring
- General checkout session creation errors

### 4. Sentry Initialization (`src/main.jsx`)
- Initialized Sentry SDK on app startup
- Wrapped app in ErrorBoundary component
- Enabled global error monitoring

### 5. Monitoring Dashboard (`src/components/MonitoringDashboard.jsx`)
Admin dashboard component showing:
- Sentry connection status
- Database health status
- API health status
- Test alert functionality
- Quick links to monitoring tools
- Alert categories being monitored

### 6. Documentation

**MONITORING_ALERTS_SETUP.md**: Complete setup guide covering:
- Sentry project creation and configuration
- Alert rule setup (email, Slack)
- Supabase log monitoring
- Stripe webhook alerts
- Testing procedures
- Troubleshooting guide

**.env.monitoring.example**: Environment variable template with examples

---

## 📊 Alert Categories & Severity

### CRITICAL (Requires immediate attention)
- 💳 **Payment Failures**: Checkout errors, payment processing issues
- 🎣 **Webhook Failures**: Signature verification, event processing
- 🚨 **Security Issues**: Unauthorized access, SQL injection attempts
- 🌐 **API Downtime**: 500 errors, service unavailable

### ERROR (Important but not urgent)
- 🗄️ **Database Errors**: Query failures, constraint violations
- 🌐 **API Errors**: 400-level errors, validation failures

### WARNING (Should be reviewed)
- 🔐 **Authentication Failures**: Login errors, token validation
- ⚡ **Performance Issues**: Slow queries, high response times

### INFO (Informational only)
- Successful operations
- Audit logs
- Usage metrics

---

## 🚀 Deployment Checklist

### Before Deployment

1. **Create Sentry Project**
   - [ ] Sign up at https://sentry.io (free for 5,000 errors/month)
   - [ ] Create new React project: `my-bar-app-production`
   - [ ] Copy DSN (looks like: `https://xxx@yyy.ingest.sentry.io/zzz`)

2. **Configure Frontend Environment**
   - [ ] Add to `.env`:
     ```bash
     VITE_SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
     VITE_ENVIRONMENT=production
     ```

3. **Configure Edge Function Environment**
   - [ ] Go to Supabase Dashboard → Settings → Edge Functions → Environment Variables
   - [ ] Add:
     ```bash
     SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
     ENVIRONMENT=production
     ```

4. **Deploy Updated Edge Functions**
   ```bash
   supabase functions deploy stripe-webhook
   supabase functions deploy create-checkout-session
   supabase functions deploy request-data-deletion
   ```

5. **Configure Sentry Alert Rules**
   - [ ] Email notifications for all new critical errors
   - [ ] Payment failure alert rule (category=payment, severity=critical)
   - [ ] Webhook failure alert rule (category=webhook, severity=critical)
   - [ ] Database error alert rule (>10 events in 5 minutes)
   - [ ] Security issue alert rule (category=security, immediate)

6. **Enable Stripe Alerts**
   - [ ] Stripe Dashboard → Developers → Webhooks → Your endpoint
   - [ ] Enable "Send me an email when this endpoint is failing"
   - [ ] Stripe Dashboard → Settings → Emails
   - [ ] Enable failed payment notifications

7. **Configure Supabase Monitoring**
   - [ ] Enable database log retention (7-30 days)
   - [ ] Set up performance alerts (CPU > 80%, Memory > 80%)
   - [ ] Monitor Edge Function logs for errors

### After Deployment

8. **Test Monitoring**
   - [ ] Frontend: Open MonitoringDashboard and click "Send Test Alert"
   - [ ] Check Sentry dashboard for test alert (should appear in < 10 seconds)
   - [ ] Verify email notification received
   - [ ] Test webhook with invalid signature (should trigger alert)
   - [ ] Check Supabase logs for Edge Function errors

9. **Verify Alert Delivery**
   - [ ] Sentry dashboard shows test errors
   - [ ] Email notifications received within 2 minutes
   - [ ] Slack notifications sent (if configured)
   - [ ] Stripe webhook status shows green checkmark

10. **Set Up Monitoring Routine**
    - [ ] Daily: Check Sentry for critical errors (< 5 min response time)
    - [ ] Daily: Review Stripe webhook status
    - [ ] Weekly: Analyze error trends
    - [ ] Weekly: Review slow query logs
    - [ ] Monthly: Audit alert rules and thresholds

---

## 🔧 How to Use

### In Your Components

**Track Payment Errors**:
```javascript
import { trackPaymentFailure } from '../utils/monitoring';

try {
  const response = await fetch('/create-checkout-session', { ... });
  // ... handle response
} catch (error) {
  trackPaymentFailure(error, {
    amount: 100,
    currency: 'ZAR',
    userId: user.id,
    tenantId: tenant.id,
    errorCode: 'CHECKOUT_FAILED',
  });
}
```

**Track Database Errors**:
```javascript
import { trackDatabaseError } from '../utils/monitoring';

const { data, error } = await supabase.from('products').insert({ ... });

if (error) {
  trackDatabaseError(error, {
    operation: 'insert',
    table: 'products',
    code: error.code,
  });
}
```

**Track Security Issues**:
```javascript
import { trackSecurityIssue } from '../utils/monitoring';

if (user.tenant_id !== requestedTenantId) {
  trackSecurityIssue('Unauthorized tenant access attempt', {
    issueType: 'unauthorized_access',
    userId: user.id,
    attemptedAction: 'access_other_tenant_data',
    requestedTenantId,
  });
}
```

### Add Monitoring Dashboard to Admin Panel

```javascript
// In OwnerDashboard.jsx or AdminPage.jsx
import MonitoringDashboard from '../components/MonitoringDashboard';

function OwnerDashboard() {
  return (
    <div>
      <h1>Owner Dashboard</h1>
      
      {/* Add monitoring dashboard */}
      <MonitoringDashboard />
      
      {/* Rest of your dashboard */}
    </div>
  );
}
```

### Test Alerts from Console

```javascript
// Open browser console on your deployed site
import { trackPaymentFailure, AlertSeverity } from './utils/monitoring.js';

// Send test critical alert
trackPaymentFailure(new Error('Test payment failure'), {
  amount: 100,
  currency: 'ZAR',
  userId: 'test-user',
  errorCode: 'TEST',
});

// Check Sentry dashboard - alert should appear immediately
```

---

## 📈 Expected Outcomes

### Alert Response Times
- **CRITICAL alerts**: Delivered in < 5 minutes via email
- **ERROR alerts**: Delivered in < 30 minutes
- **WARNING alerts**: Delivered in daily digest

### Error Detection
- **Payment failures**: 100% captured and tracked
- **Webhook failures**: Signature verification errors tracked
- **Database errors**: All query failures logged with context
- **Security issues**: Immediate alerts for unauthorized access

### Visibility
- Real-time error tracking in Sentry dashboard
- Searchable logs in Supabase (7-30 days retention)
- Stripe webhook delivery status monitoring
- Admin dashboard with system health status

---

## 🆘 Common Issues & Solutions

### Issue: "Sentry DSN not configured"
**Solution**: Add `VITE_SENTRY_DSN` to your `.env` file and rebuild

### Issue: No errors appearing in Sentry
**Solution**: 
1. Check DSN is correct
2. Verify `initSentry()` is called in main.jsx
3. Test with: `Sentry.captureMessage('Test', 'info')`

### Issue: Edge Function errors not tracked
**Solution**:
1. Add `SENTRY_DSN` to Supabase Edge Function environment variables
2. Redeploy Edge Functions: `supabase functions deploy stripe-webhook`

### Issue: Too many alerts
**Solution**:
1. Adjust alert frequency: "When issue frequency > 10 in 5 minutes"
2. Add filters to ignore known non-critical errors
3. Use sampling for low-priority warnings

---

## 📚 Resources

- **Sentry Documentation**: https://docs.sentry.io/
- **Supabase Logs Guide**: https://supabase.com/docs/guides/platform/logs
- **Stripe Webhooks**: https://stripe.com/docs/webhooks
- **Your Sentry Dashboard**: https://sentry.io (after setup)

---

## ✨ Summary

You now have a comprehensive monitoring and alerting system that:

✅ Tracks all critical errors (payments, webhooks, database, API, auth, security)  
✅ Sends immediate alerts for CRITICAL issues (< 5 minutes)  
✅ Provides detailed error context for debugging  
✅ Monitors both frontend and backend (Edge Functions)  
✅ Includes admin dashboard for health status  
✅ Integrates with Sentry, Supabase, and Stripe  
✅ Fully documented with setup guide and troubleshooting  

**Next Steps**:
1. ✅ Review MONITORING_ALERTS_SETUP.md for detailed setup instructions
2. ✅ Create Sentry project and get DSN
3. ✅ Add environment variables
4. ✅ Deploy Edge Functions
5. ✅ Configure alert rules
6. ✅ Test all alert channels
7. ✅ Add MonitoringDashboard to your admin panel

---

**Need Help?**
- Review MONITORING_ALERTS_SETUP.md for detailed setup steps
- Check troubleshooting section for common issues
- Test alerts using MonitoringDashboard component
