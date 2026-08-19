-- Backfill current VSC submission expiry dates to processed_date + 1 calendar year.
-- Only the active (current) submission per vulnerable_sector_check set is updated.
-- Superseded/historical submissions and other document types are untouched.

UPDATE staff_document_submissions AS sub
SET
  expiry_date = (sub.processed_date + interval '1 year')::date,
  updated_at = now()
FROM staff_document_sets AS sds
WHERE sds.document_type = 'vulnerable_sector_check'
  AND sds.current_submission_id = sub.id
  AND sub.processed_date IS NOT NULL
  AND sub.superseded_at IS NULL
  AND sub.expiry_date IS DISTINCT FROM (sub.processed_date + interval '1 year')::date;
