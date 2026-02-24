-- Push Notifications & Broadcast System Migration
-- Creates push_device_tokens, notifications, broadcasts, and notification_preferences tables

-- ============================================
-- 1. Push Device Tokens
-- ============================================
CREATE TABLE IF NOT EXISTS push_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID,
  development_id UUID,

  -- Device info
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,

  -- For web push (VAPID)
  endpoint TEXT,
  p256dh TEXT,
  auth_key TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_development ON push_device_tokens(development_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_device_tokens(is_active) WHERE is_active = true;

-- ============================================
-- 2. Broadcasts (must be created before notifications due to FK)
-- ============================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Author
  tenant_id UUID NOT NULL,
  created_by UUID NOT NULL,

  -- Targeting
  development_id UUID NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN (
    'all', 'phase', 'unit_type', 'pipeline_stage', 'custom'
  )),
  target_filter JSONB,
  target_unit_ids UUID[],

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'community' CHECK (category IN (
    'urgent', 'update', 'milestone', 'maintenance', 'community', 'info'
  )),

  -- Optional attachment
  attachment_url TEXT,
  attachment_name TEXT,

  -- Delivery
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'sending', 'sent', 'failed'
  )),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Analytics
  recipients_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_development ON broadcasts(development_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled ON broadcasts(scheduled_for) WHERE status = 'scheduled';

-- ============================================
-- 3. Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID,
  development_id UUID,

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'broadcast', 'pipeline_update', 'document_uploaded', 'snag_update',
    'handover', 'compliance', 'ai_followup', 'maintenance', 'community', 'system'
  )),

  -- Source
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL,
  triggered_by TEXT,

  -- Deep link
  action_url TEXT,

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Delivery tracking
  push_sent BOOLEAN DEFAULT false,
  push_sent_at TIMESTAMPTZ,
  push_delivered BOOLEAN DEFAULT false,
  push_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_development ON notifications(development_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(broadcast_id);

-- ============================================
-- 4. Notification Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Channel preferences
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,

  -- Category preferences (user can mute specific categories)
  muted_categories TEXT[] DEFAULT '{}',

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================
-- RLS Policies
-- ============================================

-- push_device_tokens
ALTER TABLE push_device_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own tokens"
    ON push_device_tokens FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- broadcasts
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own preferences"
    ON notification_preferences FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;
