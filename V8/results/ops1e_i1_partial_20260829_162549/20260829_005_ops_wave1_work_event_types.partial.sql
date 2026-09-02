BEGIN;

INSERT INTO operational_work_event_types (
  work_event_type_id,
  code,
  display_name_vi,
  category,
  default_unit,
  default_work_weight,
  resident_related,
  inventory_link_allowed,
  active
)
VALUES
(
  'work-event-type-care-task-completion',
  'CARE_TASK_COMPLETION',
  'Hoàn thành công việc chăm sóc',
  'OTHER',
  'lần',
  1.0,
  TRUE,
  FALSE,
  TRUE
),
(
  'work-event-type-personal-care-assistance',
  'PERSONAL_CARE_ASSISTANCE',
  'Hỗ trợ chăm sóc cá nhân',
  'PERSONAL_CARE',
  'lần',
  1.0,
  TRUE,
  FALSE,
  TRUE
),
(
  'work-event-type-toileting-assistance',
  'TOILETING_ASSISTANCE',
  'Hỗ trợ vệ sinh/đi toilet',
  'PERSONAL_CARE',
  'lần',
  1.0,
  TRUE,
  FALSE,
  TRUE
)
ON CONFLICT (code) DO NOTHING;

COMMIT;
