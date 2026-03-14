-- ============================================================
-- NIGHTCLUB MANAGEMENT SYSTEM - PART 2
-- Guest Lists, Promoters, Social Profiles
-- Created: 2026-03-14
-- ============================================================

-- ============================================================
-- PHASE 4: NIGHTCLUB GUEST LIST SYSTEM
-- ============================================================

-- Guest Lists (per event/night)
CREATE TABLE IF NOT EXISTS guest_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  promoter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- List details
  list_name VARCHAR(255) NOT NULL,
  list_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'vip', 'industry', 'comp'
  
  -- Date/time
  event_date DATE NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- Capacity
  max_guests INTEGER,
  current_guest_count INTEGER DEFAULT 0,
  checked_in_count INTEGER DEFAULT 0,
  
  -- Benefits
  cover_charge_waived BOOLEAN DEFAULT FALSE,
  free_drinks_count INTEGER DEFAULT 0,
  priority_entry BOOLEAN DEFAULT FALSE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'closed', 'full'
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Notes
  description TEXT,
  internal_notes TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_guest_lists_tenant ON guest_lists(tenant_id);
CREATE INDEX idx_guest_lists_event ON guest_lists(event_id);
CREATE INDEX idx_guest_lists_promoter ON guest_lists(promoter_id);
CREATE INDEX idx_guest_lists_date ON guest_lists(event_date);
CREATE INDEX idx_guest_lists_active ON guest_lists(is_active) WHERE is_active = TRUE;

-- Guest List Entries (individual guests)
CREATE TABLE IF NOT EXISTS guest_list_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_list_id UUID NOT NULL REFERENCES guest_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Guest details
  guest_name VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(20),
  guest_email VARCHAR(255),
  
  -- Party size
  plus_ones INTEGER DEFAULT 0,
  total_party_size INTEGER DEFAULT 1,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'declined', 'checked_in', 'no_show', 'removed'
  
  -- Check-in
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES auth.users(id),
  actual_party_size INTEGER,
  
  -- RSVP
  rsvp_status VARCHAR(50), -- 'yes', 'no', 'maybe'
  rsvp_at TIMESTAMP WITH TIME ZONE,
  
  -- Special attributes
  is_vip BOOLEAN DEFAULT FALSE,
  is_birthday BOOLEAN DEFAULT FALSE,
  table_assigned UUID REFERENCES tables(id),
  
  -- Notes
  notes TEXT,
  staff_notes TEXT,
  
  -- Notifications
  invitation_sent BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_guest_list_entries_tenant ON guest_list_entries(tenant_id);
CREATE INDEX idx_guest_list_entries_list ON guest_list_entries(guest_list_id);
CREATE INDEX idx_guest_list_entries_user ON guest_list_entries(user_id);
CREATE INDEX idx_guest_list_entries_status ON guest_list_entries(status);
CREATE INDEX idx_guest_list_entries_phone ON guest_list_entries(guest_phone) WHERE guest_phone IS NOT NULL;
CREATE INDEX idx_guest_list_entries_checked_in ON guest_list_entries(checked_in) WHERE checked_in = TRUE;

-- ============================================================
-- PHASE 5: PROMOTER MANAGEMENT
-- ============================================================

