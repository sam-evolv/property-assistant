-- ============================================
-- OpenHouse Select — Builder Stakeholder Access
-- ============================================

CREATE TABLE IF NOT EXISTS select_project_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES select_builder_projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'other',
  access_level TEXT DEFAULT 'documents',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE select_project_stakeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders manage stakeholders for own projects"
  ON select_project_stakeholders FOR ALL
  USING (
    project_id IN (
      SELECT id FROM select_builder_projects WHERE builder_id = auth.uid()
    )
  );
