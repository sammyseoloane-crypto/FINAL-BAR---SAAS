# Quick Setup: Real-Time Analytics

## Step 1: Apply Database Migration

Run this command to enable real-time on your Supabase database:

```bash
cd my-bar-app
supabase db push
```

Or manually apply the migration in Supabase Dashboard:
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of: `supabase/migrations/20260310100000_enable_realtime_analytics.sql`
4. Click "Run"

## Step 2: Verify Real-Time is Enabled

In Supabase SQL Editor, run:

```sql
-- Check if transactions table is in realtime publication
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'transactions';
```

Should return 1 row. If not, manually run:

```sql
-- Enable realtime for transactions
ALTER TABLE transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
```

## Step 3: Test the Dashboard

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Login as an **owner** user

3. Navigate to **Reports** page

4. Look for the green pulsing dot (🟢) indicating "Live Updates"

## Step 4: Test Real-Time Updates

**Option A: Via SQL Editor**

In Supabase SQL Editor, insert a test transaction:

```sql
-- Replace with your actual tenant_id, user_id, product_id
INSERT INTO transactions (
  tenant_id,
  user_id,
  product_id,
  amount,
  status
) VALUES (
  'YOUR_TENANT_ID',
  'YOUR_USER_ID',
  'YOUR_PRODUCT_ID',
  50.00,
  'confirmed'
);
```

Watch the Reports dashboard update automatically!

**Option B: Via Customer App**

1. Open a second browser window
2. Login as a customer
3. Make a purchase
4. Watch the owner's Reports dashboard update in real-time

## Step 5: Check Browser Console

Open DevTools (F12) and look for these messages:

```
🔴 Setting up real-time analytics subscription...
📡 Real-time subscription status: SUBSCRIBED
🔴 Real-time update received: {...}
```

## Troubleshooting

**No green dot?**
- Check if you're logged in as owner
- Verify the component loaded correctly
- Check console for errors

**No updates appearing?**
- Click the "🔄 Refresh" button
- Verify transactions are within selected date range
- Check if "Live Updates" is active (not paused)
- Verify transaction belongs to your tenant_id

**Realtime not working?**
- Ensure migration was applied
- Check Supabase project is active
- Verify no firewall blocking WebSockets
- Try clicking "Resume" button

## Features to Test

✅ **Live Metrics**
- Total revenue updates instantly
- Transaction count increments
- Pending transactions track in real-time

✅ **Animations**
- Cards flash yellow on update
- Smooth transitions

✅ **Controls**
- Pause/Resume toggle
- Manual refresh button
- Date range filtering

✅ **Charts Update**
- Sales trend line chart
- Top products bar chart
- Category pie chart
- Recent transactions table

## Next Steps

Once working:
1. Monitor real transactions in production
2. Share dashboard with stakeholders
3. Use insights for business decisions
4. Consider adding alerts/notifications

---

For detailed documentation, see: [REALTIME_ANALYTICS_GUIDE.md](REALTIME_ANALYTICS_GUIDE.md)
