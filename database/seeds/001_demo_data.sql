-- ============================================================
-- TÂM AN CARE V7.5 — IDEMPOTENT DEMO SEED DATA
-- Default test password for all staff: TamAn@2026
-- ============================================================

BEGIN;

-- 1. Insert Staff Actors
INSERT INTO staff_actors (
    actor_id,
    staff_code,
    display_name,
    primary_operational_role,
    status,
    employment_reference
) VALUES
    ('TA-DIR-01', 'TA-DIR-01', 'Hoàng Quốc Anh', 'SUPERVISOR', 'ACTIVE', 'EMP-2024-001'),
    ('TA-MGR-01', 'TA-MGR-01', 'Nguyễn Thị Thu Hà', 'CARE_MANAGER', 'ACTIVE', 'EMP-2024-002'),
    ('TA-NUR-01', 'TA-NUR-01', 'Trần Thị Mai', 'NURSE', 'ACTIVE', 'EMP-2024-003'),
    ('TA-CG-01',  'TA-CG-01',  'Lê Văn Nam', 'CAREGIVER', 'ACTIVE', 'EMP-2024-004'),
    ('STAFF-DIR-001', 'NV-DIR-001', 'Hà Quang Anh', 'SUPERVISOR', 'ACTIVE', 'EMP-2024-005'),
    ('STAFF-MGR-001', 'MGR-001', 'Phạm Minh Đức', 'CARE_MANAGER', 'ACTIVE', 'EMP-2024-006'),
    ('STAFF-NUR-001', 'NUR-001', 'Lê Thị Lan', 'NURSE', 'ACTIVE', 'EMP-2024-007'),
    ('cg-mai-001',    'CG-001',   'Trần Thị Mai', 'CAREGIVER', 'ACTIVE', 'EMP-2024-008')
ON CONFLICT (actor_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    status = 'ACTIVE';

-- 2. Insert Auth Credentials (PBKDF2 sha256 with 100,000 iterations, password: TamAn@2026)
INSERT INTO auth_credentials (
    actor_id,
    password_hash,
    password_salt,
    password_iterations,
    password_digest,
    failed_attempts,
    locked_until,
    password_changed_at
) VALUES
    ('TA-DIR-01', '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('TA-MGR-01', '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('TA-NUR-01', '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('TA-CG-01',  '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('STAFF-DIR-001', '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('STAFF-MGR-001', '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('STAFF-NUR-001', '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now()),
    ('cg-mai-001',    '9b04594bfebf46df8aa625bd7bb5ee8caf817a6a0bcd7a997a676395cd2ea44e', '31dcd06238c9eed7d0fced3ae62d7a49', 100000, 'sha256', 0, NULL, now())
ON CONFLICT (actor_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    password_salt = EXCLUDED.password_salt,
    failed_attempts = 0,
    locked_until = NULL;

-- 3. Insert Demo Residents
INSERT INTO residents (
    resident_id,
    resident_code,
    display_name,
    date_of_birth,
    gender,
    room,
    bed,
    care_level,
    active_status
) VALUES
    ('res-demo-001', 'RES-2026-001', 'Cụ Nguyễn Văn An', '1945-03-15', 'MALE', 'P.101', 'Giường A', 'INDEPENDENT', true),
    ('res-demo-002', 'RES-2026-002', 'Cụ Trần Thị Bình', '1942-08-20', 'FEMALE', 'P.102', 'Giường B', 'ASSISTED', true),
    ('res-demo-003', 'RES-2026-003', 'Cụ Lê Hoàng Cúc', '1938-11-05', 'FEMALE', 'P.201', 'Giường A', 'HIGH_ASSISTANCE', true),
    ('res-demo-004', 'RES-2026-004', 'Cụ Phạm Văn Dũng', '1940-06-12', 'MALE', 'P.202', 'Giường A', 'DEPENDENT', true),
    ('res-demo-005', 'RES-2026-005', 'Cụ Vũ Thị Em', '1948-01-25', 'FEMALE', 'P.103', 'Giường B', 'INDEPENDENT', true)
ON CONFLICT (resident_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    care_level = EXCLUDED.care_level,
    active_status = true;

COMMIT;
