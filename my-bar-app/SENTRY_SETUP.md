# Sentry Error Monitoring Setup Guide

## Overview
This guide covers the setup and configuration of Sentry for error monitoring, performance tracking, and alerting in the Multi-Tenant Bar SaaS application.

## 1. Create Sentry Account

1. Visit [sentry.io](https://sentry.io)
2. Sign up for a free account
3. Create a new project and select "React" as the platform
4. Copy your DSN (Data Source Name)

## 2. Installation

```bash
cd my-bar-app
npm install @sentry/react @sentry/tracing
```

## 3. Environment Configuration

Add to `.env`:
```env
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
VITE_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

Add to `.env.local` (development):
```env
VITE_SENTRY_DSN=https://your-dev-sentry-dsn@sentry.io/your-dev-project-id
VITE_ENVIRONMENT=development
```

## 4. Integration

### Update `main.jsx`:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry, ErrorBoundary } from './utils/sentry';
import App from './App';
import './style.css';

// Initialize Sentry before rendering
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

### Update `App.jsx`:

```javascript
import { useEffect } from 'react';
import { setUser, trackEvent } from './utils/sentry';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();

  useEffect(() => {
    // Set Sentry user when authenticated
    if (user) {
      setUser({
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        role: user.role,
      });
      trackEvent('user_logged_in', { role: user.role });
    }
  }, [user]);

  // ... rest of your app
}
```

## 5. Error Handling Examples

### Payment Errors:
```javascript
import { handlePaymentError } from '../utils/sentry';

try {
  const session = await createCheckoutSession(items);
} catch (error) {
  handlePaymentError(error, {
    items: items.length,
    total_amount: calculateTotal(items),
  });
  showToast('Payment failed. Please try again.', 'error');
}
```

### Database Errors:
```javascript
import { handleDatabaseError } from '../utils/sentry';

try {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId);
    
  if (error) throw error;
} catch (error) {
  handleDatabaseError(error, 'SELECT * FROM products WHERE tenant_id = ?');
}
```

### Authentication Errors:
```javascript
import { handleAuthError } from '../utils/sentry';

try {
  await supabase.auth.signIn({ email, password });
} catch (error) {
  handleAuthError(error, { email, provider: 'email' });
}
```

## 6. Performance Monitoring

### Track Page Load:
```javascript
import { startTransaction } from '../utils/sentry';

function Dashboard() {
  useEffect(() => {
    const transaction = startTransaction('dashboard.load');
    
    // Your data loading logic
    loadDashboardData().finally(() => {
      transaction.finish();
    });
  }, []);
}
```

### Track API Calls:
```javascript
import { trackAPICall } from '../utils/sentry';

async function fetchProducts() {
  const start = performance.now();
  const response = await fetch('/api/products');
  const duration = performance.now() - start;
  
  trackAPICall('/api/products', 'GET', response.status, duration);
  
  return response.json();
}
```

## 7. Alerting Configuration

### Sentry Dashboard Settings:

1. **Alert Rules** → Create New Alert
2. **Conditions**:
   - Error count > 10 in 5 minutes
   - Error rate > 5% in 1 hour
   - Response time P95 > 2 seconds

3. **Actions**:
   - Send email to: dev-team@yourcompany.com
   - Send Slack message to: #alerts
   - Create PagerDuty incident (critical only)

### Example Alert Rule JSON:
```json
{
  "name": "High Error Rate",
  "conditions": [
    {
      "id": "sentry.rules.conditions.error_rate",
      "percent": 5,
      "interval": "1h"
    }
  ],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "Team",
      "targetIdentifier": "dev-team"
    }
  ],
  "actionMatch": "all",
  "frequency": 30
}
```

## 8. Slack Integration

1. Go to **Settings** → **Integrations** → **Slack**
2. Click "Add to Slack"
3. Select channel (e.g., #alerts or #errors)
4. Configure notifications:
   - New issues
   - Resolved issues
   - Regression issues
   - Performance alerts

## 9. Email Digests

Configure weekly/daily digests:
- **Settings** → **Notifications** → **Digests**
- Select frequency: Daily, Weekly
- Choose projects to include
- Set delivery time

## 10. Source Maps (for Production)

### Vite Configuration:

Update `vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    sentryVitePlugin({
      org: 'your-org',
      project: 'bar-saas',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

Generate Sentry auth token:
1. **Settings** → **Auth Tokens**
2. Create new token with `project:releases` scope
3. Add to `.env`: `SENTRY_AUTH_TOKEN=your-token`

## 11. Custom Dashboards

### Create Performance Dashboard:
1. **Dashboards** → **Create Dashboard**
2. Add widgets:
   - **Error Rate**: Line chart of errors over time
   - **Response Times**: P50, P95, P99 percentiles
   - **User Impact**: Affected users count
   - **Transaction Volume**: Total transactions
   - **Browser Distribution**: Errors by browser

### Example Widget Query:
```sql
SELECT
  count() as total_errors,
  uniq(user.id) as affected_users
FROM events
WHERE
  event.type = 'error'
  AND timestamp > now() - 7d
GROUP BY toStartOfDay(timestamp)
```

## 12. Cron Job Monitoring

Monitor scheduled tasks:
```javascript
import * as Sentry from '@sentry/node';

const checkInId = Sentry.captureCheckIn({
  monitorSlug: 'refresh-materialized-views',
  status: 'in_progress',
});

try {
  await refreshMaterializedViews();
  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: 'refresh-materialized-views',
    status: 'ok',
  });
} catch (error) {
  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: 'refresh-materialized-views',
    status: 'error',
  });
  throw error;
}
```

## 13. Testing Sentry

### Test Error Capture:
```javascript
import { captureException } from './utils/sentry';

// Trigger test error
try {
  throw new Error('Test error from production');
} catch (error) {
  captureException(error);
}
```

### Test Performance:
```javascript
import { startTransaction } from './utils/sentry';

const transaction = startTransaction('test-transaction');
setTimeout(() => {
  transaction.finish();
}, 1000);
```

## 14. Best Practices

1. **Don't Log PII**: Mask emails, passwords, credit cards
2. **Set Context**: Add tenant_id, user_role to all events
3. **Filter Noise**: Ignore known browser extension errors
4. **Sample Strategically**: 100% in dev, 20% in production
5. **Tag Appropriately**: Use tags for filtering (payment, auth, database)
6. **Set Severity**: Use levels (fatal, error, warning, info, debug)

## 15. Cost Optimization

- **Free Tier**: 5,000 events/month
- **Team Plan**: $26/month for 50,000 events
- **Business Plan**: $80/month for 500,000 events

### Reduce Event Volume:
- Lower sample rates in production
- Filter out non-critical errors
- Use before-send hook to filter events
- Increase error grouping threshold

## 16. Monitoring Checklist

- [ ] Sentry DSN configured
- [ ] Error boundary implemented
- [ ] User context set on login
- [ ] Payment errors tracked
- [ ] Database errors tracked
- [ ] Performance monitoring enabled
- [ ] Alerts configured
- [ ] Slack integration setup
- [ ] Source maps uploaded
- [ ] Team members added
- [ ] Weekly digest enabled

## Resources

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Alert Rules](https://docs.sentry.io/product/alerts/)
- [Integrations](https://docs.sentry.io/product/integrations/)
