-- Migration: Add profiles table linked to Supabase Auth
-- Date: 2026-03-03
-- Description: Create profiles table that syncs with auth.users and replace custom users table

-- Create profiles table (references auth.users, not custom users table)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'customer')) DEFAULT 'customer',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Helper function to get user profile with tenant and role (must be defined before policies)
CREATE OR REPLACE FUNCTION get_user_tenant_and_role()
RETURNS TABLE (tenant_id UUID, role VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT p.tenant_id, p.role
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Owners and admins can view all tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Staff can view profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Owners and admins can update tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Public can insert profiles during registration" ON profiles;
DROP POLICY IF EXISTS "Owners and admins can delete tenant profiles" ON profiles;

-- RLS Policies for profiles (use helper function to avoid infinite recursion)
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Owners and admins can view all tenant profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = profiles.tenant_id
    )
  );

CREATE POLICY "Staff can view profiles in their tenant"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role = 'staff' AND u.tenant_id = profiles.tenant_id
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Owners and admins can update tenant profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = profiles.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = profiles.tenant_id
    )
  );

CREATE POLICY "Public can insert profiles during registration"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Owners and admins can delete tenant profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = profiles.tenant_id
    )
  );

-- Function to automatically create profile when auth.users entry is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update trigger for profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
