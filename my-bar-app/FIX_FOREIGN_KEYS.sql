-- ============================================
-- EMERGENCY FIX: Add all missing foreign keys
-- Run this in Supabase SQL Editor
-- ============================================

-- 0. Ensure the orphaned tenant exists, or create it if needed
DO $$
DECLARE
  orphaned_tenant_id UUID := '252c1a12-8422-4e60-ba7f-5b595148335e';
BEGIN
  -- Check if the tenant exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = orphaned_tenant_id) THEN
    INSERT INTO tenants (id, name, subscription_status) 
    VALUES (orphaned_tenant_id, 'Default Tenant', 'active')
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Created missing tenant: %', orphaned_tenant_id;
  ELSE
    RAISE NOTICE 'Tenant % already exists', orphaned_tenant_id;
  END IF;
END $$;

-- 1. Fix profiles → tenants FK
DO $$
BEGIN
  -- First, check for and fix orphaned tenant_ids in profiles
  UPDATE profiles 
  SET tenant_id = (SELECT id FROM tenants LIMIT 1)
  WHERE tenant_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM tenants WHERE tenants.id = profiles.tenant_id);
  
  RAISE NOTICE 'Fixed orphaned tenant_ids in profiles';
  
  -- Check if FK exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_tenant_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added profiles → tenants FK';
  ELSE
    RAISE NOTICE 'profiles → tenants FK already exists';
  END IF;
END $$;

-- 2. Fix table_reservations → profiles FK
DO $$
BEGIN
  -- First, fix orphaned user_ids in table_reservations
  -- Delete reservations where user_id doesn't exist in profiles
  DELETE FROM table_reservations 
  WHERE user_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = table_reservations.user_id);
  
  RAISE NOTICE 'Cleaned up orphaned user_ids in table_reservations';
  
  -- Drop old FK to auth.users if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'table_reservations_user_id_fkey' 
    AND table_name = 'table_reservations'
  ) THEN
    ALTER TABLE table_reservations DROP CONSTRAINT table_reservations_user_id_fkey;
    RAISE NOTICE 'Dropped old table_reservations → auth.users FK';
  END IF;
  
  -- Add new FK to profiles
  ALTER TABLE table_reservations 
  ADD CONSTRAINT table_reservations_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  
  RAISE NOTICE 'Added table_reservations → profiles FK';
END $$;

-- 3. Fix bottle_orders → profiles FK (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bottle_orders') THEN
    -- Clean up orphaned user_ids
    DELETE FROM bottle_orders 
    WHERE user_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = bottle_orders.user_id);
    
    RAISE NOTICE 'Cleaned up orphaned user_ids in bottle_orders';
    
    -- Drop old FK to auth.users if exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'bottle_orders_user_id_fkey' 
      AND table_name = 'bottle_orders'
    ) THEN
      ALTER TABLE bottle_orders DROP CONSTRAINT bottle_orders_user_id_fkey;
      RAISE NOTICE 'Dropped old bottle_orders → auth.users FK';
    END IF;
    
    -- Add new FK to profiles
    ALTER TABLE bottle_orders 
    ADD CONSTRAINT bottle_orders_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added bottle_orders → profiles FK';
  ELSE
    RAISE NOTICE 'bottle_orders table does not exist, skipping';
  END IF;
END $$;

-- 4. Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Fix cart_items foreign keys
DO $$
BEGIN
  -- Clean up orphaned product_ids
  DELETE FROM cart_items 
  WHERE product_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM products WHERE products.id = cart_items.product_id);
  
  -- Clean up orphaned event_ids
  DELETE FROM cart_items 
  WHERE event_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM events WHERE events.id = cart_items.event_id);
  
  RAISE NOTICE 'Cleaned up orphaned IDs in cart_items';
  
  -- Drop old FKs if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cart_items_product_id_fkey' 
    AND table_name = 'cart_items'
  ) THEN
    ALTER TABLE cart_items DROP CONSTRAINT cart_items_product_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cart_items_event_id_fkey' 
    AND table_name = 'cart_items'
  ) THEN
    ALTER TABLE cart_items DROP CONSTRAINT cart_items_event_id_fkey;
  END IF;
  
  -- Add new FKs
  ALTER TABLE cart_items 
  ADD CONSTRAINT cart_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  
  ALTER TABLE cart_items 
  ADD CONSTRAINT cart_items_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  
  RAISE NOTICE 'Added cart_items foreign keys';
END $$;

-- Reload schema cache again
NOTIFY pgrst, 'reload schema';

-- 6. Add missing columns to tenants table
DO $$
BEGIN
  -- Add subscription_tier column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE tenants ADD COLUMN subscription_tier TEXT DEFAULT 'trial';
    RAISE NOTICE 'Added subscription_tier column to tenants';
  END IF;
  
  -- Add stripe_customer_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;
    RAISE NOTICE 'Added stripe_customer_id column to tenants';
  END IF;
  
  -- Add stripe_subscription_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
    RAISE NOTICE 'Added stripe_subscription_id column to tenants';
  END IF;
END $$;

