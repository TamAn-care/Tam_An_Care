-- CI-only synthetic scaffolding to exercise cross-module joins.
-- NOT a production migration. No real names, money or resident records.
CREATE TABLE public.residents(resident_id text PRIMARY KEY,care_level text NOT NULL);
CREATE TABLE public.admission_cases(admission_case_id text PRIMARY KEY,resident_id text NOT NULL);
CREATE TABLE public.admission_care_classifications(
  admission_case_id text NOT NULL,approved_care_level text,
  approved_at timestamptz,review_status text);
CREATE TABLE public.accommodation_rooms(room_id text PRIMARY KEY);
CREATE TABLE public.accommodation_beds(bed_id text PRIMARY KEY,room_id text NOT NULL);
CREATE TABLE public.bed_assignments(resident_id text NOT NULL,bed_id text NOT NULL,ended_at timestamptz);
CREATE TABLE public.staff_actors(actor_id text PRIMARY KEY,primary_operational_role text,status text);
CREATE TABLE public.auth_sessions(session_id text PRIMARY KEY,actor_id text,actor_role text,revoked_at timestamptz,expires_at timestamptz);
INSERT INTO public.residents VALUES ('CI_RESIDENT','ASSISTED');
INSERT INTO public.admission_cases VALUES ('CI_CASE','CI_RESIDENT');
INSERT INTO public.admission_care_classifications VALUES ('CI_CASE','ASSISTED',now(),'APPROVED');
INSERT INTO public.accommodation_rooms VALUES ('CI_ROOM');
INSERT INTO public.accommodation_beds VALUES ('CI_BED','CI_ROOM');
INSERT INTO public.bed_assignments VALUES ('CI_RESIDENT','CI_BED',NULL);
INSERT INTO public.staff_actors VALUES
 ('CI_VERIFY','CARE_MANAGER','ACTIVE'),('CI_APPROVE','SUPERVISOR','ACTIVE');
INSERT INTO public.auth_sessions VALUES
 ('CI_VERIFY_SESSION','CI_VERIFY','CARE_MANAGER',NULL,now()+interval '1 hour'),
 ('CI_APPROVE_SESSION','CI_APPROVE','SUPERVISOR',NULL,now()+interval '1 hour');
INSERT INTO public.service_contract_records(contract_id,contract_code,resident_id,status,payload)
 VALUES ('CI_SIGNOFF','CI_NUMBER','CI_RESIDENT','DRAFT','{}');
INSERT INTO public.service_contract_versions(contract_id,version,payload,status,effective_date,change_reason)
VALUES('CI_SIGNOFF',1,
 '{"appendix":{"baseMonthlyFee":100,"additionalServices":[{"name":"CI_SUPPORT","fee":30,"selected":true}],"discount":10,"totalMonthlyFee":120},"operationalRefs":{"roomId":"CI_ROOM","bedId":"CI_BED","careLevel":"ASSISTED"}}'::jsonb,
 'DRAFT','2026-10-01','CI contract integration only');
