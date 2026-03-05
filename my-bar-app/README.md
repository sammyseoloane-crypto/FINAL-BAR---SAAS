# 🍹 Multi-Tenant Bar SaaS Application

## 📋 Project Overview
A complete multi-tenant bar management system built with React, Vite, and Supabase. Supports 4 user roles: **Owner**, **Admin**, **Staff**, and **Customer**.

---

## 🏗️ Technology Stack
- **Frontend**: React 19.2.4 + Vite 7.3.1
- **Routing**: React Router DOM 7.13.0
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Styling**: Custom CSS with responsive design

---

## 📁 Project Structure

```
my-bar-app/
├── public/
├── src/
│   ├── components/
│   │   ├── DashboardLayout.jsx       # Reusable layout with sidebar
│   │   ├── DashboardLayout.css       # Layout styling
│   │   └── ProtectedRoute.jsx        # Route protection with role checking
│   ├── contexts/
│   │   └── AuthContext.jsx           # Authentication state management
│   ├── pages/
│   │   ├── Auth.css                  # Auth pages styling
│   │   ├── Login.jsx                 # Login page
│   │   ├── Register.jsx              # Registration page
│   │   ├── ForgotPassword.jsx        # Password recovery
│   │   ├── ResetPassword.jsx         # Password reset
│   │   ├── Dashboard.jsx             # Main dashboard router
│   │   ├── owner/
│   │   │   ├── Pages.css             # Owner pages styling
│   │   │   ├── SubscriptionPage.jsx  # R20/6 months subscription
│   │   │   ├── LocationsPage.jsx     # Manage bar locations
│   │   │   ├── EventsPage.jsx        # Create and manage events
│   │   │   ├── StaffPage.jsx         # Staff management
│   │   │   ├── ProductsPage.jsx      # Menu items (drinks/food)
│   │   │   ├── TasksPage.jsx         # Task assignment
│   │   │   └── ReportsPage.jsx       # Analytics and reports
│   │   ├── staff/
│   │   │   ├── MyTasksPage.jsx       # View assigned tasks
│   │   │   ├── QRScannerPage.jsx     # Scan customer QR codes
│   │   │   └── PaymentsPage.jsx      # Confirm customer payments
│   │   └── customer/
│   │       ├── EventsListPage.jsx    # Browse and buy event tickets
│   │       ├── MenuPage.jsx          # View bar menu
│   │       ├── OrdersPage.jsx        # Transaction history
│   │       ├── QRCodesPage.jsx       # View active QR codes
│   │       └── ProfilePage.jsx       # Update profile
│   ├── supabaseClient.js             # Supabase configuration
│   ├── App.jsx                       # Main routing setup
│   ├── main.jsx                      # React entry point
│   └── style.css                     # Global styles
├── supabase/
│   └── migrations/
│       └── 20260217000000_initial_schema.sql  # Database schema
├── .env                              # Environment variables
├── .env.example                      # Environment template
├── index.html                        # HTML entry point
├── package.json                      # Dependencies
└── vite.config.js                    # Vite configuration
```

---

## 🗄️ Database Schema

### Tables
1. **tenants** - Multi-tenant isolation
2. **locations** - Bar locations
3. **users** - User accounts with roles
4. **products** - Menu items (drinks/food)
5. **events** - Events with entry fees
6. **tasks** - Task assignments for staff
7. **transactions** - Payments and orders
8. **qr_codes** - Entry/service QR codes

### Row Level Security (RLS)
- **Tenant Isolation**: All data is tenant-scoped
- **Role-Based Access**: Owner/Admin see all, Staff see assigned, Customers see own
- **Security**: Automatic tenant_id filtering on all queries

---

## 👥 User Roles & Features

### 🏆 Owner/Admin
- ✅ Subscription management (R20/6 months)
- ✅ Create and manage multiple locations
- ✅ Create events with entry fees
- ✅ Invite and manage staff
- ✅ Manage menu (drinks/food)
- ✅ Assign tasks to staff
- ✅ View reports and analytics

**Routes:**
- `/owner/subscription`
- `/owner/locations`
- `/owner/events`
- `/owner/staff`
- `/owner/products`
- `/owner/tasks`
- `/owner/reports`

---

### 👔 Staff
- ✅ View assigned tasks (pending/in-progress/completed)
- ✅ Scan customer QR codes for entry/service
- ✅ Confirm customer payments
- ✅ Generate QR codes after payment

**Routes:**
- `/staff/tasks`
- `/staff/scanner`
- `/staff/payments`

---

