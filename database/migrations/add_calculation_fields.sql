-- Add new fields to calculations table for enhanced project details display
-- This migration adds PSI, mix profile, and Quikrete product information

-- Add PSI field
ALTER TABLE calculations 
ADD COLUMN IF NOT EXISTS psi TEXT;

-- Add mix profile field  
ALTER TABLE calculations 
ADD COLUMN IF NOT EXISTS mix_profile TEXT;

-- Add Quikrete product information as JSONB
ALTER TABLE calculations 
ADD COLUMN IF NOT EXISTS quikrete_product JSONB;

-- Add comments for documentation
COMMENT ON COLUMN calculations.psi IS 'Concrete strength in PSI (e.g., "3000", "4000")';
COMMENT ON COLUMN calculations.mix_profile IS 'Mix profile type (standard, highEarly, highStrength, rapidSet)';
COMMENT ON COLUMN calculations.quikrete_product IS 'Quikrete product details: {type: string, weight: number, yield: number}'; 