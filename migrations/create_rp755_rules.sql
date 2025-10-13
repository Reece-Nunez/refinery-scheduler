-- Create RP-755 rules configuration table
CREATE TABLE IF NOT EXISTS rp755_rules (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('normal', 'outage', 'exception')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  limit INTEGER NOT NULL,
  unit TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_high_risk BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default RP-755 rules
INSERT INTO rp755_rules (id, category, name, description, limit, unit, enabled, is_high_risk) VALUES
-- Normal Operations Rules
('shift_length', 'normal', 'Maximum Shift Length', 'Total hours (including hand-offs, holdovers, and overtime) shall not exceed 14 hours per shift', 14, 'hours per shift', true, false),
('work_set_normal', 'normal', 'Work-set Hour Limit (Normal Operations)', 'Total hours shall not exceed 92 hours per work-set (105 hours for straight day assignments)', 92, 'hours per work-set', true, false),
('rest_period_normal', 'normal', 'Minimum Rest Period (Normal)', 'Work-set complete when employee is off work for at least 34 hours (46 hours if 4+ night shifts)', 34, 'hours off work', true, false),
('minimum_rest', 'normal', 'Minimum Rest Between Shifts', 'Minimum 8 hours off between shifts (RP-755 best practice)', 8, 'hours off work', true, false),
('consecutive_shifts_12hr', 'normal', 'Maximum Consecutive 12-Hour Shifts', 'Maximum 7 consecutive 12-hour shifts during normal operations', 7, 'consecutive shifts', true, false),
('consecutive_shifts_10hr', 'normal', 'Maximum Consecutive 10-Hour Shifts', 'Maximum 9 consecutive 10-hour shifts during normal operations', 9, 'consecutive shifts', true, false),
('consecutive_shifts_8hr', 'normal', 'Maximum Consecutive 8-Hour Shifts', 'Maximum 10 consecutive 8-hour shifts during normal operations', 10, 'consecutive shifts', true, false),

-- Outage Rules
('work_set_outage', 'outage', 'Work-set Hour Limit (Outages)', 'Total hours shall not exceed 182 hours per work-set during planned outages', 182, 'hours per work-set', true, false),
('rest_period_outage', 'outage', 'Minimum Rest Period (Outages)', 'Work-set complete when employee is off work for at least 34 hours after the work-set', 34, 'hours off work', true, false),
('consecutive_shifts_12hr_outage', 'outage', 'Maximum Consecutive 12-Hour Shifts (Outages)', 'Maximum 14 consecutive 12-hour shifts during planned outages', 14, 'consecutive shifts', true, false),
('consecutive_shifts_10hr_outage', 'outage', 'Maximum Consecutive 10-Hour Shifts (Outages)', 'Maximum 14 consecutive 10-hour shifts during planned outages', 14, 'consecutive shifts', true, false),
('consecutive_shifts_8hr_outage', 'outage', 'Maximum Consecutive 8-Hour Shifts (Outages)', 'Maximum 19 consecutive 8-hour shifts during planned outages', 19, 'consecutive shifts', true, false),

-- High Risk Exception Thresholds
('high_risk_shift', 'exception', 'High Risk - Extended Shift', 'Work more than 18 hours in a single shift requires senior management notification', 18, 'hours per shift', true, true),
('high_risk_rest', 'exception', 'High Risk - Insufficient Rest', 'Return to work prior to having 8 hours off requires senior management notification', 8, 'hours off work', true, true),
('high_risk_extended', 'exception', 'High Risk - Multiple Extended Shifts', 'Work more than one extended shift (>14 hours) per work-set requires senior management notification', 1, 'extended shifts per work-set', true, true)
ON CONFLICT (id) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rp755_rules_updated_at
    BEFORE UPDATE ON rp755_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE rp755_rules IS 'Configuration for API RP 755 Fatigue Risk Management System rules';
