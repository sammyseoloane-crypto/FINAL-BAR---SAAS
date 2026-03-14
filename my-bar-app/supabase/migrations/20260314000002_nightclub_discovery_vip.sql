-- ============================================================
-- NIGHTCLUB MANAGEMENT SYSTEM - PART 3
-- Club Discovery, VIP System, Analytics
-- Created: 2026-03-14
-- ============================================================

-- Enable required extensions for geospatial queries
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ============================================================
-- PHASE 8: CLUB DISCOVERY PLATFORM
-- ============================================================

-- Clubs (Venues/Locations with extended nightlife features)
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Club details
  club_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  tagline VARCHAR(255),
  
  -- Type & Category
  club_type VARCHAR(50) DEFAULT 'nightclub', -- 'nightclub', 'lounge', 'bar', 'rooftop', 'beach_club'
  music_genres JSONB DEFAULT '[]', -- ["EDM", "Hip Hop", "House"]
  vibe_tags JSONB DEFAULT '[]', -- ["Upscale", "Casual", "LGBTQ+ Friendly"]
  
  -- Contact & Location
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'South Africa',
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Contact details
  phone VARCHAR(20),
  email VARCHAR(255),
  website_url TEXT,
  booking_url TEXT,
  
  -- Social media
  instagram_handle VARCHAR(100),
  facebook_url TEXT,
  tiktok_handle VARCHAR(100),
  twitter_handle VARCHAR(100),
  
  -- Operating hours
  operating_hours JSONB, -- {"monday": {"open": "21:00", "close": "04:00"}, ...}
  typical_wait_time INTEGER, -- minutes
  
  -- Capacity & Pricing
  capacity INTEGER,
  average_cover_charge DECIMAL(10, 2),
  average_drink_price DECIMAL(10, 2),
  dress_code VARCHAR(100),
  age_restriction INTEGER DEFAULT 18,
  
  -- Features
  has_vip_tables BOOLEAN DEFAULT FALSE,
  has_bottle_service BOOLEAN DEFAULT FALSE,
  has_guest_list BOOLEAN DEFAULT FALSE,
  has_parking BOOLEAN DEFAULT FALSE,
  has_outdoor_area BOOLEAN DEFAULT FALSE,
  has_dance_floor BOOLEAN DEFAULT TRUE,
  has_live_music BOOLEAN DEFAULT FALSE,
  has_dj BOOLEAN DEFAULT TRUE,
  
  -- Media
  logo_url TEXT,
  cover_photo_url TEXT,
  photos JSONB DEFAULT '[]',
  video_url TEXT,
  
  -- Ratings & Popularity
  rating DECIMAL(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  check_in_count INTEGER DEFAULT 0,
  popularity_score INTEGER DEFAULT 0,
  
  -- Status
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'temporarily_closed', 'permanently_closed'
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  keywords JSONB DEFAULT '[]',
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_clubs_tenant ON clubs(tenant_id);
CREATE INDEX idx_clubs_slug ON clubs(slug);
CREATE INDEX idx_clubs_city ON clubs(city);
CREATE INDEX idx_clubs_type ON clubs(club_type);
CREATE INDEX idx_clubs_active ON clubs(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_clubs_featured ON clubs(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_clubs_rating ON clubs(rating DESC);
CREATE INDEX idx_clubs_popularity ON clubs(popularity_score DESC);
CREATE INDEX idx_clubs_location ON clubs USING gist(ll_to_earth(latitude, longitude)) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Club Followers
CREATE TABLE IF NOT EXISTS club_followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preferences
  notifications_enabled BOOLEAN DEFAULT TRUE,
  favorite BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_notification_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_club_followers_club ON club_followers(club_id);
CREATE INDEX idx_club_followers_user ON club_followers(user_id);
CREATE INDEX idx_club_followers_favorite ON club_followers(user_id, favorite) WHERE favorite = TRUE;

-- Club Check-ins
CREATE TABLE IF NOT EXISTS club_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Check-in details
  checkin_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  checkout_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  -- Experience
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  photos JSONB DEFAULT '[]',
  
  -- Visibility
  visibility VARCHAR(50) DEFAULT 'public', -- 'public', 'friends', 'private'
  
  -- Engagement
  likes_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_club_checkins_club ON club_checkins(club_id);
CREATE INDEX idx_club_checkins_user ON club_checkins(user_id);
CREATE INDEX idx_club_checkins_event ON club_checkins(event_id);
CREATE INDEX idx_club_checkins_time ON club_checkins(checkin_time DESC);

-- ============================================================
-- PHASE 9: VIP CUSTOMER SYSTEM
-- ============================================================

-- VIP Levels (tiers)
CREATE TABLE IF NOT EXISTS vip_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Level details
  level_name VARCHAR(100) NOT NULL, -- 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'
  level_rank INTEGER NOT NULL, -- 1, 2, 3, 4, 5 (higher = better)
  color_code VARCHAR(7), -- '#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF'
  icon_url TEXT,
  
  -- Requirements
  min_visits INTEGER DEFAULT 0,
  min_spend DECIMAL(15, 2) DEFAULT 0,
  min_points INTEGER DEFAULT 0,
  time_period_months INTEGER DEFAULT 12, -- Rolling 12 months
  
  -- Benefits
  benefits JSONB DEFAULT '[]', -- ["Priority Entry", "10% Discount", "Free Birthday Bottle"]
  priority_entry BOOLEAN DEFAULT FALSE,
  skip_cover_charge BOOLEAN DEFAULT FALSE,
  cover_charge_discount_percent DECIMAL(5, 2) DEFAULT 0,
  drink_discount_percent DECIMAL(5, 2) DEFAULT 0,
  food_discount_percent DECIMAL(5, 2) DEFAULT 0,
  bottle_service_discount_percent DECIMAL(5, 2) DEFAULT 0,
  
  -- Perks
  free_drinks_per_visit INTEGER DEFAULT 0,
  priority_table_booking BOOLEAN DEFAULT FALSE,
  table_booking_discount_percent DECIMAL(5, 2) DEFAULT 0,
  dedicated_host BOOLEAN DEFAULT FALSE,
  vip_parking BOOLEAN DEFAULT FALSE,
  exclusive_events_access BOOLEAN DEFAULT FALSE,
  birthday_bonus BOOLEAN DEFAULT FALSE,
  
  -- Limits
  max_members INTEGER,
  current_member_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_visible BOOLEAN DEFAULT TRUE,
  
  -- Display
  description TEXT,
  badge_image_url TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_vip_levels_tenant ON vip_levels(tenant_id);
CREATE INDEX idx_vip_levels_rank ON vip_levels(level_rank);
CREATE INDEX idx_vip_levels_active ON vip_levels(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX idx_vip_levels_tenant_rank ON vip_levels(tenant_id, level_rank);

-- Customer VIP Status
CREATE TABLE IF NOT EXISTS customer_vip_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vip_level_id UUID NOT NULL REFERENCES vip_levels(id) ON DELETE CASCADE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'suspended', 'downgraded'
  
  -- Qualification metrics
  total_visits INTEGER DEFAULT 0,
  total_spend DECIMAL(15, 2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  
  -- Dates
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_visit_date DATE,
  
  -- Tracking
  benefits_used_count INTEGER DEFAULT 0,
  benefits_value_saved DECIMAL(10, 2) DEFAULT 0,
  
  -- Notes
  notes TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_customer_vip_status_tenant ON customer_vip_status(tenant_id);
CREATE INDEX idx_customer_vip_status_user ON customer_vip_status(user_id);
CREATE INDEX idx_customer_vip_status_level ON customer_vip_status(vip_level_id);
CREATE INDEX idx_customer_vip_status_active ON customer_vip_status(status) WHERE status = 'active';

-- VIP Benefits Usage Log
CREATE TABLE IF NOT EXISTS vip_benefits_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_vip_status_id UUID NOT NULL REFERENCES customer_vip_status(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Benefit details
  benefit_type VARCHAR(100) NOT NULL, -- 'free_drink', 'discount', 'priority_entry', 'table_upgrade'
  benefit_description TEXT,
  
  -- Value
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  original_price DECIMAL(10, 2),
  final_price DECIMAL(10, 2),
  
  -- Context
  used_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  transaction_id UUID REFERENCES transactions(id),
  event_id UUID REFERENCES events(id),
  
  -- Staff
  authorized_by UUID REFERENCES auth.users(id),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_vip_benefits_usage_tenant ON vip_benefits_usage(tenant_id);
CREATE INDEX idx_vip_benefits_usage_status ON vip_benefits_usage(customer_vip_status_id);
CREATE INDEX idx_vip_benefits_usage_user ON vip_benefits_usage(user_id);
CREATE INDEX idx_vip_benefits_usage_date ON vip_benefits_usage(used_at DESC);

-- ============================================================
-- PHASE 10: TABLE LAYOUT & VISUALIZATION
-- ============================================================

-- Floor Plans
CREATE TABLE IF NOT EXISTS floor_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  
  -- Plan details
  plan_name VARCHAR(255) NOT NULL,
  floor_level INTEGER DEFAULT 1,
  
  -- Layout
  layout_width INTEGER NOT NULL, -- Grid width (e.g., 100 units)
  layout_height INTEGER NOT NULL, -- Grid height (e.g., 100 units)
  grid_size INTEGER DEFAULT 10, -- Size of each grid cell
  
  -- Background
  background_image_url TEXT,
  background_color VARCHAR(7) DEFAULT '#1a1a1a',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Elements (tables, bars, dance floors, etc.)
  elements JSONB DEFAULT '[]', -- [{"type": "table", "id": "...", "x": 10, "y": 20, "width": 4, "height": 4}]
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_floor_plans_tenant ON floor_plans(tenant_id);
CREATE INDEX idx_floor_plans_location ON floor_plans(location_id);
CREATE INDEX idx_floor_plans_active ON floor_plans(is_active) WHERE is_active = TRUE;

-- ============================================================
-- PHASE 11: NIGHTCLUB OPERATIONS ANALYTICS
-- ============================================================

-- Live Venue Metrics (real-time snapshot)
CREATE TABLE IF NOT EXISTS venue_live_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Timestamp
  snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Crowd metrics
  current_occupancy INTEGER DEFAULT 0,
  max_capacity INTEGER,
  occupancy_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Financial (current shift/event)
  revenue_current_period DECIMAL(15, 2) DEFAULT 0,
  revenue_last_hour DECIMAL(15, 2) DEFAULT 0,
  average_transaction_value DECIMAL(10, 2) DEFAULT 0,
  
  -- Activity
  active_tables INTEGER DEFAULT 0,
  active_bar_tabs INTEGER DEFAULT 0,
  pending_bottle_orders INTEGER DEFAULT 0,
  guest_list_checkins INTEGER DEFAULT 0,
  
  -- Wait times
  average_bar_wait_minutes INTEGER DEFAULT 0,
  average_entry_wait_minutes INTEGER DEFAULT 0,
  
  -- Staff
  staff_on_duty INTEGER DEFAULT 0,
  bartenders_active INTEGER DEFAULT 0,
  
  -- Popular items
  top_selling_product_id UUID REFERENCES products(id),
  top_selling_product_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_venue_live_metrics_tenant ON venue_live_metrics(tenant_id);
CREATE INDEX idx_venue_live_metrics_location ON venue_live_metrics(location_id);
CREATE INDEX idx_venue_live_metrics_event ON venue_live_metrics(event_id);
CREATE INDEX idx_venue_live_metrics_time ON venue_live_metrics(snapshot_time DESC);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vip_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_benefits_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_live_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Clubs: Public read, staff manage
CREATE POLICY clubs_read ON clubs
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY clubs_manage ON clubs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Club Followers: Public read, users manage own
CREATE POLICY club_followers_read ON club_followers
  FOR SELECT
  USING (TRUE);

CREATE POLICY club_followers_manage ON club_followers
  FOR ALL
  USING (user_id = auth.uid());

-- Club Check-ins: Public read based on visibility
CREATE POLICY club_checkins_read ON club_checkins
  FOR SELECT
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM profile_followers
        WHERE following_id = club_checkins.user_id
        AND follower_id = auth.uid()
      )
    )
  );

CREATE POLICY club_checkins_manage ON club_checkins
  FOR ALL
  USING (user_id = auth.uid());

-- VIP Levels: Everyone can read, staff manage
CREATE POLICY vip_levels_read ON vip_levels
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND is_visible = TRUE
  );

CREATE POLICY vip_levels_manage ON vip_levels
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Customer VIP Status: User sees own, staff see all
CREATE POLICY customer_vip_status_tenant_isolation ON customer_vip_status
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- VIP Benefits Usage: User sees own, staff see all
CREATE POLICY vip_benefits_usage_tenant_isolation ON vip_benefits_usage
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Floor Plans: Tenant access
CREATE POLICY floor_plans_tenant_isolation ON floor_plans
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Venue Live Metrics: Tenant access
CREATE POLICY venue_live_metrics_tenant_isolation ON venue_live_metrics
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Update club follower count
CREATE OR REPLACE FUNCTION update_club_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clubs
    SET follower_count = follower_count + 1
    WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clubs
    SET follower_count = follower_count - 1
    WHERE id = OLD.club_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER club_followers_update_count
  AFTER INSERT OR DELETE ON club_followers
  FOR EACH ROW EXECUTE FUNCTION update_club_follower_count();

-- Update club check-in count
CREATE OR REPLACE FUNCTION update_club_checkin_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clubs
  SET check_in_count = check_in_count + 1
  WHERE id = NEW.club_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER club_checkins_update_count
  AFTER INSERT ON club_checkins
  FOR EACH ROW EXECUTE FUNCTION update_club_checkin_count();

-- Update VIP level member count
CREATE OR REPLACE FUNCTION update_vip_level_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE vip_levels
    SET current_member_count = current_member_count + 1
    WHERE id = NEW.vip_level_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.vip_level_id IS DISTINCT FROM NEW.vip_level_id THEN
    UPDATE vip_levels
    SET current_member_count = current_member_count - 1
    WHERE id = OLD.vip_level_id;
    UPDATE vip_levels
    SET current_member_count = current_member_count + 1
    WHERE id = NEW.vip_level_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE vip_levels
    SET current_member_count = current_member_count - 1
    WHERE id = OLD.vip_level_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_vip_status_update_count
  AFTER INSERT OR UPDATE OF vip_level_id OR DELETE ON customer_vip_status
  FOR EACH ROW EXECUTE FUNCTION update_vip_level_count();

-- Update timestamps
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER vip_levels_updated_at BEFORE UPDATE ON vip_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER customer_vip_status_updated_at BEFORE UPDATE ON customer_vip_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER floor_plans_updated_at BEFORE UPDATE ON floor_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
