-- Migration: Add dimensions JSONB column to house_types
-- This column stores structured room dimensions for the house type
-- Used by the assistant to answer questions like "How big is my living room?"

ALTER TABLE house_types
ADD COLUMN IF NOT EXISTS dimensions JSONB;

-- Add comment for documentation
COMMENT ON COLUMN house_types.dimensions IS 'Structured room dimensions JSON for assistant queries. Format: {"living_room": {"length": 5.2, "width": 4.1}, ...}';
