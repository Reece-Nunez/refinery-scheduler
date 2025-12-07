-- Add vacation_hours column to operators table
-- This stores the total annual vacation hours allocated to each operator

ALTER TABLE operators
ADD COLUMN IF NOT EXISTS vacation_hours INTEGER DEFAULT 168;

-- 168 hours = 21 days * 8 hours (standard 3 weeks PTO)
-- Admins can adjust this per operator based on seniority, etc.

COMMENT ON COLUMN operators.vacation_hours IS 'Total annual vacation hours allocated to this operator';
