-- Migration: Fix check_usage_limit function - correct column name
-- Date: 2026-03-14
-- Description: Fix e.event_date to e.date in check_usage_limit function

-- Recreate function with correct column name
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
      SELECT COUNT(*), t.max_staff
      INTO v_current_count, v_max_limit
      FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.tenant_id = p_tenant_id 
        AND p.role IN ('staff', 'admin', 'owner', 'manager', 'promoter', 'vip_host')
      GROUP BY t.max_staff;
      
    WHEN 'locations' THEN
      SELECT COUNT(*), t.max_locations
      INTO v_current_count, v_max_limit
      FROM locations l
      JOIN tenants t ON t.id = l.tenant_id
      WHERE l.tenant_id = p_tenant_id
      GROUP BY t.max_locations;
      
    WHEN 'products' THEN
      SELECT COUNT(*), t.max_products
      INTO v_current_count, v_max_limit
      FROM products pr
      JOIN tenants t ON t.id = pr.tenant_id
      WHERE pr.tenant_id = p_tenant_id
      GROUP BY t.max_products;
      
    WHEN 'events' THEN
      SELECT COUNT(*), t.max_events_per_month
      INTO v_current_count, v_max_limit
      FROM events e
      JOIN tenants t ON t.id = e.tenant_id
      WHERE e.tenant_id = p_tenant_id
        AND e.date >= DATE_TRUNC('month', CURRENT_DATE)
        AND e.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY t.max_events_per_month;
      
    ELSE
      v_current_count := 0;
      v_max_limit := 0;
  END CASE;
  
  -- If no records found, set current count to 0
  v_current_count := COALESCE(v_current_count, 0);
  
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