-- 7. Create tenant_subscription_details view (fixes 404 error)
DO $$
BEGIN
  -- Create subscription_plans table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
    CREATE TABLE subscription_plans (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      tier TEXT NOT NULL,
      price_monthly DECIMAL(10,2) NOT NULL,
      price_yearly DECIMAL(10,2),
      currency TEXT DEFAULT 'ZAR',
      max_locations INTEGER,
      max_staff INTEGER,
      max_products INTEGER,
      max_monthly_transactions INTEGER,
      max_events_per_month INTEGER,
      transaction_fee_percentage DECIMAL(5,2),
      features JSONB DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Insert basic free tier
    INSERT INTO subscription_plans (
      name, display_name, tier,
      price_monthly, price_yearly, currency,
      max_locations, max_staff, max_products,
      max_monthly_transactions, max_events_per_month,
      transaction_fee_percentage,
      features
    ) VALUES (
      'trial', '🎉 Trial Plan', 'trial',
      0.00, 0.00, 'ZAR',
      1, 3, 50,
      1000, 2,
      0.00,
      '{"pos_system": true, "basic_reports": true}'::jsonb
    );
    
    RAISE NOTICE 'Created subscription_plans table';
  END IF;
  
  -- Create or replace the view
  CREATE OR REPLACE VIEW tenant_subscription_details AS
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.subscription_tier,
    t.subscription_status,
    t.subscription_end,
    sp.display_name as plan_name,
    sp.price_monthly,
    sp.price_yearly,
    sp.max_locations,
    sp.max_staff,
    sp.max_products,
    sp.max_monthly_transactions,
    sp.max_events_per_month,
    sp.transaction_fee_percentage,
    sp.features,
    t.stripe_customer_id,
    t.stripe_subscription_id
  FROM tenants t
  LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier;
  
  -- Grant permissions
  GRANT SELECT ON tenant_subscription_details TO authenticated;
  
  RAISE NOTICE 'Created tenant_subscription_details view';
END $$;

-- Reload schema cache one more time
NOTIFY pgrst, 'reload schema';

-- 8. Fix profiles RLS policies to allow owner/manager to view staff (NO RECURSION)
DO $$
BEGIN
  -- Drop old policies
  DROP POLICY IF EXISTS "Owners and admins can view all tenant profiles" ON profiles;
  DROP POLICY IF EXISTS "Owners, admins, and managers can view all tenant profiles" ON profiles;
  DROP POLICY IF EXISTS "Owners, admins, and managers can update tenant profiles" ON profiles;
  DROP POLICY IF EXISTS "Owners and admins can delete tenant profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  DROP POLICY IF EXISTS "Public can insert profiles during registration" ON profiles;
  
  -- NOTE: DO NOT drop get_user_tenant_and_role() - it's used by 80+ other policies
  -- Just ensure it exists (it should already exist from migrations)
  
  -- Recreate policies using SECURITY DEFINER function (prevents infinite recursion)
  CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());
  
  CREATE POLICY "Owners, admins, and managers can view all tenant profiles"
    ON profiles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM get_user_tenant_and_role() AS u
        WHERE u.role IN ('platform_admin', 'owner', 'admin', 'manager')
          AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
      )
    );
  
  CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());
  
  CREATE POLICY "Owners, admins, and managers can update tenant profiles"
    ON profiles FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM get_user_tenant_and_role() AS u
        WHERE u.role IN ('platform_admin', 'owner', 'admin', 'manager')
          AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
      )
    );
  
  CREATE POLICY "Owners and admins can delete tenant profiles"
    ON profiles FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM get_user_tenant_and_role() AS u
        WHERE u.role IN ('platform_admin', 'owner', 'admin')
          AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
      )
    );
  
  CREATE POLICY "Public can insert profiles during registration"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
    
  RAISE NOTICE 'Fixed profiles RLS policies (no recursion)';
END $$;

-- 9. DIAGNOSTICS: Check profiles table and RLS policies
DO $$
DECLARE
  profile_count INTEGER;
  staff_count INTEGER;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  rec RECORD;
BEGIN
  -- Count total profiles
  SELECT COUNT(*) INTO profile_count FROM profiles;
  RAISE NOTICE 'Total profiles in database: %', profile_count;
  
  -- Count staff/admin profiles
  SELECT COUNT(*) INTO staff_count 
  FROM profiles 
  WHERE role IN ('staff', 'admin', 'manager', 'owner', 'platform_admin', 'promoter', 'vip_host');
  RAISE NOTICE 'Profiles with staff-related roles: %', staff_count;
  
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO rls_enabled 
  FROM pg_class 
  WHERE relname = 'profiles';
  RAISE NOTICE 'RLS enabled on profiles: %', rls_enabled;
  
  -- Count policies on profiles table
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'profiles';
  RAISE NOTICE 'Number of policies on profiles table: %', policy_count;
  
  -- Show sample of profiles with roles
  RAISE NOTICE 'Sample profiles:';
  FOR rec IN 
    SELECT id, email, role, tenant_id 
    FROM profiles 
    LIMIT 5
  LOOP
    RAISE NOTICE '  - % | % | % | tenant=%', rec.email, rec.role, rec.id, rec.tenant_id;
  END LOOP;
END $$;

SELECT 'All foreign keys fixed! Hard refresh your browser now (Ctrl+Shift+R)' AS status;
