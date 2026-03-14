-- Quick Fix: Update check_usage_limit to use subscription_plans table
-- Run this directly in Supabase SQL Editor to fix the error

-- Drop and recreate the function with correct joins
DROP FUNCTION IF EXISTS check_usage_limit(UUID, TEXT);

CREATE OR REPLACE FUNCTION check_usage_limit(
  p_tenant_id UUID,
  p_limit_type TEXT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_current_count INTEGER;
  v_max_limit INTEGER;
  v_tier VARCHAR(50);
BEGIN
  -- Get tenant tier
  SELECT subscription_tier INTO v_tier
  FROM tenants
  WHERE id = p_tenant_id;
  
  -- Check different limit types
  CASE p_limit_type
    WHEN 'staff' THEN
      SELECT COUNT(*), sp.max_staff
      INTO v_current_count, v_max_limit
      FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      JOIN subscription_plans sp ON sp.tier = t.subscription_tier
      WHERE p.tenant_id = p_tenant_id 
        AND p.role IN ('staff', 'admin', 'owner', 'manager', 'promoter', 'vip_host')
      GROUP BY sp.max_staff;
      
    WHEN 'locations' THEN
      SELECT COUNT(*), sp.max_locations
      INTO v_current_count, v_max_limit
      FROM locations l
      JOIN tenants t ON t.id = l.tenant_id
      JOIN subscription_plans sp ON sp.tier = t.subscription_tier
      WHERE l.tenant_id = p_tenant_id
      GROUP BY sp.max_locations;
      
    WHEN 'products' THEN
      SELECT COUNT(*), sp.max_products
      INTO v_current_count, v_max_limit
      FROM products pr
      JOIN tenants t ON t.id = pr.tenant_id
      JOIN subscription_plans sp ON sp.tier = t.subscription_tier
      WHERE pr.tenant_id = p_tenant_id
      GROUP BY sp.max_products;
      
    WHEN 'events' THEN
      SELECT COUNT(*), sp.max_events_per_month
      INTO v_current_count, v_max_limit
      FROM events e
      JOIN tenants t ON t.id = e.tenant_id
      JOIN subscription_plans sp ON sp.tier = t.subscription_tier
      WHERE e.tenant_id = p_tenant_id
        AND e.date >= DATE_TRUNC('month', CURRENT_DATE)
        AND e.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY sp.max_events_per_month;
      
    ELSE
      v_current_count := 0;
      v_max_limit := 0;
  END CASE;
  
  -- If no records found, set current count to 0 and get the limit separately
  IF v_current_count IS NULL THEN
    v_current_count := 0;
    
    -- Get the limit even when count is 0
    CASE p_limit_type
      WHEN 'staff' THEN
        SELECT sp.max_staff INTO v_max_limit
        FROM tenants t
        JOIN subscription_plans sp ON sp.tier = t.subscription_tier
        WHERE t.id = p_tenant_id;
        
      WHEN 'locations' THEN
        SELECT sp.max_locations INTO v_max_limit
        FROM tenants t
        JOIN subscription_plans sp ON sp.tier = t.subscription_tier
        WHERE t.id = p_tenant_id;
        
      WHEN 'products' THEN
        SELECT sp.max_products INTO v_max_limit
        FROM tenants t
        JOIN subscription_plans sp ON sp.tier = t.subscription_tier
        WHERE t.id = p_tenant_id;
        
      WHEN 'events' THEN
        SELECT sp.max_events_per_month INTO v_max_limit
        FROM tenants t
        JOIN subscription_plans sp ON sp.tier = t.subscription_tier
        WHERE t.id = p_tenant_id;
    END CASE;
  END IF;
  
  -- Ensure we have a valid max_limit
  v_max_limit := COALESCE(v_max_limit, 0);
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'limit_type', p_limit_type,
    'current', v_current_count,
    'max', v_max_limit,
    'remaining', GREATEST(0, v_max_limit - v_current_count),
    'is_at_limit', v_current_count >= v_max_limit,
    'tier', v_tier
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_usage_limit(UUID, TEXT) TO authenticated;
