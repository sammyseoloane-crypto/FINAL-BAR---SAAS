# Table Reservation Grace Period & No-Show System

## Overview
The system automatically marks table reservations as "no-show" if customers don't check in within the grace period (default: 30 minutes after reservation time).

## How It Works

### 1. Grace Period Calculation
- When a reservation is created, a `grace_period_end_datetime` is automatically calculated
- Default grace period: 30 minutes after `reservation_datetime`
- Formula: `grace_period_end_datetime = reservation_datetime + grace_period_minutes`

### 2. Status Flow
```
pending/confirmed → (grace period expires) → no_show
                 ↓ (customer checks in)
              checked_in
```

### 3. Automatic Checking

#### Frontend Integration (Active)
✅ No-shows are checked automatically when:
- Customers view their reservations
- VIP hosts load reservation list
- Owners view the nightclub dashboard
- VIP tables dashboard loads

#### Edge Function (Recommended for Production)
The edge function `process-no-shows` should be called every 5 minutes for real-time processing.

## Setup Instructions

### Deploy Edge Function

```bash
# Navigate to project root
cd my-bar-app

# Deploy the edge function
supabase functions deploy process-no-shows
```

### Option 1: GitHub Actions Cron (Recommended)

Create `.github/workflows/process-no-shows.yml`:

```yaml
name: Process Table Reservation No-Shows

on:
  schedule:
    # Run every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  process-no-shows:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://<your-project-ref>.supabase.co/functions/v1/process-no-shows
```

### Option 2: External Cron Service (EasyCron, Cron-job.org)

1. Go to [EasyCron](https://www.easycron.com/) or [Cron-job.org](https://cron-job.org/)
2. Create a new cron job:
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/process-no-shows`
   - Method: POST
   - Headers:
     - `Authorization: Bearer <your-anon-key>`
     - `Content-Type: application/json`
   - Schedule: Every 5 minutes (`*/5 * * * *`)

### Option 3: Server-side Cron (If you have a backend)

```javascript
// Node.js with node-cron
const cron = require('node-cron');
const axios = require('axios');

cron.schedule('*/5 * * * *', async () => {
  try {
    const response = await axios.post(
      'https://<your-project-ref>.supabase.co/functions/v1/process-no-shows',
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('No-show processing:', response.data);
  } catch (error) {
    console.error('Error processing no-shows:', error);
  }
});
```

## Manual Trigger

You can manually trigger no-show processing:

### Via SQL
```sql
SELECT * FROM check_and_mark_no_shows();
```

### Via Edge Function
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-no-shows
```

## Database Functions Reference

### `check_and_mark_no_shows()`
- Marks all expired reservations (past grace period) as no-show
- Returns list of marked reservations
- Safe to call multiple times (idempotent)

### `get_reservations_in_grace_period(p_tenant_id)`
- Returns reservations currently in grace period
- Shows minutes remaining before no-show
- Used by VIP hosts to see urgent check-ins

### `process_reservation_status_updates()`
- Main wrapper function that calls `check_and_mark_no_shows()`
- Returns JSON with count of processed reservations
- This is what the edge function calls

## Monitoring

### Check No-Show Processing Logs

```sql
-- Recent no-shows
SELECT 
  id,
  table_id,
  user_id,
  reservation_datetime,
  grace_period_end_datetime,
  status,
  metadata->>'marked_no_show_at' as marked_at
FROM table_reservations
WHERE status = 'no_show'
  AND metadata->>'auto_marked_no_show' = 'true'
ORDER BY grace_period_end_datetime DESC
LIMIT 20;
```

### Check Grace Period Status

```sql
-- View current grace period summary
SELECT * FROM reservation_status_summary
WHERE grace_status IN ('in_grace_period', 'should_be_no_show')
ORDER BY grace_period_end_datetime;
```

## Troubleshooting

### Reservations Not Being Marked
1. Check if edge function is deployed: `supabase functions list`
2. Verify cron job is running
3. Check function execution logs: `supabase functions logs process-no-shows`
4. Manually trigger: `SELECT * FROM check_and_mark_no_shows();`

### Grace Period Too Short/Long
Update default grace period:
```sql
ALTER TABLE table_reservations 
ALTER COLUMN grace_period_minutes SET DEFAULT 45; -- 45 minutes
```

Or set per reservation:
```sql
UPDATE table_reservations
SET grace_period_minutes = 60 -- 1 hour
WHERE id = 'reservation-id';
```

## Configuration

### Default Grace Period
Current: **30 minutes** (database default)

To change globally:
```sql
ALTER TABLE table_reservations 
ALTER COLUMN grace_period_minutes SET DEFAULT 30;
```

### Cron Schedule
Recommended: **Every 5 minutes** (`*/5 * * * *`)

More aggressive: Every 1 minute (`* * * * *`)
Less aggressive: Every 15 minutes (`*/15 * * * *`)

## Status

✅ **Current Status**: Grace period system is implemented
✅ **Frontend checks**: Active when users view reservations
⚠️ **Cron job**: Needs to be set up for production (see setup instructions above)

## Next Steps

1. Deploy edge function: `supabase functions deploy process-no-shows`
2. Set up GitHub Actions workflow or external cron service
3. Monitor logs to ensure it's working
4. Adjust grace period if needed based on business requirements
