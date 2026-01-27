-- FitLoop Migration: Add Water and Workout Tracking Tables
-- Version: 003
-- Date: 2024
-- Description: Adds tables for water intake tracking and workout logging

-- =============================================================================
-- WATER TRACKING TABLES
-- =============================================================================

-- Water log entries table
CREATE TABLE IF NOT EXISTS water_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    log_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    amount_ml INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
    note VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast date-based queries
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, log_date);

-- User water goals table (one per user)
CREATE TABLE IF NOT EXISTS user_water_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    daily_goal_ml INTEGER DEFAULT 2000 CHECK (daily_goal_ml >= 500 AND daily_goal_ml <= 10000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_water_goals_user ON user_water_goals(user_id);

-- =============================================================================
-- WORKOUT TRACKING TABLE
-- =============================================================================

-- Workout log entries table
CREATE TABLE IF NOT EXISTS workout_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    log_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    workout_type VARCHAR(50) NOT NULL,
    workout_name VARCHAR(200),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 600),
    calories_burned INTEGER CHECK (calories_burned IS NULL OR (calories_burned >= 0 AND calories_burned <= 5000)),
    intensity VARCHAR(20) CHECK (intensity IS NULL OR intensity IN ('low', 'moderate', 'high')),
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast date-based queries
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, log_date);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) FOR SUPABASE
-- =============================================================================

-- Enable RLS on water_logs
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own water logs
CREATE POLICY "Users can view own water logs" ON water_logs
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: Users can insert their own water logs
CREATE POLICY "Users can insert own water logs" ON water_logs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Users can delete their own water logs
CREATE POLICY "Users can delete own water logs" ON water_logs
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Enable RLS on user_water_goals
ALTER TABLE user_water_goals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own water goal
CREATE POLICY "Users can view own water goal" ON user_water_goals
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: Users can insert their own water goal
CREATE POLICY "Users can insert own water goal" ON user_water_goals
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Users can update their own water goal
CREATE POLICY "Users can update own water goal" ON user_water_goals
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Enable RLS on workout_logs
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own workout logs
CREATE POLICY "Users can view own workout logs" ON workout_logs
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: Users can insert their own workout logs
CREATE POLICY "Users can insert own workout logs" ON workout_logs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Users can delete their own workout logs
CREATE POLICY "Users can delete own workout logs" ON workout_logs
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE water_logs IS 'Individual water intake log entries';
COMMENT ON TABLE user_water_goals IS 'User daily water intake goals (one per user)';
COMMENT ON TABLE workout_logs IS 'Workout/exercise log entries';

COMMENT ON COLUMN water_logs.amount_ml IS 'Water amount in milliliters';
COMMENT ON COLUMN user_water_goals.daily_goal_ml IS 'Daily water goal in milliliters (default 2000ml = 2L)';
COMMENT ON COLUMN workout_logs.workout_type IS 'Type: cardio, strength, flexibility, sports, hiit, walking, running, cycling, swimming, yoga, other';
COMMENT ON COLUMN workout_logs.intensity IS 'Intensity level: low, moderate, high';
