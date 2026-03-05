# Supabase Database Schema

## Overview
This folder contains the database schema and migrations for the Multi-Tenant Bar SaaS application.

## Database Structure

### Core Tables

1. **tenants** - Stores tenant/business information
   - Manages subscription status
   - Root table for multi-tenancy

2. **locations** - Multiple bar locations per tenant
   - Each tenant can have multiple locations
   - Tied to tenant via foreign key

3. **users** - User authentication and roles
   - Roles: owner, admin, staff, customer
   - Scoped to tenant (except customers can be cross-tenant)

4. **products** - Drinks and food items
   - Tenant and location-specific
   - Supports special items and pricing

5. **events** - Bar events with entry fees
   - Filtered by date and active status
   - Location-specific

6. **tasks** - Staff task management
   - Priority and status tracking
   - Assignment to specific users

7. **transactions** - Purchase transactions
   - QR code payment workflow
   - Confirmation tracking

8. **qr_codes** - QR codes for transactions
   - Unique codes per transaction
   - Scan tracking

### Views

- **reports** - Aggregated transaction data for reporting

## Row Level Security (RLS)

All tables have RLS enabled with policies based on:
- User role (owner/admin/staff/customer)
- Tenant isolation (users only see their tenant's data)
- Resource ownership (users can manage their own records)

## Setup Instructions

### Local Development with Supabase CLI

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Initialize Supabase in project**
   ```bash
   supabase init
   ```

4. **Start local Supabase**
   ```bash
   supabase start
   ```

5. **Apply migrations**
   ```bash
   supabase db reset
   ```

### Production Deployment

1. **Link to your Supabase project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Push migrations to production**
   ```bash
   supabase db push
   ```

## Environment Variables

Add these to your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Migration Files

- `20260217000000_initial_schema.sql` - Initial database schema with all tables, indexes, triggers, and RLS policies

## Key Features

- **Multi-tenancy**: All data is scoped to tenants with proper isolation
- **Role-based access**: Different permissions for owners, admins, staff, and customers
- **Automatic timestamps**: `created_at` and `updated_at` fields with triggers
- **Data integrity**: Foreign key constraints and check constraints
- **Performance**: Strategic indexes on frequently queried columns
- **Security**: Row Level Security policies for data isolation

## Future Enhancements

- Add audit logging table
- Implement soft deletes
- Add inventory tracking
- Analytics and dashboard views
- Payment integration tables
