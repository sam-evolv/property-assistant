-- Row-Level Security (RLS) Policies for OpenHouse AI
-- Enable RLS on all tables and configure tenant-scoped access

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_policy" ON tenants
  FOR SELECT
  USING (
    id = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
      id
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "tenants_insert_policy" ON tenants
  FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "tenants_update_policy" ON tenants
  FOR UPDATE
  USING (
    id = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
      id
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_policy" ON admins
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
      tenant_id
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "admins_insert_policy" ON admins
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "admins_update_policy" ON admins
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "documents_update_policy" ON documents
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "documents_delete_policy" ON documents
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on noticeboard_posts table
ALTER TABLE noticeboard_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noticeboard_posts_select_policy" ON noticeboard_posts
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "noticeboard_posts_insert_policy" ON noticeboard_posts
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "noticeboard_posts_update_policy" ON noticeboard_posts
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "noticeboard_posts_delete_policy" ON noticeboard_posts
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on pois table
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pois_select_policy" ON pois
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "pois_insert_policy" ON pois
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "pois_update_policy" ON pois
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "pois_delete_policy" ON pois
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_policy" ON messages
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "messages_insert_policy" ON messages
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "messages_update_policy" ON messages
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "messages_delete_policy" ON messages
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

-- Enable RLS on analytics_daily table
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_daily_select_policy" ON analytics_daily
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "analytics_daily_insert_policy" ON analytics_daily
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "analytics_daily_update_policy" ON analytics_daily
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );

CREATE POLICY "analytics_daily_delete_policy" ON analytics_daily
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    OR
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'platform'
  );
