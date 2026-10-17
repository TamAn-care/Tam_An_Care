CREATE TABLE public.auth_sessions (
 session_id text PRIMARY KEY,
 actor_id text NOT NULL,
 actor_role text NOT NULL,
 revoked_at timestamptz,
 expires_at timestamptz NOT NULL
);
CREATE TABLE public.staff_actors (
 actor_id text PRIMARY KEY,
 status text NOT NULL,
 primary_operational_role text NOT NULL
);
CREATE TABLE public.residents (
 resident_id text PRIMARY KEY,
 care_level text NOT NULL
);
CREATE TABLE public.accommodation_rooms (
 room_id text PRIMARY KEY
);
CREATE TABLE public.accommodation_beds (
 bed_id text PRIMARY KEY,
 room_id text NOT NULL
);
CREATE TABLE public.bed_assignments (
 resident_id text,
 bed_id text,
 ended_at timestamptz
);
CREATE TABLE public.admission_cases (
 admission_case_id text PRIMARY KEY,
 resident_id text
);
CREATE TABLE public.admission_care_classifications (
 admission_case_id text,
 approved_care_level text,
 approved_at timestamptz,
 review_status text
);

INSERT INTO staff_actors VALUES
 ('TEST_VERIFIER','ACTIVE','ACCOUNTANT'),
 ('TEST_APPROVER','ACTIVE','ADMIN');

INSERT INTO auth_sessions VALUES
 ('SESSION_VERIFY','TEST_VERIFIER','ACCOUNTANT',
  NULL,now()+interval '1 hour'),
 ('SESSION_APPROVE','TEST_APPROVER','ADMIN',
  NULL,now()+interval '1 hour');

INSERT INTO residents VALUES ('TEST_R1','LEVEL_1');
INSERT INTO accommodation_rooms VALUES ('TEST_ROOM');
INSERT INTO accommodation_beds VALUES ('TEST_BED','TEST_ROOM');
INSERT INTO bed_assignments VALUES
 ('TEST_R1','TEST_BED',NULL);
INSERT INTO admission_cases VALUES ('TEST_ADMISSION','TEST_R1');
INSERT INTO admission_care_classifications VALUES
 ('TEST_ADMISSION','LEVEL_1',now(),'APPROVED');

INSERT INTO service_contract_records
 (contract_id,contract_code,resident_id,status,payload)
VALUES ('TEST_C1','TEST_CODE_1','TEST_R1','DRAFT','{}');

INSERT INTO service_contract_versions
 (contract_id,version,payload,status,effective_date)
VALUES (
 'TEST_C1',1,
 '{
    "operationalRefs":{
      "roomId":"TEST_ROOM",
      "bedId":"TEST_BED",
      "careLevel":"LEVEL_1"
    },
    "appendix":{
      "baseMonthlyFee":12000000,
      "additionalServices":[],
      "discount":0,
      "totalMonthlyFee":12000000
    }
  }',
 'DRAFT',CURRENT_DATE
);
