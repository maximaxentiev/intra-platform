-- Enforce shifts.centre_id = shift_batches.centre_id whenever batch_id is set.
-- PostgreSQL skips composite FK checks when batch_id IS NULL (individual shifts).

ALTER TABLE shift_batches
  ADD CONSTRAINT shift_batches_id_centre_unique UNIQUE (id, centre_id);

ALTER TABLE shifts
  ADD CONSTRAINT shifts_batch_centre_fk
  FOREIGN KEY (batch_id, centre_id)
  REFERENCES shift_batches (id, centre_id)
  ON DELETE RESTRICT;
