-- PEXP Database Schema
-- PostgreSQL schema for patient intake submissions

-- Main patient submissions table
CREATE TABLE IF NOT EXISTS patient_submissions (
    id SERIAL PRIMARY KEY,
    
    -- Patient Information
    full_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    date_of_birth DATE,
    
    -- Pain Information
    pain_duration VARCHAR(100) NOT NULL,
    pain_intensity INTEGER CHECK (pain_intensity >= 0 AND pain_intensity <= 10),
    pain_start TEXT,
    
    -- Medical History
    additional_history TEXT,
    medications TEXT,
    mobility_aids TEXT,
    
    -- Goals and Expectations
    timeline VARCHAR(100),
    milestones TEXT,
    concerns TEXT,
    
    -- Consent
    consent BOOLEAN NOT NULL DEFAULT false,
    
    -- AI Summary
    ai_summary TEXT,
    
    -- Metadata
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- JSON fields for arrays/complex data
    selected_areas JSONB,
    red_flags JSONB,
    prev_ortho JSONB,
    current_treatments JSONB,
    daily_impact JSONB,
    goals JSONB,
    pain_points JSONB,
    
    -- Full form data backup
    raw_form_data JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_email ON patient_submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON patient_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_pain_duration ON patient_submissions(pain_duration);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patient_submissions_updated_at 
    BEFORE UPDATE ON patient_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE patient_submissions IS 'Stores patient intake form submissions';
COMMENT ON COLUMN patient_submissions.selected_areas IS 'Array of body regions where patient experiences pain';
COMMENT ON COLUMN patient_submissions.pain_points IS 'Detailed pain point data with coordinates and intensities';
COMMENT ON COLUMN patient_submissions.raw_form_data IS 'Complete form data backup for debugging and migration';
