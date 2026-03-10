# Real-Time Business Analytics Guide

## Overview
The Reports & Analytics dashboard now features **real-time updates** that automatically refresh when new transactions occur. This provides instant visibility into your bar's performance without manual page refreshes.

## Features

### 🔴 Real-Time Updates
- **Automatic Refresh**: Dashboard updates automatically when:
  - New transactions are created
  - Existing transactions are updated (status changes)
  - Transactions are cancelled or refunded
  
### 📊 Live Metrics
All metrics update in real-time:
- Total Revenue
- Total Transactions
- Pending Payments
- Revenue Growth Percentage
- Product Analytics
- Event Performance
- Sales Trends

### 🎯 Key Features

#### 1. Live Status Indicator
- **Green Pulse**: Real-time updates are active
- **Gray Dot**: Updates are paused
- Shows last update timestamp

#### 2. Control Panel
- **🔄 Refresh Button**: Manually trigger data refresh
- **⏸️ Pause/▶️ Resume**: Control real-time updates
- **Date Range Selector**: Filter data by time period

#### 3. Visual Feedback
- **Highlight Animation**: Cards flash when data updates
- **Smooth Transitions**: All changes animate smoothly
- **Update Indicators**: See exactly when data changed

#### 4. Auto-Refresh Backup
- Automatic refresh every 30 seconds as fallback
- Ensures data stays current even if real-time connection drops

## How It Works

### Technical Implementation

1. **Supabase Realtime Subscriptions**
   ```javascript
   // Subscribes to all transaction changes for your tenant
   supabase
     .channel('analytics-updates')
     .on('postgres_changes', {
       event: '*',
       table: 'transactions',
       filter: `tenant_id=eq.${your_tenant_id}`
     }, handleUpdate)
   ```

2. **Database Configuration**
   - Transactions table has `REPLICA IDENTITY FULL` enabled
   - Added to `supabase_realtime` publication
   - Supports INSERT, UPDATE, DELETE events

3. **Client-Side Updates**
   - React hooks manage subscriptions
   - Debounced refresh prevents excessive queries
   - Cleanup on component unmount

## Usage

### Viewing Real-Time Analytics

1. **Navigate to Reports Page**
   - Go to Owner Dashboard → Reports

2. **Check Live Status**
   - Look for green pulsing dot (top left)
   - Verify "Live Updates" text is shown

3. **Monitor Updates**
   - Watch the "Last updated" timestamp
   - Cards will flash yellow when data changes

### Testing Real-Time Updates

#### Method 1: Create Test Transaction
```sql
-- In Supabase SQL Editor
INSERT INTO transactions (
  tenant_id,
  user_id,
  product_id,
  amount,
  status
) VALUES (
  'your-tenant-id',
  'your-user-id',
  'your-product-id',
  100.00,
  'confirmed'
);
```

#### Method 2: Update Transaction Status
```sql
-- Change a pending transaction to confirmed
UPDATE transactions
SET status = 'confirmed',
    confirmed_at = NOW()
WHERE id = 'transaction-id'
  AND tenant_id = 'your-tenant-id';
```

#### Method 3: Use Customer App
- Make a purchase through the customer interface
- Watch the Reports dashboard update automatically

### Controlling Updates

**Pause Updates** (useful for reviewing data):
1. Click "⏸️ Pause" button
2. Data freezes at current state
3. Manual refresh still works

**Resume Updates**:
1. Click "▶️ Resume" button
2. Real-time updates restart
3. Data refreshes immediately

**Manual Refresh**:
- Click "🔄 Refresh" button anytime
- Forces immediate data fetch
- Works regardless of pause state

## Performance Considerations

### Optimizations
- **Debounced Updates**: 500ms delay prevents rapid-fire refreshes
- **Filtered Subscriptions**: Only receives relevant tenant data
- **Selective Queries**: Fetches only necessary data
- **Background Processing**: Updates don't block UI

### Best Practices
1. **Pause During Analysis**: Stop updates when studying specific data
2. **Adjust Date Range**: Shorter ranges load faster
3. **Monitor Connection**: Check live indicator status
4. **Use Manual Refresh**: If real-time seems delayed

## Troubleshooting

### Real-Time Not Working?

**Check Live Indicator**
- Is it green and pulsing?
- If gray, click "▶️ Resume"

**Verify Permissions**
- Ensure you're logged in as owner
- Confirm RLS policies allow reads

**Check Browser Console**
```javascript
// Should see these messages:
🔴 Setting up real-time analytics subscription...
📡 Real-time subscription status: SUBSCRIBED
🔴 Real-time update received: { ... }
```

**Test Database Connection**
```sql
-- Verify realtime is enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'transactions';
```

### No Updates Appearing?

**Verify Transaction Scope**
- Check date range filter
- Ensure transactions belong to your tenant
- Confirm transaction status (confirmed vs pending)

**Check Network**
- Look for WebSocket connection in DevTools
- Verify no firewall blocking WebSockets
- Check Supabase project status

**Force Reconnect**
1. Click "⏸️ Pause"
2. Wait 2 seconds
3. Click "▶️ Resume"
4. Watch console for reconnection

## Database Migration

**Apply the migration** to enable real-time:

```bash
# Run this command in your terminal
supabase db push

# Or apply manually in Supabase SQL Editor:
# Copy contents of: supabase/migrations/20260310100000_enable_realtime_analytics.sql
```

**Verify Migration**:
```sql
-- Check replica identity
SELECT tablename, relreplident
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE tablename = 'transactions';
-- Should show: 'f' (FULL)

-- Check publication
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- Should include 'transactions'
```

## Date Range Filtering

Analytics respect the selected date range:
- **Last 7 days**: Recent activity, faster loading
- **Last 30 days**: Monthly overview (default)
- **Last 90 days**: Quarterly insights
- **Last year**: Annual trends, slower loading

All real-time updates respect the current filter.

## Advanced Features

### Revenue Growth Calculation
- Compares current period to previous period
- Shows percentage increase/decrease
- Green ↑ for growth, Red ↓ for decline

### Product Analytics
- Top 5 products by revenue (chart)
- Category breakdown (pie chart)
- Full product table with percentages
- Quantity vs revenue analysis

### Event Performance
- Revenue per event
- Transaction count per event
- Average transaction value
- Sorted by revenue (highest first)

### Sales Trends
- Daily revenue line chart
- Identifies patterns and spikes
- Helps spot busy periods
- Supports planning and forecasting

## Security

### RLS Protection
- All queries filtered by tenant_id
- Users only see their own data
- Real-time subscriptions respect RLS
- No data leakage between tenants

### Authentication Required
- Must be logged in as owner
- Session validated on each request
- Automatic token refresh
- Secure WebSocket connections

## Future Enhancements

Potential additions:
- 📧 Email alerts for revenue milestones
- 📱 Push notifications for large transactions
- 📈 Predictive analytics and forecasting
- 🎯 Custom metric tracking
- 💾 Export reports as PDF/CSV
- 📊 Customizable dashboard widgets
- 👥 Multi-user comparative analytics
- ⏰ Scheduled report generation

## Support

### Resources
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Chart.js Documentation](https://www.chartjs.org/)
- [React Hooks Guide](https://react.dev/reference/react)

### Getting Help
1. Check browser console for errors
2. Verify migration applied successfully
3. Test with manual SQL insertions
4. Review RLS policies
5. Check Supabase project logs

---

**Last Updated**: March 10, 2026
**Version**: 1.0.0
