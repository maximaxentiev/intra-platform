CREATE TABLE shift_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  request_completed_at timestamptz,
  request_completed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX shift_batches_centre_idx ON shift_batches (centre_id);

ALTER TABLE shifts
  ADD COLUMN batch_id uuid REFERENCES shift_batches(id) ON DELETE RESTRICT;

CREATE INDEX shifts_batch_idx ON shifts (batch_id);
