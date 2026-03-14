# 🎨 Frontend Implementation Guide

Quick reference for implementing React components for the new business readiness features.

## 📋 Component Priority Matrix

### ✅ Priority 1: Essential for Launch

#### 1. Subscription Management Component
**File**: `src/components/SubscriptionManager.jsx`

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SubscriptionManager() {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  async function loadSubscriptionData() {
    // Get current subscription
    const { data: tenant } = await supabase
      .from('tenants')
      .select('subscription_plan_id, transaction_count, user_count')
      .single();

    // Get all available plans
    const { data: allPlans } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_monthly');

    // Check usage limits
    const { data: limits } = await supabase
      .rpc('check_tenant_limits', { p_tenant_id: tenant.id });

    setCurrentPlan(tenant.subscription_plan_id);
    setPlans(allPlans);
    setUsage(limits);
  }

  async function upgradePlan(newPlanId) {
    const { data } = await supabase
      .rpc('change_subscription', {
        p_tenant_id: tenantId,
        p_new_plan_id: newPlanId
      });
    
    if (data.success) {
      loadSubscriptionData();
    }
  }

  return (
    <div className="subscription-manager">
      <h2>Your Subscription</h2>
      
      {/* Current Plan Card */}
      <div className="current-plan">
        {/* Show current plan details */}
      </div>

      {/* Usage Meters */}
      <div className="usage-meters">
        <UsageMeter 
          label="Transactions" 
          current={usage?.transaction_count} 
          limit={usage?.max_transactions}
        />
        <UsageMeter 
          label="Users" 
          current={usage?.user_count} 
          limit={usage?.max_users}
        />
      </div>

      {/* Available Plans */}
      <div className="plans-grid">
        {plans.map(plan => (
          <PlanCard 
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === currentPlan}
            onUpgrade={() => upgradePlan(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 2. Two-Factor Authentication Setup
**File**: `src/components/TwoFactorSetup.jsx`

```jsx
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import QRCode from 'qrcode.react';

export default function TwoFactorSetup() {
  const [step, setStep] = useState('choose'); // choose, setup, verify, backup
  const [method, setMethod] = useState(null); // 'totp', 'sms', 'email'
  const [totpSecret, setTotpSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);

  async function enableTOTP() {
    // Generate TOTP secret
    const secret = generateTOTPSecret();
    setTotpSecret(secret);
    
    // Save to database
    await supabase
      .from('two_factor_settings')
      .upsert({
        user_id: user.id,
        method: 'totp',
        totp_secret: secret,
        is_enabled: false // Enable after verification
      });
    
    setStep('verify');
  }

  async function verifyTOTP(code) {
    // Verify the code
    const isValid = verifyTOTPCode(totpSecret, code);
    
    if (isValid) {
      // Enable 2FA
      await supabase
        .from('two_factor_settings')
        .update({ is_enabled: true, totp_verified: true })
        .eq('user_id', user.id);

      // Generate backup codes
      const { data } = await supabase
        .rpc('generate_backup_codes', { p_user_id: user.id });
      
      setBackupCodes(data.codes);
      setStep('backup');
    }
  }

  return (
    <div className="two-factor-setup">
      {step === 'choose' && (
        <MethodSelector onSelect={(m) => { setMethod(m); enableTOTP(); }} />
      )}

      {step === 'setup' && method === 'totp' && (
        <div className="totp-setup">
          <h3>Scan QR Code</h3>
          <QRCode 
            value={`otpauth://totp/BarApp:${user.email}?secret=${totpSecret}&issuer=BarApp`}
            size={256}
          />
          <p>Or enter this code manually: {totpSecret}</p>
          <button onClick={() => setStep('verify')}>Next</button>
        </div>
      )}

      {step === 'verify' && (
        <VerificationCodeInput onVerify={verifyTOTP} />
      )}

      {step === 'backup' && (
        <BackupCodes codes={backupCodes} />
      )}
    </div>
  );
}
```

#### 3. Multi-Currency Selector
**File**: `src/components/CurrencySelector.jsx`

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CurrencySelector({ value, onChange }) {
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1);

  useEffect(() => {
    loadCurrencies();
  }, []);

  useEffect(() => {
    if (value) loadExchangeRate(value);
  }, [value]);

  async function loadCurrencies() {
    const { data } = await supabase
      .from('currencies')
      .select('*')
      .eq('is_active', true)
      .order('code');
    setCurrencies(data);
  }

  async function loadExchangeRate(toCurrency) {
    const { data } = await supabase
      .rpc('get_exchange_rate', {
        p_from_currency: 'ZAR',
        p_to_currency: toCurrency
      });
    setExchangeRate(data);
  }

  return (
    <div className="currency-selector">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {currencies.map(currency => (
          <option key={currency.code} value={currency.code}>
            {currency.symbol} {currency.code} - {currency.name}
          </option>
        ))}
      </select>
      {exchangeRate !== 1 && (
        <span className="exchange-rate">
          1 ZAR = {exchangeRate.toFixed(4)} {value}
        </span>
      )}
    </div>
  );
}
```

#### 4. Offline Sync Indicator
**File**: `src/components/OfflineSyncIndicator.jsx`

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Monitor online/offline status
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check queue count
    checkQueueCount();
    const interval = setInterval(checkQueueCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function handleOnline() {
    setIsOnline(true);
    await syncQueue();
  }

  function handleOffline() {
    setIsOnline(false);
  }

  async function checkQueueCount() {
    const { count } = await supabase
      .from('offline_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setQueueCount(count || 0);
  }

  async function syncQueue() {
    if (queueCount === 0) return;
    
    setSyncing(true);
    const deviceId = localStorage.getItem('device_id');
    
    const { data } = await supabase
      .rpc('sync_device_queue', { p_device_id: deviceId });
    
    setSyncing(false);
    checkQueueCount();
  }

  if (isOnline && queueCount === 0) return null;

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}>
      {!isOnline && (
        <span>📡 Offline Mode - Changes will sync when online</span>
      )}
      {isOnline && queueCount > 0 && (
        <span>
          🔄 {syncing ? 'Syncing...' : `${queueCount} items pending sync`}
          {!syncing && <button onClick={syncQueue}>Sync Now</button>}
        </span>
      )}
    </div>
  );
}
```

---

### ⚡ Priority 2: Analytics & Reporting

#### 5. Analytics Dashboard
**File**: `src/pages/owner/AnalyticsDashboard.jsx`

```jsx
import { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { supabase } from '../../supabaseClient';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('last_30_days');
  const [salesTrends, setSalesTrends] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [customerMetrics, setCustomerMetrics] = useState({});

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  async function loadAnalytics() {
    const { startDate, endDate } = getDateRange(dateRange);

    // Get sales trends
    const { data: trends } = await supabase
      .rpc('get_sales_trends', {
        p_tenant_id: tenantId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_interval: 'day'
      });
    setSalesTrends(trends);

    // Get top products
    const { data: products } = await supabase
      .rpc('get_top_products', {
        p_tenant_id: tenantId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: 10
      });
    setTopProducts(products);

    // Get customer metrics summary
    const { data: metrics } = await supabase
      .from('customer_metrics')
      .select('total_spent, total_purchases, churn_risk_score')
      .eq('tenant_id', tenantId);
    
    setCustomerMetrics(aggregateMetrics(metrics));
  }

  return (
    <div className="analytics-dashboard">
      <h1>📊 Analytics Dashboard</h1>

      {/* Date Range Selector */}
      <DateRangeSelector value={dateRange} onChange={setDateRange} />

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard title="Total Revenue" value={customerMetrics.totalRevenue} />
        <KPICard title="Avg Order Value" value={customerMetrics.avgOrderValue} />
        <KPICard title="Total Customers" value={customerMetrics.totalCustomers} />
        <KPICard title="At Risk Customers" value={customerMetrics.atRiskCount} />
      </div>

      {/* Sales Trend Chart */}
      <div className="chart-container">
        <h3>Sales Trend</h3>
        <Line data={formatTrendData(salesTrends)} />
      </div>

      {/* Top Products Chart */}
      <div className="chart-container">
        <h3>Top Products</h3>
        <Bar data={formatProductData(topProducts)} />
      </div>

      {/* Customer Churn Risk */}
      <ChurnRiskTable />
    </div>
  );
}
```

#### 6. Cohort Analysis Component
**File**: `src/components/CohortAnalysis.jsx`

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CohortAnalysis() {
  const [cohorts, setCohorts] = useState([]);

  useEffect(() => {
    loadCohorts();
  }, []);

  async function loadCohorts() {
    const { data } = await supabase
      .from('cohort_analysis')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('cohort_month', { ascending: false })
      .order('months_since_join');

    // Transform flat data into matrix
    const cohortMatrix = transformToCohortMatrix(data);
    setCohorts(cohortMatrix);
  }

  function transformToCohortMatrix(data) {
    const matrix = {};
    data.forEach(row => {
      const month = row.cohort_month;
      if (!matrix[month]) {
        matrix[month] = {
          month,
          customerCount: row.customer_count,
          retention: []
        };
      }
      matrix[month].retention[row.months_since_join] = row.retention_rate;
    });
    return Object.values(matrix);
  }

  return (
    <div className="cohort-analysis">
      <h2>📈 Cohort Analysis</h2>
      <table className="cohort-table">
        <thead>
          <tr>
            <th>Cohort</th>
            <th>Users</th>
            <th>Month 0</th>
            <th>Month 1</th>
            <th>Month 2</th>
            <th>Month 3</th>
            <th>Month 6</th>
            <th>Month 12</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map(cohort => (
            <tr key={cohort.month}>
              <td>{formatMonth(cohort.month)}</td>
              <td>{cohort.customerCount}</td>
              {[0, 1, 2, 3, 6, 12].map(month => (
                <td key={month} className={getRetentionClass(cohort.retention[month])}>
                  {cohort.retention[month]?.toFixed(1)}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### 🎁 Priority 3: Loyalty & Rewards

#### 7. Loyalty Program Dashboard
**File**: `src/pages/customer/LoyaltyDashboard.jsx`

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function LoyaltyDashboard() {
  const [loyalty, setLoyalty] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadLoyaltyData();
  }, []);

  async function loadLoyaltyData() {
    // Get customer loyalty info
    const { data: loyaltyData } = await supabase
      .from('customer_loyalty')
      .select(`
        *,
        loyalty_tiers (name, color, perks)
      `)
      .eq('user_id', userId)
      .single();

    // Get available rewards
    const { data: rewardsData } = await supabase
      .from('rewards_catalog')
      .select('*')
      .eq('is_active', true)
      .lte('points_cost', loyaltyData.current_points + 1000) // Show future rewards
      .order('points_cost');

    // Get points history
    const { data: transactionsData } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_loyalty_id', loyaltyData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setLoyalty(loyaltyData);
    setRewards(rewardsData);
    setTransactions(transactionsData);
  }

  async function redeemReward(rewardId) {
    const { data } = await supabase
      .rpc('redeem_reward', {
        p_reward_id: rewardId,
        p_user_id: userId
      });

    if (data.success) {
      alert('Reward redeemed successfully!');
      loadLoyaltyData();
    } else {
      alert(`Error: ${data.error}`);
    }
  }

  return (
    <div className="loyalty-dashboard">
      {/* Points Balance Card */}
      <div className="points-card">
        <h2>{loyalty?.current_points || 0} Points</h2>
        <div className="tier-badge" style={{ backgroundColor: loyalty?.loyalty_tiers?.color }}>
          {loyalty?.loyalty_tiers?.name || 'Bronze'} Tier
        </div>
        <p>Lifetime Points: {loyalty?.lifetime_points || 0}</p>
      </div>

      {/* Tier Progress */}
      <TierProgress currentPoints={loyalty?.lifetime_points} />

      {/* Available Rewards */}
      <div className="rewards-catalog">
        <h3>🎁 Available Rewards</h3>
        <div className="rewards-grid">
          {rewards.map(reward => (
            <RewardCard 
              key={reward.id}
              reward={reward}
              canAfford={loyalty?.current_points >= reward.points_cost}
              onRedeem={() => redeemReward(reward.id)}
            />
          ))}
        </div>
      </div>

      {/* Points History */}
      <div className="points-history">
        <h3>📜 Points History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Points</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                <td>{tx.description}</td>
                <td className={tx.points_earned > 0 ? 'earned' : 'redeemed'}>
                  {tx.points_earned > 0 ? '+' : '-'}
                  {tx.points_earned || tx.points_redeemed}
                </td>
                <td>{tx.balance_after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### 8. Promotional Campaign Creator
**File**: `src/pages/owner/PromotionalCampaigns.jsx`

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function PromotionalCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    const { data } = await supabase
      .from('promotional_campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setCampaigns(data);
  }

  async function createCampaign(formData) {
    const { data, error } = await supabase
      .from('promotional_campaigns')
      .insert({
        tenant_id: tenantId,
        ...formData
      });

    if (!error) {
      setShowForm(false);
      loadCampaigns();
    }
  }

  return (
    <div className="promotional-campaigns">
      <div className="header">
        <h1>🎉 Promotional Campaigns</h1>
        <button onClick={() => setShowForm(true)}>+ New Campaign</button>
      </div>

      {showForm && (
        <CampaignForm onSubmit={createCampaign} onCancel={() => setShowForm(false)} />
      )}

      <div className="campaigns-list">
        {campaigns.map(campaign => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}

function CampaignForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    campaign_type: 'happy_hour',
    discount_type: 'percentage',
    discount_value: 0,
    promo_code: '',
    start_date: '',
    end_date: '',
    valid_time_start: '',
    valid_time_end: ''
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <input 
        type="text" 
        placeholder="Campaign Name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
      />
      
      <select 
        value={formData.campaign_type}
        onChange={(e) => setFormData({...formData, campaign_type: e.target.value})}
      >
        <option value="happy_hour">Happy Hour</option>
        <option value="early_bird">Early Bird</option>
        <option value="event_special">Event Special</option>
        <option value="seasonal">Seasonal</option>
      </select>

      {/* More form fields... */}

      <div className="form-actions">
        <button type="submit">Create Campaign</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

---

## 🛠️ Utility Functions

### Currency Utilities
**File**: `src/utils/currencyUtils.js`

```javascript
import { supabase } from '../supabaseClient';

export async function convertCurrency(amount, fromCurrency, toCurrency) {
  const { data } = await supabase.rpc('convert_currency', {
    p_amount: amount,
    p_from_currency: fromCurrency,
    p_to_currency: toCurrency
  });
  return data;
}

export function formatCurrency(amount, currency = 'ZAR') {
  const symbols = {
    ZAR: 'R',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  
  return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
}
```

### Offline Queue Utilities
**File**: `src/utils/offlineQueue.js`

```javascript
import { supabase } from '../supabaseClient';

export async function queueOfflineAction(actionType, actionData) {
  const deviceId = localStorage.getItem('device_id') || generateDeviceId();
  
  await supabase.from('offline_queue').insert({
    tenant_id: tenantId,
    user_id: userId,
    device_id: deviceId,
    action_type: actionType,
    action_data: actionData,
    status: 'pending'
  });
}

export async function syncOfflineQueue() {
  const deviceId = localStorage.getItem('device_id');
  
  const { data } = await supabase.rpc('sync_device_queue', {
    p_device_id: deviceId
  });
  
  return data;
}

function generateDeviceId() {
  const id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('device_id', id);
  return id;
}
```

---

## 📱 Mobile-First Considerations

### Responsive Design
- All components should be mobile-first
- Use CSS Grid/Flexbox for layouts
- Touch-friendly buttons (min 44x44px)
- Swipe gestures for navigation

### Offline Support
- Service Worker for caching
- LocalStorage for temporary data
- IndexedDB for large datasets
- Background sync when online

### Performance
- Lazy load components
- Virtual scrolling for long lists
- Image optimization
- Code splitting

---

## 🎨 Styling Recommendations

### CSS Variables
```css
:root {
  --color-primary: #6366f1;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;
  
  --tier-bronze: #cd7f32;
  --tier-silver: #c0c0c0;
  --tier-gold: #ffd700;
  --tier-platinum: #e5e4e2;
}
```

### Component Classes
- `.subscription-card` - Subscription plan cards
- `.loyalty-badge` - Tier badges
- `.currency-selector` - Currency dropdown
- `.offline-indicator` - Offline/sync status
- `.analytics-chart` - Chart containers
- `.kpi-card` - KPI metric cards

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Currency conversion calculations
- [ ] Points calculation logic
- [ ] Tier progression logic
- [ ] Offline queue management

### Integration Tests
- [ ] Subscription upgrade/downgrade flow
- [ ] 2FA setup and verification
- [ ] Reward redemption process
- [ ] Offline sync process

### E2E Tests
- [ ] Complete customer journey
- [ ] Owner dashboard workflows
- [ ] Staff QR scanning offline
- [ ] Campaign creation and usage

---

## 📚 Additional Resources

### Libraries to Install
```bash
npm install qrcode.react
npm install chart.js react-chartjs-2
npm install date-fns
npm install react-qr-reader
npm install otplib
```

### Useful Hooks
```javascript
// useSubscription.js
export function useSubscription() {
  const [plan, setPlan] = useState(null);
  // Implementation
  return { plan, upgradePlan, downgradePlan };
}

// useLoyalty.js
export function useLoyalty() {
  const [points, setPoints] = useState(0);
  // Implementation
  return { points, redeemReward, history };
}

// useOffline.js
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Implementation
  return { isOnline, queueAction, syncQueue };
}
```

---

**Next Step**: Start with Priority 1 components and test thoroughly before moving to Priority 2.