-- Promoters
CREATE TABLE IF NOT EXISTS promoters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Promoter details
  promoter_code VARCHAR(50) UNIQUE NOT NULL,
  stage_name VARCHAR(255),
  bio TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Commission structure
  commission_rate DECIMAL(5, 2) DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_type VARCHAR(50) DEFAULT 'percentage', -- 'percentage', 'fixed', 'tiered'
  base_commission DECIMAL(10, 2) DEFAULT 0,
  
  -- Performance metrics
  total_guests INTEGER DEFAULT 0,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  total_commissions_earned DECIMAL(15, 2) DEFAULT 0,
  total_commissions_paid DECIMAL(15, 2) DEFAULT 0,
  average_party_size DECIMAL(4, 2) DEFAULT 0,
  
  -- Ratings
  rating DECIMAL(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER DEFAULT 0,
  
  -- Capacity limits
  max_guests_per_night INTEGER,
  max_guest_lists INTEGER,
  
  -- Contact
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  instagram_handle VARCHAR(100),
  
  -- Banking (for payouts)
  payout_method VARCHAR(50) DEFAULT 'bank_transfer',
  bank_account_details JSONB,
  
  -- Dates
  hired_date DATE,
  last_payout_date DATE,
  
  -- Photos
  profile_photo_url TEXT,
  cover_photo_url TEXT,
  
  -- Settings
  can_create_guest_lists BOOLEAN DEFAULT TRUE,
  can_edit_guest_lists BOOLEAN DEFAULT TRUE,
  auto_approve_guests BOOLEAN DEFAULT FALSE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_promoters_tenant ON promoters(tenant_id);
CREATE INDEX idx_promoters_user ON promoters(user_id);
CREATE INDEX idx_promoters_code ON promoters(promoter_code);
CREATE INDEX idx_promoters_status ON promoters(status);
CREATE UNIQUE INDEX idx_promoters_tenant_user ON promoters(tenant_id, user_id);

-- Promoter Commissions
CREATE TABLE IF NOT EXISTS promoter_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL REFERENCES promoters(id) ON DELETE CASCADE,
  guest_list_id UUID REFERENCES guest_lists(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Commission details
  commission_date DATE NOT NULL,
  guest_count INTEGER NOT NULL,
  revenue_generated DECIMAL(15, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  
  -- Payout
  payout_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'disputed'
  payout_date DATE,
  payout_reference VARCHAR(255),
  
  -- Notes
  notes TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_promoter_commissions_tenant ON promoter_commissions(tenant_id);
CREATE INDEX idx_promoter_commissions_promoter ON promoter_commissions(promoter_id);
CREATE INDEX idx_promoter_commissions_date ON promoter_commissions(commission_date);
CREATE INDEX idx_promoter_commissions_status ON promoter_commissions(payout_status);

-- ============================================================
-- PHASE 6: NIGHTLIFE SOCIAL PROFILES
-- ============================================================

-- Extend profiles table with nightlife-specific columns
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS favorite_drinks JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spend DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_visit_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_music_genres JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'public', -- 'public', 'friends', 'private'
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_badge VARCHAR(50);

-- Create indexes for new profile columns
CREATE INDEX IF NOT EXISTS idx_profiles_instagram ON profiles(instagram_handle) WHERE instagram_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_visibility ON profiles(visibility);

-- Profile Followers (social connections)
CREATE TABLE IF NOT EXISTS profile_followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'blocked', 'muted'
  
  -- Timestamps
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_profile_followers_follower ON profile_followers(follower_id);
CREATE INDEX idx_profile_followers_following ON profile_followers(following_id);

-- Social Activity Feed
CREATE TABLE IF NOT EXISTS social_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type VARCHAR(50) NOT NULL, -- 'check_in', 'table_booking', 'bottle_order', 'review', 'photo_upload'
  activity_title VARCHAR(255) NOT NULL,
  activity_description TEXT,
  
  -- Related entities
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  table_reservation_id UUID REFERENCES table_reservations(id) ON DELETE SET NULL,
  
  -- Media
  photos JSONB DEFAULT '[]',
  
  -- Visibility
  visibility VARCHAR(50) DEFAULT 'public', -- 'public', 'friends', 'private'
  
  -- Engagement
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_social_activities_tenant ON social_activities(tenant_id);
CREATE INDEX idx_social_activities_user ON social_activities(user_id);
CREATE INDEX idx_social_activities_type ON social_activities(activity_type);
CREATE INDEX idx_social_activities_event ON social_activities(event_id);
CREATE INDEX idx_social_activities_created ON social_activities(created_at DESC);

-- ============================================================
-- PHASE 7: AI BARTENDER RECOMMENDATIONS
-- ============================================================

-- Drink Recommendations
CREATE TABLE IF NOT EXISTS drink_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Recommendation context
  recommendation_type VARCHAR(50) NOT NULL, -- 'personalized', 'popular', 'trending', 'event_based', 'time_based'
  recommendation_reason TEXT,
  
  -- Scoring
  confidence_score DECIMAL(5, 2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  priority_rank INTEGER DEFAULT 0,
  
  -- Context factors
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  time_of_day VARCHAR(20), -- 'morning', 'afternoon', 'evening', 'late_night'
  day_of_week INTEGER, -- 0-6
  weather VARCHAR(50),
  season VARCHAR(20),
  
  -- User preferences matched
  matches_purchase_history BOOLEAN DEFAULT FALSE,
  matches_preferences BOOLEAN DEFAULT FALSE,
  is_new_to_user BOOLEAN DEFAULT FALSE,
  
  -- Product details (denormalized for performance)
  product_name VARCHAR(255),
  product_category VARCHAR(100),
  product_price DECIMAL(10, 2),
  product_image_url TEXT,
  
  -- Performance tracking
  times_shown INTEGER DEFAULT 0,
  times_clicked INTEGER DEFAULT 0,
  times_purchased INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_drink_recommendations_tenant ON drink_recommendations(tenant_id);
CREATE INDEX idx_drink_recommendations_user ON drink_recommendations(user_id);
CREATE INDEX idx_drink_recommendations_product ON drink_recommendations(product_id);
CREATE INDEX idx_drink_recommendations_type ON drink_recommendations(recommendation_type);
CREATE INDEX idx_drink_recommendations_score ON drink_recommendations(confidence_score DESC);
CREATE INDEX idx_drink_recommendations_active ON drink_recommendations(is_active) WHERE is_active = TRUE;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE guest_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE promoter_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Guest Lists: Staff and promoters can manage
CREATE POLICY guest_lists_tenant_isolation ON guest_lists
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      promoter_id = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Guest List Entries: Guests can see own entry, staff/promoters see all
CREATE POLICY guest_list_entries_tenant_isolation ON guest_list_entries
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR added_by = auth.uid()
      OR guest_phone IN (
        SELECT phone FROM profiles WHERE id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM guest_lists
        WHERE id = guest_list_entries.guest_list_id
        AND (promoter_id = auth.uid() OR created_by = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Promoters: Promoters see own, staff see all
CREATE POLICY promoters_tenant_isolation ON promoters
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

-- Promoter Commissions: Promoter sees own, staff see all
CREATE POLICY promoter_commissions_tenant_isolation ON promoter_commissions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM promoters
        WHERE id = promoter_commissions.promoter_id
        AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Profile Followers: Public read, owner can manage
CREATE POLICY profile_followers_read ON profile_followers
  FOR SELECT
  USING (TRUE);

CREATE POLICY profile_followers_manage ON profile_followers
  FOR ALL
  USING (follower_id = auth.uid());

-- Social Activities: Public read based on visibility
CREATE POLICY social_activities_read ON social_activities
  FOR SELECT
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM profile_followers
        WHERE following_id = social_activities.user_id
        AND follower_id = auth.uid()
      )
    )
  );

CREATE POLICY social_activities_manage ON social_activities
  FOR ALL
  USING (user_id = auth.uid());

-- Drink Recommendations: Users see own recommendations
CREATE POLICY drink_recommendations_view ON drink_recommendations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id IS NULL -- General recommendations
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Update guest list counts
CREATE OR REPLACE FUNCTION update_guest_list_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE guest_lists
    SET current_guest_count = current_guest_count + NEW.total_party_size,
        checked_in_count = checked_in_count + CASE WHEN NEW.checked_in THEN NEW.actual_party_size ELSE 0 END
    WHERE id = NEW.guest_list_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE guest_lists
    SET current_guest_count = current_guest_count + (NEW.total_party_size - OLD.total_party_size),
        checked_in_count = checked_in_count + 
          (CASE WHEN NEW.checked_in THEN COALESCE(NEW.actual_party_size, NEW.total_party_size) ELSE 0 END) -
          (CASE WHEN OLD.checked_in THEN COALESCE(OLD.actual_party_size, OLD.total_party_size) ELSE 0 END)
    WHERE id = NEW.guest_list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE guest_lists
    SET current_guest_count = current_guest_count - OLD.total_party_size,
        checked_in_count = checked_in_count - CASE WHEN OLD.checked_in THEN COALESCE(OLD.actual_party_size, OLD.total_party_size) ELSE 0 END
    WHERE id = OLD.guest_list_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guest_list_entries_update_counts
  AFTER INSERT OR UPDATE OR DELETE ON guest_list_entries
  FOR EACH ROW EXECUTE FUNCTION update_guest_list_counts();

-- Update promoter metrics
CREATE OR REPLACE FUNCTION update_promoter_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_promoter_id UUID;
BEGIN
  -- Get promoter from guest list
  SELECT promoter_id INTO v_promoter_id
  FROM guest_lists
  WHERE id = NEW.guest_list_id;
  
  IF v_promoter_id IS NOT NULL AND NEW.checked_in = TRUE THEN
    UPDATE promoters
    SET total_guests = total_guests + COALESCE(NEW.actual_party_size, NEW.total_party_size)
    WHERE id = v_promoter_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guest_list_entries_update_promoter
  AFTER INSERT OR UPDATE OF checked_in ON guest_list_entries
  FOR EACH ROW 
  WHEN (NEW.checked_in = TRUE)
  EXECUTE FUNCTION update_promoter_metrics();

-- Update timestamps
CREATE TRIGGER guest_lists_updated_at BEFORE UPDATE ON guest_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER guest_list_entries_updated_at BEFORE UPDATE ON guest_list_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER promoters_updated_at BEFORE UPDATE ON promoters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER drink_recommendations_updated_at BEFORE UPDATE ON drink_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
