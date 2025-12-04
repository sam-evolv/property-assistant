-- Add house_id and sender columns to messages table for Phase 14 chat history

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES homeowners(id) ON DELETE SET NULL;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS sender VARCHAR(20) CHECK (sender IN ('user', 'assistant'));

-- Create index for efficient house_id queries
CREATE INDEX IF NOT EXISTS messages_house_idx ON messages(house_id);

-- Create composite index for chat history queries
CREATE INDEX IF NOT EXISTS messages_house_created_idx ON messages(house_id, created_at DESC);

-- Update metadata column to ensure it exists as jsonb (should already be present)
-- This is a safety check in case metadata doesn't default properly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
