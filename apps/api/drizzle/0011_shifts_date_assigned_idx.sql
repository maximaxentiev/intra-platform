-- Composite index for same-day assigned shift conflict queries during smart matching.
CREATE INDEX IF NOT EXISTS shifts_date_assigned_idx ON shifts (shift_date, assigned_staff_id);
