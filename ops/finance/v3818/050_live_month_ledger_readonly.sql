-- V3.8.18.50. Safe to execute ONLY within BEGIN READ ONLY on approved target.
-- No amounts, names, resident, payroll or per-record identifiers returned.
DO $$ BEGIN
 IF current_database()<>'taman_care' OR current_user<>'taman'
 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'V50_WRONG_DATABASE_OR_TRANSACTION_MODE'; END IF;
END $$;
WITH monthly AS MATERIALIZED (
 SELECT status,source_mode,source_domain,source_entity_type,source_entity_id,entry_type
 FROM public.finance_entries
 WHERE recognition_date >= date_trunc('month',current_date)::date
 AND recognition_date < (date_trunc('month',current_date)+interval '1 month')::date
 ORDER BY recognition_date,finance_entry_id
 LIMIT 10001
),duplicates AS (
 SELECT count(*) AS n FROM (
 SELECT source_domain,source_entity_type,source_entity_id,entry_type
 FROM monthly WHERE status='POSTED' AND source_mode='SYSTEM'
 AND source_domain IS NOT NULL AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL
 GROUP BY 1,2,3,4 HAVING count(*)>1
 ) q
)
SELECT to_char(current_date,'YYYY-MM') AS audited_month,
 count(*) AS sampled_rows,
 count(*) > 10000 AS truncated,
 count(*) FILTER(WHERE status='POSTED' AND source_mode='SYSTEM') AS posted_system,
 count(*) FILTER(WHERE status='POSTED' AND source_mode='MANUAL') AS posted_manual,
 count(*) FILTER(WHERE status='POSTED' AND (source_domain IS NULL OR source_entity_type IS NULL OR source_entity_id IS NULL)) AS posted_missing_source,
 count(*) FILTER(WHERE status='DRAFT') AS draft_count,
 count(*) FILTER(WHERE status='VOID') AS void_count,
 (SELECT n FROM duplicates) AS duplicate_system_origin_groups,
 'CHUA_DU_DU_LIEU' AS monthly_profit_state
FROM monthly;
