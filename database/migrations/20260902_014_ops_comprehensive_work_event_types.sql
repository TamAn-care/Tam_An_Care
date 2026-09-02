-- Migration: 20260902_014_ops_comprehensive_work_event_types.sql
-- Description: Bổ sung danh mục các loại hình công việc phổ biến tại Viện dưỡng lão Tâm An Care và lựa chọn Khác

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
  'ops-wet-hygiene-bathing',
  'HYGIENE_BATHING',
  'Tắm rửa & Vệ sinh thân thể',
  'PERSONAL_CARE',
  'lần',
  1,
  TRUE,
  TRUE,
  TRUE
),
(
  'ops-wet-meal-assistance',
  'MEAL_ASSISTANCE',
  'Hỗ trợ ăn uống & Bón cháo/cơm',
  'NUTRITION',
  'bữa',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-tube-feeding-assist',
  'TUBE_FEEDING_ASSIST',
  'Hỗ trợ ăn qua ống thông Sonde',
  'NUTRITION',
  'cữ',
  1,
  TRUE,
  TRUE,
  TRUE
),
(
  'ops-wet-vital-signs-check',
  'VITAL_SIGNS_CHECK',
  'Đo dấu hiệu sinh tồn & Huyết áp',
  'CLINICAL_CARE',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-medication-admin',
  'MEDICATION_ADMINISTRATION',
  'Cấp phát & Cho uống thuốc theo y lệnh',
  'CLINICAL_CARE',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-wound-care',
  'WOUND_CARE',
  'Thay băng & Chăm sóc vết thương/loét',
  'CLINICAL_CARE',
  'lần',
  1,
  TRUE,
  TRUE,
  TRUE
),
(
  'ops-wet-mobility-assistance',
  'MOBILITY_ASSISTANCE',
  'Hỗ trợ di chuyển & Đổi tư thế chống loét',
  'MOBILITY',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-rehab-exercise',
  'REHAB_EXERCISE',
  'Hướng dẫn tập VLTL & Phục hồi chức năng',
  'MOBILITY',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-psychological-support',
  'PSYCHOLOGICAL_SUPPORT',
  'Trò chuyện & Tham vấn tâm lý tinh thần',
  'PSYCHOSOCIAL',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-diaper-toileting',
  'DIAPER_TOILETING',
  'Thay tã bỉm & Vệ sinh bài tiết',
  'PERSONAL_CARE',
  'lần',
  1,
  TRUE,
  TRUE,
  TRUE
),
(
  'ops-wet-room-cleaning',
  'ROOM_CLEANING_INCIDENTAL',
  'Dọn dẹp phòng & Thay drap giường đột xuất',
  'HOUSEKEEPING',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-emergency-care',
  'EMERGENCY_INCIDENT_CARE',
  'Xử lý sự cố / Sơ cứu khẩn cấp',
  'EMERGENCY',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-family-visit',
  'FAMILY_VISIT_ASSIST',
  'Đón tiếp thân nhân & Hỗ trợ thăm gặp',
  'PSYCHOSOCIAL',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
),
(
  'ops-wet-other-incidental',
  'OTHER_INCIDENTAL',
  'Khác (Diễn giải chi tiết tại phần Ghi chú)',
  'OTHER',
  'lần',
  1,
  TRUE,
  FALSE,
  TRUE
)
ON CONFLICT (code) DO UPDATE SET
  display_name_vi = EXCLUDED.display_name_vi,
  category = EXCLUDED.category,
  active = TRUE;
