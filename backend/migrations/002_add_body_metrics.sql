-- Migration: Add body metrics columns to users table
-- Run this in Supabase SQL Editor

-- Add new columns for body metrics and fitness goals
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'male';
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm FLOAT DEFAULT 170;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg FLOAT DEFAULT 70;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level VARCHAR(50) DEFAULT 'moderately_active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS fitness_goal VARCHAR(50) DEFAULT 'maintain';

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
