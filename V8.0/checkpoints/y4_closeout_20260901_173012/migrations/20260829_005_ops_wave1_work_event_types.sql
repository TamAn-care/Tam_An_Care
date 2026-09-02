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
  'ops-wet-care-task-completion',
  'CARE_TASK_COMPLETION',
  'Hoàn thành nhiệm vụ chăm sóc',
  'OTHER',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-toileting-assistance',
  'TOILETING_ASSISTANCE',
  'Hỗ trợ đi vệ sinh',
  'PERSONAL_CARE',
  'lần',
  1,
  TRUE,
  TRUE,
  TRUE
),
(
  'ops-wet-personal-care-assistance',
  'PERSONAL_CARE_ASSISTANCE',
  'Hỗ trợ chăm sóc cá nhân',
  'PERSONAL_CARE',
  'lần',
  1,
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (code) DO NOTHING;
