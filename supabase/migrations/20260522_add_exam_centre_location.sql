-- HallMate: add exam_centre_state + exam_centre_district columns.
-- The existing state/district (home location) are preserved for backward
-- compatibility — do NOT drop them until all user data is migrated.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS exam_centre_state    TEXT,
  ADD COLUMN IF NOT EXISTS exam_centre_district TEXT;

-- Optional: copy existing values to pre-fill for current users
-- (safe to run; only fills NULL rows, does not overwrite)
UPDATE users
SET
  exam_centre_state    = state,
  exam_centre_district = district
WHERE
  exam_centre_state IS NULL
  AND state IS NOT NULL;
