# Quick Setup: Email Logging System

## What Was Added

✅ **Database Table** - `email_logs` table to store all email records  
✅ **Email Logger Utility** - Functions to log and retrieve emails  
✅ **Email Logs Page** - UI to view and filter email logs  
✅ **Auto-logging** - Automatic logging for signup and password reset emails  
✅ **Statistics Dashboard** - View email metrics and statistics

## Setup Instructions

### Step 1: Apply Database Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the contents of: `supabase/migrations/20260218000000_email_logs.sql`
4. Paste and click **Run**
5. Verify table was created:
   ```sql
   SELECT * FROM email_logs LIMIT 1;
   ```

### Step 2: Test the Feature

#### Test Signup Email Logging:

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:5173/auth/register`

3. Create a new account with any email (e.g., `SeoloaTS@ESKOMCO.ZA` or `cp@golfhub.co.za`)

4. After signup, the email log is automatically created

#### Test Password Reset Logging:

1. Go to `http://localhost:5173/auth/forgot-password`

2. Enter any email address

3. Request password reset

4. Email log is automatically created

### Step 3: View Email Logs

1. Login as an **owner** or **admin** account

2. From the dashboard, click **Email Logs** card

3. Or navigate directly to: `http://localhost:5173/owner/email-logs`

4. You'll see:
   - Total emails sent
   - Signup verification count
   - Password reset count
   - Last 24 hours activity
   - Full log table with filters

### Step 4: Verify in Database

Query the logs directly:

```sql
-- View all email logs
SELECT 
  email_type,
  email_to,
  status,
  sent_at,
  metadata
FROM email_logs 
ORDER BY sent_at DESC 
LIMIT 20;

-- Count by type
SELECT 
  email_type,
  COUNT(*) as count
FROM email_logs 
GROUP BY email_type;

-- Recent signup verifications
SELECT * FROM email_logs 
WHERE email_type = 'signup_verification'
ORDER BY sent_at DESC;
```

## What Gets Logged

### Signup Verification Emails

When a user signs up:
- ✉️ Email address
- 👤 User ID
- 🏢 Tenant ID
- 🎭 User role
- 📅 Signup timestamp
- 📧 Email type: `signup_verification`

### Password Reset Emails

When password reset is requested:
- ✉️ Email address
- 👤 User ID (if found)
- 🏢 Tenant ID (if found)
- 📅 Request timestamp
- 📧 Email type: `password_reset`

## Features

### Email Logs Page (`/owner/email-logs`)

**Statistics Cards:**
- 📊 Total emails sent
- 📧 Signup verifications
- 🔑 Password resets
- ⏰ Last 24 hours activity

**Filters:**
- Filter by email type
- Filter by status
- Clear all filters

**Table Columns:**
- Email type with icon
- Recipient email
- Subject line
- Status badge (color-coded)
- Sent timestamp
- Metadata (expandable)

**Status Types:**
- 🔵 Sent - Email was sent
- 🟢 Delivered - Email arrived
- 🔴 Failed - Email sending failed
- 🟠 Bounced - Email bounced
- 🟣 Opened - Email was opened

## Next Steps

### Add More Email Types

Edit `src/utils/emailLogger.js` to add:

```javascript
// Staff invitation
export const logStaffInvitationEmail = async (email, tenantId, invitedBy) => {
  return await logEmail({
    emailTo: email,
    emailType: 'staff_invitation',
    subject: 'You\'re invited to join Bar SaaS',
    tenantId: tenantId,
    metadata: { invited_by: invitedBy }
  })
}

// Order confirmation
export const logOrderConfirmationEmail = async (email, userId, tenantId, orderId) => {
  return await logEmail({
    emailTo: email,
    emailType: 'order_confirmation',
    subject: 'Order Confirmation',
    userId: userId,
    tenantId: tenantId,
    metadata: { order_id: orderId }
  })
}
```

### Update Email Status

If you integrate with an email service provider (like SendGrid, Mailgun):

```javascript
import { updateEmailStatus } from '../utils/emailLogger'

// When email is delivered
await updateEmailStatus(emailLogId, 'delivered')

// When email fails
await updateEmailStatus(emailLogId, 'failed', 'Invalid email address')

// When email is opened
await updateEmailStatus(emailLogId, 'opened')
```

## Troubleshooting

**Problem:** Email logs page shows "No email logs found"
- **Solution:** Create a new account to generate signup verification logs

**Problem:** Permission denied when viewing logs
- **Solution:** Ensure you're logged in as owner/admin role

**Problem:** Migration fails
- **Solution:** Ensure UUID extension is enabled: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

**Problem:** Logs not appearing after signup
- **Solution:** Check browser console for errors, verify migration was applied

## Files Modified/Created

### Created:
- ✅ `supabase/migrations/20260218000000_email_logs.sql` - Database schema
- ✅ `src/utils/emailLogger.js` - Logging utilities
- ✅ `src/pages/owner/EmailLogsPage.jsx` - UI page
- ✅ `EMAIL_LOGGING.md` - Full documentation

### Modified:
- ✅ `src/contexts/AuthContext.jsx` - Added email logging
- ✅ `src/App.jsx` - Added route
- ✅ `src/pages/OwnerDashboard.jsx` - Added navigation card

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Create new account → Email log created
- [ ] Request password reset → Email log created
- [ ] View email logs page as owner
- [ ] Filter by email type works
- [ ] Filter by status works
- [ ] Statistics show correct counts
- [ ] Metadata is viewable

---

🎉 **Your email logging system is ready to use!**

All signup verification emails (including to `SeoloaTS@ESKOMCO.ZA` and `cp@golfhub.co.za`) will now be logged automatically.
