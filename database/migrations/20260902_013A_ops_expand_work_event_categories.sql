BEGIN;

-- TamAnCare operational-work category contract expansion.
--
-- Migration 003 introduced the original category constraint.
-- Later application contracts intentionally introduced:
--   CLINICAL_CARE
--   PSYCHOSOCIAL
--   EMERGENCY
--
-- Preserve all original categories for backward compatibility.

ALTER TABLE operational_work_event_types
  DROP CONSTRAINT IF EXISTS
    operational_work_event_types_category_ck;

ALTER TABLE operational_work_event_types
  ADD CONSTRAINT
    operational_work_event_types_category_ck
  CHECK (
    category IN (
      'PERSONAL_CARE',
      'HOUSEKEEPING',
      'LAUNDRY',
      'MOBILITY',
      'NUTRITION',
      'ACTIVITY',
      'OTHER',
      'CLINICAL_CARE',
      'PSYCHOSOCIAL',
      'EMERGENCY'
    )
  );

COMMIT;
