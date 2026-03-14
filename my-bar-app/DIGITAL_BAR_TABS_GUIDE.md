# 🍹 Digital Bar Tabs - Complete Deployment Guide

## Overview

The Digital Bar Tabs system allows customers to open tabs via QR codes, bartenders to add drinks in real-time, and customers to pay seamlessly with Stripe - all without paying for each round.

**Major Revenue Feature**: Encourages customers to keep ordering without the friction of multiple payments.

---

## 📋 Table of Contents

1. [What's Been Created](#whats-been-created)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Stripe Configuration](#stripe-configuration)
5. [Generate QR Codes](#generate-qr-codes)
6. [Testing the System](#testing-the-system)
7. [Usage Workflow](#usage-workflow)
8. [Troubleshooting](#troubleshooting)
9. [Integration Examples](#integration-examples)

---

## 🎯 What's Been Created

### **Database (Migration File)**
- **File**: `supabase/migrations/20260314000006_digital_bar_tabs.sql`
- **Tables**:
  - `tabs` - Main tab records (customer info, status, totals)
  - `tab_items` - Line items on tabs (drinks added)
- **Functions**:
  - `calculate_tab_total()` - Auto-calculate tab totals
  - `get_open_tabs()` - Get all open tabs for bartenders
  - `get_tab_details()` - Get detailed tab information
  - `get_customer_tab_by_phone()` - Find customer's active tab
- **Triggers**:
  - Auto-update tab totals when items change
  - Record drinks to analytics when tab closes
- **Features**:
  - Real-time enabled for instant updates
  - Multi-tenant security with RLS
  - Automatic tax calculation (15% - customizable)
  - Integration with drinks_sold analytics

### **Frontend Components**

**1. OpenTabPage** (`src/pages/OpenTabPage.jsx`)
- Customer landing page from QR code
- Name + phone input
- Creates new tab
- Mobile-optimized design

**2. CustomerTabView** (`src/components/CustomerTabView.jsx`)
- Live tab display for customers
- Real-time item updates
- Tip selection (10%, 15%, 20%, custom)
- Stripe payment integration
- Live total calculation

**3. BartenderTabManager** (`src/components/BartenderTabManager.jsx`)
- Desktop-optimized staff interface
- View all open tabs
- Add drinks to tabs
- Remove items
- Search and filter products
- Mark tabs for payment

### **Stripe Integration**
- **Edge Function**: `supabase/functions/create-payment-intent/index.ts`
- Secure server-side payment intent creation
- Metadata tracking for tabs
- South African Rand (ZAR) support

### **Routes Added**
- `/tab/open?tenant=X&table=Y` - QR code landing page (public)
- `/tab/view?tenant=X` - Customer tab view (public)
- `/staff/tabs` - Bartender tab manager (staff only)

---

## 🔧 Prerequisites

### **Required**
- ✅ Supabase project running
- ✅ Existing products table with drinks
- ✅ Existing tables table with venue tables
- ✅ Stripe account (test or live)
- ✅ Node.js & npm installed
- ✅ Supabase CLI installed

### **Stripe Packages** (already installed)
- `@stripe/stripe-js` 
- `@stripe/react-stripe-js`

---

## 🚀 Deployment Steps

### **Step 1: Deploy Database Migration**

```bash
# Navigate to project directory
cd "d:\MULTI-TENANT BAR SAAS APP\my-bar-app"

# Deploy migration
npx supabase db push
```

**Verify tables created:**
```sql
-- Run in Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('tabs', 'tab_items');

-- Verify functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%tab%';
```

---

### **Step 2: Configure Stripe**

#### **A. Get Stripe Keys**

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy **Publishable key** (starts with `pk_test_`)
3. Copy **Secret key** (starts with `sk_test_`)

#### **B. Add Environment Variables**

Create/update `.env` file:

```env
# Stripe Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

#### **C. Deploy Stripe Edge Function**

```bash
# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref your-project-ref

# Set Stripe secret in Supabase
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key

# Deploy edge function
npx supabase functions deploy create-payment-intent
```

**Verify Edge Function:**
```bash
npx supabase functions list
```

You should see `create-payment-intent` listed.

---

### **Step 3: Add Sample Products** (if needed)

If you don't have products/drinks in your database:

```sql
INSERT INTO products (tenant_id, name, price, type, available, description)
VALUES 
  ('your-tenant-id', 'Mojito', 120.00, 'drink', TRUE, 'Classic Cuban cocktail'),
  ('your-tenant-id', 'Beer', 45.00, 'drink', TRUE, 'Local craft beer'),
  ('your-tenant-id', 'Whiskey', 150.00, 'drink', TRUE, 'Premium whiskey'),
  ('your-tenant-id', 'Margarita', 110.00, 'drink', TRUE, 'Tequila-based cocktail'),
  ('your-tenant-id', 'Wine - Red', 80.00, 'drink', TRUE, 'House red wine'),
  ('your-tenant-id', 'Vodka Tonic', 95.00, 'drink', TRUE, 'Classic vodka mix');
```

---

### **Step 4: Start Development Server**

```bash
npm run dev
```

Server should start at `http://localhost:5175/`

---

## 🎨 Generate QR Codes

### **QR Code URL Format**

```
https://your-domain.com/tab/open?tenant={TENANT_ID}&table={TABLE_ID}
```

### **Method 1: Using Online Generator**

1. Go to https://www.qr-code-generator.com/
2. Enter URL: `https://your-domain.com/tab/open?tenant=YOUR_TENANT_ID&table=TABLE_ID`
3. Download PNG/SVG
4. Print and place at table

### **Method 2: Programmatic Generation**

Create a script to generate QR codes for all tables:

```javascript
// scripts/generate-table-qr-codes.js
import QRCode from 'qrcode';
import { supabase } from '../src/supabaseClient.js';

async function generateQRCodes() {
  const tenantId = 'your-tenant-id';
  
  // Get all tables
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name')
    .eq('tenant_id', tenantId);

  for (const table of tables) {
    const url = `https://your-domain.com/tab/open?tenant=${tenantId}&table=${table.id}`;
    
    await QRCode.toFile(
      `./qr-codes/${table.name}.png`,
      url,
      {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }
    );
    
    console.log(`Generated QR for ${table.name}`);
  }
}

generateQRCodes();
```

**Run script:**
```bash
node scripts/generate-table-qr-codes.js
```

### **Method 3: In-App QR Manager** (future enhancement)

Create an admin page to generate and download QR codes for all tables.

---

## 🧪 Testing the System

### **Test Scenario 1: Customer Opens Tab**

1. **Navigate to QR landing page:**
   ```
   http://localhost:5175/tab/open?tenant=YOUR_TENANT_ID&table=TABLE_ID
   ```

2. **Enter details:**
   - Name: "John Smith"
   - Phone: "+27123456789"
   - Click "Open My Tab"

3. **Verify in database:**
   ```sql
   SELECT * FROM tabs WHERE customer_phone = '+27123456789' AND status = 'open';
   ```

4. **Expected:** Redirect to `/tab/view` showing empty tab

---

### **Test Scenario 2: Bartender Adds Drinks**

1. **Login as staff member**

2. **Navigate to:**
   ```
   http://localhost:5175/staff/tabs
   ```

3. **Select John Smith's tab**

4. **Add drinks:**
   - Click "+ Add Drink"
   - Search for "Mojito"
   - Set quantity: 2
   - Click "Add to Tab"

5. **Verify in Customer Tab View:**
   - Tab should update instantly (real-time)
   - Total should show: R240.00 + tax

---

### **Test Scenario 3: Customer Pays**

1. **In customer tab view** (`/tab/view?tenant=X`)

2. **Select tip:**
   - Click "15%" button

3. **Click "Pay" button**

4. **Use Stripe test card:**
   - Number: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits

5. **Expected:**
   - Payment succeeds
   - Tab status changes to "closed"
   - Success message appears

6. **Verify:**
   ```sql
   SELECT status, payment_status, total FROM tabs 
   WHERE customer_phone = '+27123456789';
   ```

---

### **Test Scenario 4: Real-Time Updates**

1. **Open customer tab view in one browser**

2. **Open bartender manager in another browser**

3. **Add drink as bartender**

4. **Expected:** Customer view updates instantly without refresh

---

## 📖 Usage Workflow

### **For Customers:**

1. **Scan QR code at table**
2. **Enter name and phone**
3. **Order drinks from bartender**
4. **View live tab on phone**
5. **Pay when ready to leave**

### **For Bartenders:**

1. **Open Tab Manager** (`/staff/tabs`)
2. **Customer tells you their phone number**
3. **Select their tab**
4. **Add drinks as ordered**
5. **When customer wants to pay: Click "Ready for Payment"**

### **For Managers:**

- **View all open tabs** in real-time
- **Monitor revenue** as tabs accumulate
- **Check tab history** in transactions
- **Analyze drinking patterns** via drinks_sold table

---

## 🔥 Troubleshooting

### **Problem: QR Code doesn't work**

**Check:**
- URL format is correct: `/tab/open?tenant=X&table=Y`
- Tenant ID and Table ID are valid UUIDs
- Table exists in database

**Fix:**
```sql
SELECT id, name FROM tables WHERE tenant_id = 'your-tenant-id';
```

---

### **Problem: Customer can't see tab**

**Check:**
- Phone number entered matches exactly (including +27)
- Tab status is "open"
- Customer is on correct tenant

**Fix:**
```sql
SELECT * FROM tabs 
WHERE customer_phone = '+27123456789' 
AND status = 'open';
```

---

### **Problem: Stripe payment fails**

**Check:**
- Edge function is deployed: `npx supabase functions list`
- STRIPE_SECRET_KEY is set in Supabase secrets
- Frontend has VITE_STRIPE_PUBLISHABLE_KEY in .env

**Debug:**
```bash
# Check edge function logs
npx supabase functions logs create-payment-intent

# Test edge function directly
curl -X POST https://your-project-ref.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"tabId":"uuid","amount":10000,"customerPhone":"+27123456789"}'
```

---

### **Problem: Totals not calculating**

**Check:**
- Trigger is created: `trigger_update_tab_total_on_item_insert`
- Tax rate is set (default 15%)

**Manual recalculation:**
```sql
-- Recalculate tab total
WITH totals AS (
  SELECT 
    tab_id,
    SUM(total_price) as subtotal
  FROM tab_items
  WHERE tab_id = 'your-tab-id' 
    AND status NOT IN ('removed', 'cancelled')
  GROUP BY tab_id
)
UPDATE tabs t
SET 
  subtotal = totals.subtotal,
  tax_amount = totals.subtotal * 0.15,
  total = totals.subtotal * 1.15
FROM totals
WHERE t.id = totals.tab_id;
```

---

### **Problem: Real-time not working**

**Check:**
- Tables are added to realtime publication
- Customer/bartender are subscribed to correct channels

**Fix:**
```sql
-- Ensure realtime is enabled
ALTER PUBLICATION supabase_realtime ADD TABLE tabs;
ALTER PUBLICATION supabase_realtime ADD TABLE tab_items;

-- Verify
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('tabs', 'tab_items');
```

---

## 🔗 Integration Examples

### **Integration 1: Auto-close tabs at closing time**

```javascript
// Scheduled function to close all tabs at 2 AM
async function autoCloseTabs() {
  const { data: openTabs } = await supabase
    .from('tabs')
    .select('id, customer_name, customer_phone, total')
    .eq('status', 'open');

  for (const tab of openTabs) {
    // Send SMS notification
    await sendSMS(tab.customer_phone, 
      `Your tab at VenueName is R${tab.total}. Please pay before leaving.`
    );

    // Mark for payment
    await supabase
      .from('tabs')
      .update({ status: 'payment_pending' })
      .eq('id', tab.id);
  }
}
```

---

### **Integration 2: Email receipts after payment**

```javascript
// In CustomerTabView.jsx after successful payment
await supabase.functions.invoke('send-receipt-email', {
  body: {
    tabId: tab.tab_id,
    email: customerEmail,
    items: tabItems,
    total: totals.total,
  },
});
```

---

### **Integration 3: Loyalty points on tab payment**

```javascript
// After tab closes, award points
const pointsEarned = Math.floor(totals.total / 10); // 1 point per R10

await supabase
  .from('loyalty_transactions')
  .insert({
    tenant_id: tenantId,
    user_id: customerId,
    points: pointsEarned,
    transaction_type: 'earn',
    source: 'bar_tab',
    tab_id: tab.tab_id,
  });
```

---

### **Integration 4: Link tabs to VIP table reservations**

```javascript
// When opening tab from VIP table
async function openVIPTab(tableId, reservationId) {
  const { data: reservation } = await supabase
    .from('table_reservations')
    .select('customer_name, customer_phone')
    .eq('id', reservationId)
    .single();

  const { data: tab } = await supabase
    .from('tabs')
    .insert({
      tenant_id: tenantId,
      table_id: tableId,
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
      status: 'open',
    })
    .select()
    .single();

  // Link reservation to tab
  await supabase
    .from('table_reservations')
    .update({ tab_id: tab.id })
    .eq('id', reservationId);
}
```

---

## 📊 Analytics & Reporting

### **Daily Tab Report**

```sql
-- Get today's tab statistics
SELECT 
  COUNT(*) FILTER (WHERE status = 'open') as open_tabs,
  COUNT(*) FILTER (WHERE status = 'closed') as closed_tabs,
  SUM(total) FILTER (WHERE status = 'closed') as total_revenue,
  AVG(total) FILTER (WHERE status = 'closed') as avg_tab_size,
  COUNT(DISTINCT customer_phone) as unique_customers
FROM tabs
WHERE DATE(opened_at) = CURRENT_DATE;
```

### **Top Tables by Revenue**

```sql
-- Which tables generate most revenue?
SELECT 
  t.name as table_name,
  COUNT(tabs.id) as tabs_opened,
  SUM(tabs.total) as total_revenue,
  AVG(tabs.total) as avg_tab_size
FROM tabs
JOIN tables t ON tabs.table_id = t.id
WHERE DATE(tabs.opened_at) = CURRENT_DATE
  AND tabs.status = 'closed'
GROUP BY t.name
ORDER BY total_revenue DESC;
```

### **Average Tab Duration**

```sql
-- How long do customers keep tabs open?
SELECT 
  AVG(EXTRACT(EPOCH FROM (closed_at - opened_at)) / 60) as avg_minutes
FROM tabs
WHERE status = 'closed'
  AND DATE(opened_at) = CURRENT_DATE;
```

---

## 🎯 Success Criteria

### **System is working correctly when:**

✅ Customers can scan QR and open tabs  
✅ Bartenders can add drinks instantly  
✅ Customer tab view updates in real-time  
✅ Totals calculate automatically (with tax)  
✅ Stripe payments process successfully  
✅ Closed tabs appear in analytics  
✅ Multi-tenant isolation works (tenants only see their tabs)  
✅ Mobile experience is smooth  
✅ Tips can be added before payment  

---

## 🚀 Production Deployment

### **Before going live:**

1. **Switch to Stripe Live Keys**
   - Get production keys from Stripe dashboard
   - Update `.env` with live keys
   - Redeploy edge function with live secret

2. **Update QR Codes**
   - Replace `localhost` with production domain
   - Regenerate all QR codes

3. **Set up monitoring**
   - Enable Sentry error tracking
   - Set up alerts for failed payments
   - Monitor edge function logs

4. **Train staff**
   - Walk through bartender interface
   - Practice adding drinks
   - Explain customer payment flow

5. **Test with real devices**
   - QR scan with multiple phones
   - Test payment with real card (small amount)
   - Verify receipts and confirmations

---

## 📞 Support

**Issues?**
- Check Supabase logs: https://app.supabase.com/project/_/logs
- Check Stripe dashboard: https://dashboard.stripe.com/test/payments
- Review edge function logs: `npx supabase functions logs create-payment-intent`

**Need help?**
- Review this guide's troubleshooting section
- Check Supabase docs: https://supabase.com/docs
- Check Stripe docs: https://stripe.com/docs

---

## 🎉 You're Done!

Your Digital Bar Tabs system is now live! Customers can open tabs with QR codes, bartenders can add drinks in real-time, and payments are handled securely via Stripe.

**Next Steps:**
1. Generate QR codes for all tables
2. Train your bar staff
3. Announce the feature to customers
4. Monitor analytics to optimize

**Enjoy the revenue boost! 🍻**
