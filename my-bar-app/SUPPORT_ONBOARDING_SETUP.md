# Support & Onboarding System - Setup Guide

## 🎯 Overview

This guide covers the **Support & Onboarding System** implemented for the Multi-Tenant Bar SaaS platform. This system provides:

1. ✅ **Onboarding Wizard** - Guides new bar owners through initial setup
2. ✅ **Help Center** - Self-service knowledge base with FAQs and tutorials
3. ✅ **Error Reporting** - User-friendly bug reporting with Sentry integration
4. ✅ **Support Panel** - Admin dashboard for managing support tickets

## 📦 What Was Created

### Components Created

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/OnboardingWizard.jsx` | 5-step wizard for new tenants | 500+ |
| `src/components/OnboardingWizard.css` | Wizard styling | 300+ |
| `src/components/HelpCenter.jsx` | Knowledge base with FAQs/tutorials | 400+ |
| `src/components/HelpCenter.css` | Help center styling | 250+ |
| `src/components/ErrorReportButton.jsx` | Floating bug report button | 230+ |
| `src/components/ErrorReportButton.css` | Error button styling | 200+ |
| `src/pages/SupportPanel.jsx` | Admin support ticket dashboard | 350+ |
| `src/pages/SupportPanel.css` | Support panel styling | 300+ |
| `supabase/migrations/20260311000000_support_tickets.sql` | Database schema | 150+ |

**Total: ~2,700 lines of code**

### Routes Added

| Route | Component | Access |
|-------|-----------|--------|
| `/help` | HelpCenter | Public (anyone) |
| `/onboarding` | OnboardingWizard | Authenticated users |
| `/owner/support` | SupportPanel | Owners/admins only |

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

```powershell
# Navigate to project
cd "d:\MULTI-TENANT BAR SAAS APP\my-bar-app"

