-- CI-only disposable PostgreSQL prerequisites. No personal or production data.
CREATE TABLE residents (resident_id TEXT PRIMARY KEY, active_status BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE nutrition_plans (
 nutrition_plan_id TEXT PRIMARY KEY, resident_id TEXT NOT NULL,
 status TEXT NOT NULL, effective_from TIMESTAMPTZ, effective_to TIMESTAMPTZ
);
CREATE TABLE diet_orders (
 diet_order_id TEXT PRIMARY KEY, nutrition_plan_id TEXT NOT NULL,
 resident_id TEXT NOT NULL, status TEXT NOT NULL, safety_confirmed BOOLEAN NOT NULL,
 approved_at TIMESTAMPTZ, effective_from TIMESTAMPTZ, effective_to TIMESTAMPTZ
);
CREATE TABLE resident_access_assignments (
 resident_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL,
 access_scope TEXT NOT NULL, status TEXT NOT NULL,
 effective_from TIMESTAMPTZ NOT NULL, effective_to TIMESTAMPTZ
);
INSERT INTO residents VALUES ('resident-a',TRUE),('resident-b',TRUE);
INSERT INTO nutrition_plans VALUES ('plan-a','resident-a','ACTIVE',NULL,NULL),('plan-b','resident-b','ACTIVE',NULL,NULL);
INSERT INTO diet_orders VALUES
 ('diet-a','plan-a','resident-a','ACTIVE',TRUE,now(),NULL,NULL),
 ('diet-b','plan-b','resident-b','ACTIVE',TRUE,now(),NULL,NULL);
INSERT INTO resident_access_assignments VALUES ('resident-a','cg-one','CAREGIVER','DIRECT_CARE','ACTIVE',now()-interval '1 day',NULL);
