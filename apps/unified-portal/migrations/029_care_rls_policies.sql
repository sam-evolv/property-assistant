-- Migration 029: Proper RLS policies for Care vertical
-- Replaces overly permissive service_role policies with tenant-scoped access

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "service_role_installations" ON installations;
DROP POLICY IF EXISTS "service_role_support_queries" ON support_queries;
DROP POLICY IF EXISTS "service_role_escalations" ON escalations;
DROP POLICY IF EXISTS "service_role_diagnostic_flows" ON diagnostic_flows;
DROP POLICY IF EXISTS "service_role_diagnostic_completions" ON diagnostic_completions;
DROP POLICY IF EXISTS "service_role_installer_content" ON installer_content;

-- Service role automatically bypasses RLS in Supabase, so no explicit policy needed.
-- These policies are for anon/authenticated roles.

-- Installer dashboard users: can read their own tenant's data
CREATE POLICY "installer_read_own_installations" ON installations
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "installer_write_own_installations" ON installations
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "installer_update_own_installations" ON installations
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email'
    )
  );

-- Escalations
CREATE POLICY "installer_read_own_escalations" ON escalations
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

CREATE POLICY "installer_write_own_escalations" ON escalations
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

-- Support queries
CREATE POLICY "installer_read_own_support_queries" ON support_queries
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

CREATE POLICY "installer_write_own_support_queries" ON support_queries
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

-- Diagnostic flows
CREATE POLICY "installer_own_diagnostic_flows" ON diagnostic_flows
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

-- Diagnostic completions
CREATE POLICY "installer_own_diagnostic_completions" ON diagnostic_completions
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

-- Installer content
CREATE POLICY "installer_own_content" ON installer_content
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM admins WHERE email = auth.jwt()->>'email')
  );

-- Public read access for customer app (accessed via QR code, no auth)
CREATE POLICY "public_read_installations" ON installations
  FOR SELECT USING (portal_status = 'active');

CREATE POLICY "public_read_diagnostic_flows" ON diagnostic_flows
  FOR SELECT USING (status = 'live');

CREATE POLICY "public_read_content" ON installer_content
  FOR SELECT USING (status = 'live');

-- Public write for customer interactions (support queries, diagnostic completions)
CREATE POLICY "public_write_support_queries" ON support_queries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_write_diagnostic_completions" ON diagnostic_completions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_write_escalations" ON escalations
  FOR INSERT WITH CHECK (true);
