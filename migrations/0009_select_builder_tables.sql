-- ============================================
-- OpenHouse Select — Builder Dashboard Tables
-- Tables for bespoke builder project management
-- ============================================

-- Table 1: select_builder_projects
CREATE TABLE IF NOT EXISTS select_builder_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  address_line_1 TEXT,
  city TEXT DEFAULT 'Cork',
  eircode TEXT,
  homeowner_name TEXT,
  homeowner_email TEXT,
  homeowner_phone TEXT,
  build_stage TEXT NOT NULL DEFAULT 'planning'
    CHECK (build_stage IN (
      'planning', 'site_prep', 'foundations', 'superstructure',
      'roof', 'external_works', 'first_fix', 'insulation',
      'plastering', 'second_fix', 'kitchen_bathrooms',
      'external_finish', 'snagging', 'handover', 'complete'
    )),
  target_handover_date DATE,
  actual_handover_date DATE,
  contract_price NUMERIC(12,2),
  hero_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'complete', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE select_builder_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders see own projects"
  ON select_builder_projects FOR ALL
  USING (builder_id = auth.uid());

-- Table 2: select_project_milestones
CREATE TABLE IF NOT EXISTS select_project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES select_builder_projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  label TEXT NOT NULL,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notify_homeowner BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE select_project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders manage milestones for own projects"
  ON select_project_milestones FOR ALL
  USING (
    project_id IN (
      SELECT id FROM select_builder_projects WHERE builder_id = auth.uid()
    )
  );

-- Table 3: select_project_photos
CREATE TABLE IF NOT EXISTS select_project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES select_builder_projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  url TEXT NOT NULL,
  caption TEXT,
  stage TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared')),
  taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE select_project_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders manage photos for own projects"
  ON select_project_photos FOR ALL
  USING (
    project_id IN (
      SELECT id FROM select_builder_projects WHERE builder_id = auth.uid()
    )
  );

-- Table 4: select_project_snags
CREATE TABLE IF NOT EXISTS select_project_snags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES select_builder_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general'
    CHECK (category IN (
      'general', 'plumbing', 'electrical', 'structural',
      'finishing', 'external', 'appliances', 'other'
    )),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  reported_by TEXT DEFAULT 'builder',
  photo_url TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE select_project_snags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders manage snags for own projects"
  ON select_project_snags FOR ALL
  USING (
    project_id IN (
      SELECT id FROM select_builder_projects WHERE builder_id = auth.uid()
    )
  );

-- Table 5: select_project_selections
CREATE TABLE IF NOT EXISTS select_project_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES select_builder_projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  supplier TEXT,
  reference TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'approved', 'queried', 'finalised')),
  homeowner_notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE select_project_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders manage selections for own projects"
  ON select_project_selections FOR ALL
  USING (
    project_id IN (
      SELECT id FROM select_builder_projects WHERE builder_id = auth.uid()
    )
  );

-- Table 6: select_project_documents
CREATE TABLE IF NOT EXISTS select_project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES select_builder_projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN (
      'planning', 'structural', 'bcar', 'homebond',
      'ber', 'warranty', 'contract', 'drawing',
      'specification', 'compliance', 'general'
    )),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'builder'
    CHECK (visibility IN ('builder', 'homeowner', 'both')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE select_project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Builders manage documents for own projects"
  ON select_project_documents FOR ALL
  USING (
    project_id IN (
      SELECT id FROM select_builder_projects WHERE builder_id = auth.uid()
    )
  );
