-- Migration: Add current_kennel_id to animals table
-- Run this manually on Supabase SQL Editor

-- Add the column
ALTER TABLE animals 
ADD COLUMN IF NOT EXISTS current_kennel_id UUID REFERENCES kennels(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS ix_animals_current_kennel_id ON animals(current_kennel_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'animals' AND column_name = 'current_kennel_id';