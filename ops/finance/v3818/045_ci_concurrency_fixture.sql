-- V45 isolated CI concurrency gate: independent sessions, same approved voucher.
-- This fixture and ALL writes occur exclusively inside finance_ci.
BEGIN;
DO $$ BEGIN IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF; END $$;
INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
VALUES('ci45m','ci45maker','FINANCE_MAKER',now()+interval '1 hour'),
('ci45r','ci45review','FINANCE_REVIEWER',now()+interval '1 hour'),
('ci45a','ci45approve','FINANCE_APPROVER',now()+interval '1 hour');
SELECT finance_manual_v26_ci.create_draft_v29('ci45doc','ci45origin','PAYROLL',current_date,540000,
'SALARY','Concurrency protected voucher','ci45staff','AGREED_AMOUNT','SIGNED_AGREEMENT',
repeat('a',64),'ci45review','ci45approve','ci45m');
SELECT finance_manual_v26_ci.transition_v27('ci45doc',0,'SUBMIT','ci45m','Submitted');
SELECT finance_manual_v26_ci.transition_v27('ci45doc',1,'REVIEW','ci45r','Reviewed');
SELECT finance_manual_v26_ci.transition_v27('ci45doc',2,'APPROVE','ci45a','Approved');
COMMIT;