# Apply migration to create support_tickets table
npx supabase db push
```

**What this creates:**
- `support_tickets` table with columns: id, user_id, user_email, tenant_id, type, severity, title, description, status, metadata, admin_response, etc.
- 6 indexes for performance (user_id, tenant_id, status, severity, type, created_at)
- 6 RLS policies for security
- Auto-update trigger for `updated_at` timestamp

### Step 2: Verify Dependencies

All required dependencies are already installed:
- ✅ React 19.2.4 (useState, useEffect hooks)
- ✅ React Router DOM (routing)
- ✅ Supabase Client (database operations)
- ✅ Sentry 7.91.0 (error tracking)

### Step 3: Test the System

#### 3.1 Test Help Center

```powershell
# Start dev server
npm run dev
```

1. Navigate to http://localhost:5173/help
2. Verify:
   - ✅ Search bar works (try searching "products")
   - ✅ Category filters work (click "Getting Started")
   - ✅ FAQs expand/collapse when clicked
   - ✅ Tutorials display correctly
   - ✅ Quick links navigate properly

#### 3.2 Test Error Reporting

1. Log in as any user
2. Click floating bug report button (bottom-right corner)
3. Fill out form:
   - Type: Bug
   - Severity: High
   - Title: "Test error report"
   - Description: "Testing error reporting system"
   - Steps to reproduce: "1. Click button 2. Fill form"
4. Submit and verify:
   - ✅ Success message appears
   - ✅ Ticket appears in database
   - ✅ Sentry receives the report

**To verify in database:**

```sql
SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 5;
```

#### 3.3 Test Support Panel

1. Log in as owner/admin
2. Navigate to http://localhost:5173/owner/support
3. Verify:
   - ✅ Tickets list displays
   - ✅ Filter buttons work (all, open, in_progress, resolved)
   - ✅ Click ticket to view details
   - ✅ Add admin response
   - ✅ Update ticket status
   - ✅ Technical information displays (URL, browser, viewport)

#### 3.4 Test Onboarding Wizard

1. Create new test user (register new account)
2. Navigate to http://localhost:5173/onboarding
3. Complete all 5 steps:
   - **Step 1:** Business Info (name, type, address, phone)
   - **Step 2:** Business Hours (set hours for each day)
   - **Step 3:** Products (add 2-3 test products)
   - **Step 4:** Review (verify all information)
   - **Step 5:** Complete (see success message)
4. Verify data saved in database:

```sql
SELECT id, name, settings FROM tenants WHERE id = '<tenant-id>';
```

Check that `settings` JSONB contains:
- `onboardingCompleted: true`
- Business hours array
- Initial products array

## 📊 Features Breakdown

### 1. Onboarding Wizard

**Purpose:** Reduce setup friction for new bar owners

**Flow:**
1. **Business Information**
   - Business name
   - Type (Bar, Restaurant, Pub, Nightclub, Lounge)
   - Address, city, province
   - Phone number
   
2. **Business Hours**
   - Set open/close times for each day
   - Option to mark days as closed
   - Default: Monday-Sunday 11:00-23:00

3. **Initial Products**
   - Add menu items (name, price, category)
   - Categories: Drinks, Food, Specials
   - Minimum 1 product required

4. **Review & Confirm**
   - Display all entered information
   - Edit buttons to go back to steps
   
5. **Completion**
   - Success message
   - Next steps checklist
   - Redirect to dashboard

**Data Storage:**
```json
{
  "onboardingCompleted": true,
  "businessInfo": {
    "name": "The Bar",
    "type": "bar",
    "address": "123 Main St",
    "city": "Cape Town",
    "province": "Western Cape",
    "phone": "+27123456789"
  },
  "businessHours": [
    { "day": "Monday", "open": "11:00", "close": "23:00", "closed": false },
    // ... other days
  ],
  "initialProducts": [
    { "name": "Castle Lager", "price": "35", "category": "drinks" }
  ]
}
```

### 2. Help Center

**Purpose:** Self-service knowledge base to reduce support load

**Content Included:**

**8 Categories:**
- 🚀 Getting Started
- 📦 Products & Menu
- 🛒 Orders & Sales
- 💳 Payments & Billing
- 👥 Staff Management
- ⚙️ Settings
- 🔧 Troubleshooting
- 📱 Mobile & QR Codes

**20 FAQs:**
- How do I add products to my menu?
- How do I manage my staff members?
- How do I set up Stripe payments?
- What are QR codes and how do they work?
- How do customers place orders?
- How do I view sales reports?
- How can I export my data?
- What happens if I cancel my subscription?
- And 12 more...

**4 Detailed Tutorials:**
1. **Complete Setup Guide** (10 min, 6 steps)
2. **Adding Your First Products** (5 min, 4 steps)
3. **Managing Staff & Permissions** (7 min, 5 steps)
4. **Understanding QR Code Orders** (8 min, 6 steps)

**Features:**
- 🔍 Search functionality (filters FAQs and tutorials)
- 🏷️ Category filtering
- 📖 Expandable FAQ accordion
- 🔗 Quick links to dashboard sections
- 📧 Contact support section

### 3. Error Reporting Button

**Purpose:** User-friendly bug reporting with automatic tracking

**Features:**
- 🎯 Floating action button (FAB) in bottom-right
- 📋 Modal form with structured fields
- 🔴 Severity levels: Low, Medium, High, Critical
- 🐛 Issue types: Bug, Feature, Performance, Usability, Security, Other
- 📝 Conditional fields for bugs (steps to reproduce, expected/actual behavior)
- 🔍 Automatic metadata collection:
  - Current URL
  - User agent (browser info)
  - Viewport size
  - Timestamp
  - User role
- ✅ Saves to database (support_tickets table)
- 🔔 Sends to Sentry for tracking
- 🔒 Security issues tracked specially with `trackSecurityIssue()`
- ✨ Success confirmation screen

**Example Metadata:**
```json
{
  "url": "https://yourapp.com/dashboard",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
  "viewport": "1920x1080",
  "timestamp": "2024-03-11T14:23:45.123Z",
  "role": "owner"
}
```

### 4. Support Panel

**Purpose:** Admin dashboard for managing support tickets

**Features:**
- 📋 List all support tickets
- 🔍 Filter by status (all, open, in_progress, resolved)
- 🎨 Color-coded badges:
  - **Severity:** Critical (red), High (orange), Medium (blue), Low (green)
  - **Status:** Open (blue), In Progress (orange), Resolved (green), Closed (gray)
- 📊 Detailed ticket view showing:
  - Title, description
  - User email, tenant name
  - Steps to reproduce, expected/actual behavior
  - Technical information (URL, browser, viewport)
  - Submission timestamp
- 💬 Add admin responses
- 🔄 Update ticket status workflow: Open → In Progress → Resolved → Closed
- 👤 Track which admin responded and when
- 📧 Email notification TODO (to be implemented)

**Status Workflow:**
```
Open → In Progress → Resolved → Closed
  ↓         ↓           ↓
