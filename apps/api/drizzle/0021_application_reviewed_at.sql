ALTER TABLE applications
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX applications_reviewed_at_idx ON applications (reviewed_at);
