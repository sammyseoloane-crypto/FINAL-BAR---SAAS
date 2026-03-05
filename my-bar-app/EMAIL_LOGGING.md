# Email Logging System

This document describes the email logging system that tracks all emails sent from the Bar SaaS application.

## Overview

The email logging system captures and stores information about every email sent, including:
- Signup verification emails
- Password reset emails
- Staff invitation emails (future)
- Order confirmations (future)
- General notifications (future)

## Architecture

### Database Schema

**Table: `email_logs`**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User associated with the email (nullable) |
| tenant_id | UUID | Tenant associated with the email (nullable) |
| email_to | VARCHAR(255) | Recipient email address |
| email_type | VARCHAR(50) | Type of email (see types below) |
| subject | VARCHAR(500) | Email subject line |
| status | VARCHAR(50) | Email status (sent, delivered, failed, bounced, opened) |
| metadata | JSONB | Additional metadata about the email |
| error_message | TEXT | Error message if email failed |
| sent_at | TIMESTAMP | When the email was sent |
| created_at | TIMESTAMP | Record creation timestamp |

### Email Types

- `signup_verification` - Email sent after user registration
- `password_reset` - Email sent for password reset requests
- `staff_invitation` - Email sent to invite staff members
- `order_confirmation` - Email sent after order placement
- `notification` - General notification emails

### Email Status

- `sent` - Email was sent to the mail server
- `delivered` - Email was successfully delivered
- `failed` - Email sending failed
- `bounced` - Email bounced back
- `opened` - Email was opened by recipient (requires integration)

## Implementation

### Files Created

1. **Migration: `supabase/migrations/20260218000000_email_logs.sql`**
   - Creates the `email_logs` table
   - Sets up Row Level Security (RLS) policies
   - Creates helper views for statistics

2. **Utility: `src/utils/emailLogger.js`**
   - `logEmail()` - Core logging function
   - `logSignupVerificationEmail()` - Log signup emails
   - `logPasswordResetEmail()` - Log password reset emails
   - `logStaffInvitationEmail()` - Log staff invitations
   - `getUserEmailLogs()` - Get emails for a user
   - `getTenantEmailLogs()` - Get emails for a tenant
   - `getEmailStatistics()` - Get email statistics
   - `updateEmailStatus()` - Update email status

3. **Page: `src/pages/owner/EmailLogsPage.jsx`**
   - View all email logs for the tenant
   - Filter by email type and status
   - View statistics dashboard
   - Monitor email delivery

4. **Updated: `src/contexts/AuthContext.jsx`**
   - Logs email when user signs up
   - Logs email when password reset is requested

5. **Updated: `src/App.jsx`**
   - Added route for `/owner/email-logs`

6. **Updated: `src/pages/OwnerDashboard.jsx`**
   - Added Email Logs card with navigation

## Usage

### For Developers

#### Log a signup verification email:

```javascript
import { logSignupVerificationEmail } from '../utils/emailLogger'

await logSignupVerificationEmail(
  'user@example.com',  // email
  'user-uuid',          // user ID
  'tenant-uuid',        // tenant ID
  'customer'            // role
)
```

#### Log a password reset email:

```javascript
import { logPasswordResetEmail } from '../utils/emailLogger'

await logPasswordResetEmail(
  'user@example.com',  // email
  'user-uuid',          // user ID (optional)
  'tenant-uuid'         // tenant ID (optional)
)
```

#### Get email logs:

```javascript
import { getTenantEmailLogs, getEmailStatistics } from '../utils/emailLogger'

// Get recent logs
const { data: logs } = await getTenantEmailLogs('tenant-uuid', 50)

// Get statistics
const { data: stats } = await getEmailStatistics('tenant-uuid')
```

### For Owners/Admins

1. Navigate to **Owner Dashboard**
2. Click on **Email Logs** card
3. View all emails sent from your system
4. Use filters to find specific emails:
   - Filter by email type (signup, password reset, etc.)
   - Filter by status (sent, delivered, failed, etc.)
5. View statistics:
   - Total emails sent
   - Signup verification emails
   - Password reset emails
   - Recent activity (last 24 hours)

## Database Setup

Run the migration to create the email_logs table:

```bash
# Apply the migration in Supabase SQL Editor
# Copy and paste contents of:
# supabase/migrations/20260218000000_email_logs.sql
```

Or if using Supabase CLI:

```bash
supabase db push
```

## Security

### Row Level Security (RLS)

The `email_logs` table has the following RLS policies:

1. **Owners and admins can view tenant email logs**
   - Owners/admins can see all emails for their tenant
   
2. **Users can view their own email logs**
   - Users can see emails sent to them
   
3. **System can insert email logs**
   - Allows logging during signup (before user is authenticated)
   
4. **Owners and admins can update email status**
   - For tracking delivery and opens

## Testing

### Test Signup Email Logging

1. Go to `/auth/register`
2. Create a new account
3. Check the email_logs table:
   ```sql
   SELECT * FROM email_logs 
   WHERE email_type = 'signup_verification' 
   ORDER BY sent_at DESC 
   LIMIT 10;
   ```
4. Verify the log entry was created

### Test Password Reset Email Logging

1. Go to `/auth/forgot-password`
2. Request a password reset
3. Check the email_logs table:
   ```sql
   SELECT * FROM email_logs 
   WHERE email_type = 'password_reset' 
   ORDER BY sent_at DESC 
   LIMIT 10;
   ```

### View Logs in UI

1. Login as an owner/admin
2. Navigate to `/owner/email-logs`
3. Verify you can see email logs
4. Test filters and statistics

## Future Enhancements

1. **Email Webhooks**
   - Integrate with email service provider webhooks
   - Update status automatically (delivered, opened, bounced)

2. **Email Templates**
   - Store email templates in database
   - Track which template was used

3. **Retry Failed Emails**
   - Add functionality to retry failed emails
   - Exponential backoff for retries

4. **Advanced Analytics**
   - Open rates by email type
   - Bounce rate analysis
   - Best send times

5. **Email Preferences**
   - Allow users to opt in/out of certain emails
   - Track user email preferences

6. **Export Functionality**
   - Export email logs to CSV
   - Generate PDF reports

7. **Real-time Notifications**
   - Alert admins when emails fail
   - Dashboard notifications for bounced emails

## Troubleshooting

### Email logs not appearing

1. Check if migration was applied:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'email_logs';
   ```

2. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'email_logs';
   ```

3. Check browser console for errors

### Permission denied errors

1. Verify user has owner/admin role
2. Check RLS policies are correctly configured
3. Verify tenant_id matches user's tenant

### Logs showing old tenant data

1. Ensure filters are applied correctly
2. Clear browser cache
3. Refresh the page

## Support

For questions or issues with the email logging system:
- Check this documentation
- Review the migration file for schema details
- Inspect `src/utils/emailLogger.js` for logging functions
- Check Supabase logs for database errors

---

**Last Updated:** February 18, 2026  
**Version:** 1.0