(New)   (Working)   (Fixed)   (Archived)
```

## 🔐 Security & RLS Policies

### RLS Policies Created

1. **Users can create support tickets** (INSERT for authenticated + anon)
   - Allows anyone to submit tickets
   - Even anonymous users can report issues

2. **Users can view their own tickets** (SELECT for authenticated)
   - Users see only tickets they submitted
   - Filtered by `user_id = auth.uid()`

3. **Owners can view tenant tickets** (SELECT for owners)
   - Tenant owners see tickets from their tenant users
   - Filtered by `tenant_id` match

4. **Admins can view all tickets** (SELECT for admins)
   - Platform admins/support staff see everything
   - Role check: `role IN ('admin', 'support')`

5. **Admins can update tickets** (UPDATE for admins/owners)
   - Add responses, change status
   - Role check: `role IN ('admin', 'support', 'owner')`

6. **Admins can delete tickets** (DELETE for admins)
   - Only platform admins can delete
   - Role check: `role IN ('admin', 'support')`

## 📈 Monitoring & Analytics

### Sentry Integration

Error reports are automatically sent to Sentry with:
- Issue title and description
- Severity level
- User context (ID, email, role, tenant)
- Tags: `issue_type`, `severity`, `tenant_id`
- Breadcrumbs from error metadata

**Example Sentry event:**
```javascript
Sentry.captureMessage(`Support Ticket: ${title}`, {
  level: severity === 'critical' || severity === 'high' ? 'error' : 'warning',
  tags: {
    issue_type: type,
    severity: severity,
    tenant_id: tenantId
  },
  contexts: {
    ticket: { id, type, severity, status }
  }
});
```

### Database Queries for Analytics

```sql
-- Tickets by severity
SELECT severity, COUNT(*) as count
FROM support_tickets
GROUP BY severity
ORDER BY count DESC;

-- Tickets by type
SELECT type, COUNT(*) as count
FROM support_tickets
GROUP BY type
ORDER BY count DESC;

-- Average response time
SELECT AVG(EXTRACT(EPOCH FROM (responded_at - created_at))/3600) as avg_hours
FROM support_tickets
WHERE responded_at IS NOT NULL;

-- Open tickets by tenant
SELECT t.name, COUNT(*) as open_tickets
FROM support_tickets st
JOIN tenants t ON t.id = st.tenant_id
WHERE st.status IN ('open', 'in_progress')
GROUP BY t.id, t.name
ORDER BY open_tickets DESC;
```

## 🎨 UI/UX Highlights

### Design System

**Colors:**
- Primary: `#667eea` (purple gradient)
- Success: `#10b981` (green)
- Warning: `#f59e0b` (orange)
- Error: `#ef4444` (red)
- Info: `#3b82f6` (blue)
- Gray scale: `#1f2937` → `#f9fafb`

**Animations:**
- `fadeIn` - Opacity 0 → 1 (0.3s)
- `slideUp` - TranslateY 20px → 0 (0.3s)
- Hover effects on buttons, cards
- Smooth transitions (0.2s ease)

**Responsive Breakpoints:**
- Desktop: 1024px+
- Tablet: 768px - 1023px
- Mobile: < 768px

### Accessibility

- ✅ Semantic HTML (proper heading hierarchy)
- ✅ ARIA labels on buttons
- ✅ Keyboard navigation support
- ✅ Focus states on interactive elements
- ✅ Color contrast meets WCAG AA standards
- ✅ Form validation with clear error messages

