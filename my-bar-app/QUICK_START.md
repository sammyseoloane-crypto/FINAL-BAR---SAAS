# 🚀 Quick Start Guide

## Step 1: Supabase Setup

### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Click "New Project"
3. Fill in project details:
   - Name: `bar-saas-app`
   - Database Password: (generate strong password)
   - Region: Choose closest to you
4. Wait for project to be created

### 1.2 Get API Credentials
1. Go to Project Settings → API
2. Copy the following:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`

### 1.3 Update .env File
```bash
cd my-bar-app
```

Edit `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 1.4 Run Database Migration
1. Open Supabase SQL Editor (in your project dashboard)
2. Copy entire content from: `supabase/migrations/20260217000000_initial_schema.sql`
3. Paste into SQL Editor
4. Click "Run"
5. ✅ You should see "Success" message

---

## Step 2: Start the Application

```bash
# Make sure you're in the project directory
cd my-bar-app

# Install dependencies (if not done already)
npm install

# Start development server
npm run dev
```

You should see:
```
  VITE v7.3.1  ready in 500 ms

  ➜  Local:   http://localhost:5174/
  ➜  Network: use --host to expose
```

---

## Step 3: Create Your First User

### 3.1 Register as Owner
1. Open browser: http://localhost:5174
2. Click "Create Account"
3. Fill in registration form:
   - Email: `owner@barapp.com`
   - Password: `password123` (choose strong password)
   - Full Name: `John Owner`
   - Phone: `0812345678`
   - **Role**: Select "Owner"
4. Click "Sign Up"

### 3.2 Login
1. You'll be redirected to login page
2. Enter credentials:
   - Email: `owner@barapp.com`
   - Password: (your password)
3. Click "Sign In"
4. ✅ You should be redirected to Owner Dashboard

---

## Step 4: Test Each Role

### Owner/Admin Testing
After logging in as owner, test these pages:
- ✅ Subscription → View subscription details
- ✅ Locations → Add a bar location
- ✅ Events → Create an event
- ✅ Staff → Invite staff members
- ✅ Products → Add drinks/food to menu
- ✅ Tasks → Create tasks for staff
- ✅ Reports → View analytics

### Create Staff User
1. Sign out (from Owner account)
2. Register new account with Role: "Staff"
3. Login and navigate to:
   - `/staff/tasks` → See assigned tasks
   - `/staff/scanner` → QR code scanner
   - `/staff/payments` → Payment confirmation

### Create Customer User
1. Sign out
2. Register new account with Role: "Customer"
3. Login and navigate to:
   - `/customer/events` → Browse events
   - `/customer/menu` → View menu
   - `/customer/orders` → Transaction history
   - `/customer/qr-codes` → View QR codes
   - `/customer/profile` → Update profile

---

## Step 5: Test Complete Flow

### Event Purchase Flow
1. **As Owner**: Create an event with R50 entry fee
2. **As Customer**: 
   - Login
   - Go to Events page
   - Click "Purchase Entry"
   - Note: Transaction created with "pending" status
3. **As Staff**:
   - Login
   - Go to Payments page
   - See pending transaction
   - Click "Confirm Payment"
   - QR code automatically generated
4. **As Customer**:
   - Go to "My QR Codes"
   - See your entry QR code
5. **As Staff**:
   - Go to Scanner page
   - Enter the QR code
   - Verify it's valid and marks as scanned

---

## Verification Checklist

✅ **Database Setup**
- [ ] Supabase project created
- [ ] All 8 tables created
- [ ] RLS policies enabled

✅ **Application Setup**
- [ ] Dependencies installed
- [ ] .env configured correctly
- [ ] Dev server running on http://localhost:5174

✅ **Authentication**
- [ ] Can register new users
- [ ] Can login successfully
- [ ] Can logout
- [ ] Password reset works

✅ **Owner Features**
- [ ] Can view subscription page
- [ ] Can create locations
- [ ] Can create events
- [ ] Can add products
- [ ] Can assign tasks
- [ ] Can view reports

✅ **Staff Features**
- [ ] Can view assigned tasks
- [ ] Can scan QR codes
- [ ] Can confirm payments

✅ **Customer Features**
- [ ] Can browse events
- [ ] Can view menu
- [ ] Can place orders
- [ ] Can view QR codes
- [ ] Can update profile

---

## Common Issues & Solutions

### Issue 1: "Network Error" on Login
**Cause**: .env file not configured or incorrect credentials
**Solution**: 
1. Check `.env` file exists in `my-bar-app/` directory
2. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Issue 2: Tables don't exist
**Cause**: Migration not run
**Solution**: Run the SQL migration in Supabase SQL Editor

### Issue 3: Can't see other tenant's data
**Cause**: Working as intended (RLS policies)
**Solution**: Each tenant is isolated. Register users with different tenant_ids to test multi-tenancy

### Issue 4: Port 5173 is already in use
**Cause**: Another Vite app running
**Solution**: Vite will use 5174 automatically, or kill other process

### Issue 5: "Failed to fetch user profile"
**Cause**: User record not in `users` table
**Solution**: Make sure to select a role during registration

---

## Testing Tips

1. **Use Different Browsers** for different roles:
   - Chrome: Owner
   - Firefox: Staff
   - Edge: Customer

2. **Use Incognito Windows** to test multiple users simultaneously

3. **Check Browser Console** (F12) for any errors

4. **Check Supabase Dashboard** → Table Editor to see data in real-time

5. **Use Supabase Auth** → Users to see all registered users

---

## Data Flow Example

```
Customer Action → Transaction Created (pending)
           ↓
Staff Confirms Payment
           ↓
Transaction Status → confirmed
           ↓
QR Code Auto-Generated
           ↓
Customer Views QR Code
           ↓
Staff Scans QR Code
           ↓
QR Code Marked as Scanned
```

---

## Next Steps After Setup

1. **Customize Branding**: Update colors, logos, names
2. **Add Real Payment Gateway**: Integrate PayFast/Paystack
3. **Deploy to Production**: Vercel/Netlify
4. **Configure Email Templates**: For invitations and notifications
5. **Add QR Library**: Use `qrcode.react` for visual QR codes
6. **Add Analytics**: Integrate proper charts

---

## Need Help?

1. Check the main `README.md` for detailed documentation
2. Review Supabase logs in dashboard
3. Check browser console for errors
4. Verify all environment variables
5. Ensure database migration ran successfully

---

**🎉 You're all set! Enjoy building your bar management app!**
