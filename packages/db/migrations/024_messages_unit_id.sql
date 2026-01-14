-- Add unit_id column to messages table for proper unit linkage
-- This column stores the Supabase units.id UUID

ALTER TABLE messages ADD COLUMN IF NOT EXISTS unit_id UUID;

-- Create indexes for unit_id queries
CREATE INDEX IF NOT EXISTS messages_unit_idx ON messages(unit_id);
CREATE INDEX IF NOT EXISTS messages_unit_created_idx ON messages(unit_id, created_at DESC);

-- Backfill unit_id from user_id where they match valid UUIDs
UPDATE messages 
SET unit_id = user_id 
WHERE unit_id IS NULL 
  AND user_id IS NOT NULL;