## 🔨 Customization

### Adding New FAQs

Edit `src/components/HelpCenter.jsx`:

```javascript
const faqs = [
  // Add new FAQ
  {
    question: "Your new question?",
    answer: "Your detailed answer here.",
    category: "getting-started" // or products, orders, payments, staff, settings, troubleshooting
  },
  // ... existing FAQs
];
```

### Adding New Tutorial

```javascript
const tutorials = [
  {
    title: "Your Tutorial Title",
    description: "Brief description of what users will learn",
    duration: "5 min",
    steps: [
      "Step 1: Do this",
      "Step 2: Then this",
      "Step 3: Finally this"
    ]
  },
  // ... existing tutorials
];
```

### Customizing Onboarding Steps

Edit `src/components/OnboardingWizard.jsx`:

1. **Add new step:**
   - Update `totalSteps` constant
   - Add step rendering in `renderStep()` function
   - Add validation in `handleNext()` function
   - Update progress bar in render

2. **Modify business types:**
```javascript
<select>
  <option value="bar">Bar</option>
  <option value="restaurant">Restaurant</option>
  <option value="pub">Pub</option>
  <option value="nightclub">Nightclub</option>
  <option value="lounge">Lounge</option>
  <option value="cafe">Cafe</option> {/* Add new type */}
</select>
```

### Email Notifications (TODO)

To implement email notifications when admins respond to tickets:

1. **Create Edge Function:**
```typescript
// supabase/functions/send-support-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Resend from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  const { ticketId, userEmail, adminResponse } = await req.json();
  
  await resend.emails.send({
    from: "support@yourdomain.com",
    to: userEmail,
    subject: `Update on your support ticket #${ticketId}`,
    html: `
      <h2>Your support ticket has been updated</h2>
      <p><strong>Admin Response:</strong></p>
      <p>${adminResponse}</p>
      <p><a href="https://yourdomain.com/help">View in Help Center</a></p>
    `
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

2. **Call from SupportPanel:**
```javascript
const handleSendResponse = async () => {
  // ... existing code to save response ...
  
  // Send email notification
  await supabase.functions.invoke('send-support-email', {
    body: {
      ticketId: selectedTicket.id,
      userEmail: selectedTicket.user_email,
      adminResponse: adminResponse
    }
  });
};
```

## 📝 Next Steps

### Immediate Actions

- [ ] Deploy database migration
- [ ] Test all components in staging
- [ ] Add navigation links to dashboards
- [ ] Test onboarding flow with new user
- [ ] Configure email notifications

### Future Enhancements

- [ ] Add ticket attachments (screenshots)
- [ ] Implement real-time notifications (Supabase Realtime)
- [ ] Add ticket search functionality
- [ ] Create support metrics dashboard
- [ ] Add canned responses for common issues
- [ ] Implement SLA tracking (response time goals)
- [ ] Add customer satisfaction rating after resolution
- [ ] Create public status page for system health

## 🐛 Troubleshooting

### Issue: "support_tickets table does not exist"

**Solution:**
```powershell
npx supabase db push
```

### Issue: "Permission denied for table support_tickets"

**Solution:** Check RLS policies are applied:
```sql
SELECT * FROM pg_policies WHERE tablename = 'support_tickets';
```

### Issue: Error report button not visible

**Solution:** Verify placement in App.jsx:
```javascript
<ErrorReportButton /> // Should be inside <Router> but outside <Routes>
```

### Issue: Onboarding doesn't save data

**Solution:** Check tenant has permission to update their own record:
```sql
-- Add policy if needed
CREATE POLICY "Tenants can update their own settings"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (id IN (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));
```

## 📞 Support

For questions or issues with the support system:
- 📧 Email: dev@yourdomain.com
- 🐛 Report bugs using the floating button in the app
- 📖 Check `/help` for FAQs and tutorials

---

**Implementation Date:** March 11, 2024  
**Version:** 1.0.0  
**Status:** ✅ Ready for deployment
