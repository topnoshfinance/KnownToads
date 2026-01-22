-- Migration: Add bio field to profiles table
-- Date: 2026-01-22
-- Description: Adds a bio text field to allow toads to describe themselves

-- Add bio column to profiles table
ALTER TABLE profiles ADD COLUMN bio TEXT;

-- Update the updated_at timestamp for existing records (optional)
-- This is just to reflect the schema change, existing records will have null bio
-- No need to set a default value as bio is optional
