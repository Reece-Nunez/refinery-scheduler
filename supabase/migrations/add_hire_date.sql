-- Add hire_date column to operators table
-- This allows automatic vacation calculation based on years of service

ALTER TABLE operators
ADD COLUMN IF NOT EXISTS hire_date DATE;

COMMENT ON COLUMN operators.hire_date IS 'Employee hire date for calculating vacation entitlement based on tenure';
