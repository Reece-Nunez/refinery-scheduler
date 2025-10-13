-- Migration: Rename isCallOut column to isOvertime in shifts table
-- Date: 2025-10-07

-- Rename the column
ALTER TABLE shifts RENAME COLUMN "isCallOut" TO "isOvertime";

-- Add comment to document the change
COMMENT ON COLUMN shifts."isOvertime" IS 'Indicates if this shift is voluntary overtime work';
