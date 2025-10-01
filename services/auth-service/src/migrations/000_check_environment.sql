-- Migration: 000_check_environment.sql
-- Description: Environment check and setup
-- Created: 2024-01-01

-- This migration checks if we're in development (Docker) or production
-- and handles the setup accordingly

-- Create a simple table to track our environment setup
CREATE TABLE IF NOT EXISTS environment_info (
    id SERIAL PRIMARY KEY,
    environment VARCHAR(50) NOT NULL,
    setup_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Insert environment info (this will only insert if no records exist)
INSERT INTO environment_info (environment, notes) 
SELECT 'production', 'Database setup via migrations'
WHERE NOT EXISTS (SELECT 1 FROM environment_info);

-- Create a view to check if tables exist (for debugging)
CREATE OR REPLACE VIEW table_check AS
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'users', 'sessions', 'refresh_tokens', 
            'password_resets', 'email_verifications'
        ) THEN 'auth_tables'
        ELSE 'other'
    END as table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