### 🎉 Customer
- ✅ Browse upcoming events
- ✅ Purchase event tickets
- ✅ View bar menu
- ✅ Place orders (drinks/food)
- ✅ View transaction history
- ✅ Access QR codes (active/used)
- ✅ Update profile information

**Routes:**
- `/customer/events`
- `/customer/menu`
- `/customer/orders`
- `/customer/qr-codes`
- `/customer/profile`

---

## 🔐 Authentication Flow

1. **Registration**: Users register with email/password
2. **Role Assignment**: Owner assigns roles to users
3. **Login**: Email/password authentication via Supabase
4. **Role-Based Redirect**: Automatic navigation to role-specific dashboard
5. **Protected Routes**: All dashboard routes require authentication

---

## 🎫 Customer Journey Flow

1. **Browse Events** → Customer sees upcoming events
2. **Purchase Entry** → Creates pending transaction
3. **Pay at Counter** → Staff confirms payment
4. **QR Code Generated** → Automatically created
5. **Show QR Code** → Staff scans for entry
6. **Mark as Used** → QR code marked as scanned

---

## 💰 Subscription Model

- **Price**: R20 per 6 months
- **Payment Method**: Bank transfer/Cash
- **Features**: 
  - Unlimited locations
  - Unlimited staff
  - Unlimited products
  - Unlimited events
  - Full analytics

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd my-bar-app
npm install
```

### 2. Configure Supabase
Update `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Database Migration
In Supabase SQL Editor, run:
```sql
-- Located at: supabase/migrations/20260217000000_initial_schema.sql
```

### 4. Start Development Server
```bash
npm run dev
```

Visit: `http://localhost:5174`

---

## 🎨 UI Features

- ✅ **Responsive Design**: Works on desktop, tablet, mobile
- ✅ **Status Badges**: Color-coded status indicators
- ✅ **Empty States**: Friendly messages when no data
- ✅ **Loading States**: Loading indicators during async operations
- ✅ **Card Layouts**: Modern card-based UI
- ✅ **Role-Specific Navigation**: Dynamic sidebar based on role
- ✅ **Priority Indicators**: Color-coded task priorities
- ✅ **Overdue Warnings**: Red indicators for late tasks

---

## 📊 Analytics & Reports (Owner)

- **Total Revenue**: Sum of confirmed transactions
- **Total Transactions**: Count of all sales
- **Active Events**: Current events
- **Total Products**: Menu items count
- **Revenue Chart**: Visual representation (placeholder)

---

## 🔧 Configuration Files

### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### package.json (key dependencies)
```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.0",
    "@supabase/supabase-js": "^2.49.4"
  },
  "devDependencies": {
    "vite": "^7.3.1",
    "@vitejs/plugin-react": "^4.3.4"
  }
}
```

---

## 🔒 Security Features

1. **Row Level Security (RLS)**: Database-level security
2. **Tenant Isolation**: Complete data separation
3. **Role-Based Access Control**: Fine-grained permissions
4. **Protected Routes**: Client-side route protection
5. **QR Code Validation**: One-time use with tenant verification
6. **Secure Authentication**: Handled by Supabase Auth

---

## 🐛 Troubleshooting

### Issue: Port already in use
**Solution**: Vite will automatically use port 5174 if 5173 is busy

### Issue: Database relation already exists
**Solution**: Migration includes `DROP TABLE IF EXISTS CASCADE`

### Issue: .env not loaded
**Solution**: Restart dev server after updating .env

### Issue: Authentication errors
**Solution**: Check Supabase URL and anon key in .env

---

## 📝 Next Steps

1. ✅ **Test the Application**: Create test users for each role
2. ✅ **Add Supabase Credentials**: Update .env file
3. ✅ **Run Database Migration**: Execute SQL in Supabase
4. ✅ **Create Owner Account**: First user should be owner
5. ✅ **Test All Features**: Verify each role's functionality

---

## 🎯 Future Enhancements (Optional)

- [ ] Real-time notifications (Supabase Realtime)
- [ ] Image uploads for products/events (Supabase Storage)
- [ ] SMS notifications (Twilio integration)
- [ ] Payment gateway integration (PayFast/Paystack)
- [ ] Advanced analytics (Charts.js)
- [ ] Mobile app (React Native)
- [ ] Email templates for invitations
- [ ] QR code generation library (qrcode.react)
- [ ] Barcode scanner (react-qr-scanner)

---

## 📞 Support

For issues or questions:
- Check the troubleshooting section
- Review Supabase documentation
- Verify all environment variables are set correctly

---

## 📄 License

This project is for educational/commercial use.

---

**Built with ❤️ using React + Vite + Supabase**
