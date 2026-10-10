-- V3.8.18.51 — live three-month Finance ledger diagnostic, READ ONLY.
-- Run ONLY inside BEGIN TRANSACTION READ ONLY with operator-verified host/container.
DO $$ BEGIN
 IF current_database()<>'taman_care' OR current_user<>'taman'
 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'WRONG_DB_OR_NOT_READ_ONLY'; END IF;
END $$;
WITH periods AS (
 SELECT generate_series(
   (date_trunc('month',current_date)-interval '2 months')::date,
   date_trunc('month',current_date)::date,interval '1 month')::date AS start_at
), sampled AS MATERIALIZED (
 SELECT p.start_at,e.status,e.source_mode,e.source_domain,e.source_entity_type,
        e.source_entity_id,e.entry_type
 FROM periods p
 CROSS JOIN LATERAL (
  SELECT status,source_mode,source_domain,source_entity_type,source_entity_id,entry_type
  FROM public.finance_entries
  WHERE recognition_date>=p.start_at
    AND recognition_date<(p.start_at+interval '1 month')
  ORDER BY recognition_date,finance_entry_id
  LIMIT 10001
 ) e
), grouped AS (
 SELECT start_at,count(*) AS rows_checked,
 count(*)>10000 AS truncated,
 count(*) FILTER(WHERE status='POSTED' AND source_mode='SYSTEM') AS posted_system,
 count(*) FILTER(WHERE status='POSTED' AND source_mode='MANUAL') AS posted_manual,
 count(*) FILTER(WHERE status='POSTED' AND (source_domain IS NULL OR source_entity_type IS NULL OR source_entity_id IS NULL)) AS posted_missing_source,
 count(*) FILTER(WHERE status='DRAFT') AS drafts,
 count(*) FILTER(WHERE status='VOID') AS voids
 FROM sampled GROUP BY start_at
), duplicate_groups AS (
 SELECT start_at,count(*) AS n FROM (
 SELECT start_at,source_domain,source_entity_type,source_entity_id,entry_type
 FROM sampled WHERE status='POSTED' AND source_mode='SYSTEM'
 AND source_domain IS NOT NULL AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL
 GROUP BY 1,2,3,4,5 HAVING count(*)>1
 ) q GROUP BY start_at
)
SELECT to_char(p.start_at,'YYYY-MM') AS month,
 COALESCE(g.rows_checked,0) AS sampled_rows,
 COALESCE(g.truncated,false) AS truncated,
 COALESCE(g.posted_system,0) AS posted_system,
 COALESCE(g.posted_manual,0) AS posted_manual,
 COALESCE(g.posted_missing_source,0) AS posted_missing_source,
 COALESCE(g.drafts,0) AS draft_count,
 COALESCE(g.voids,0) AS void_count,
 COALESCE(d.n,0) AS duplicate_system_origin_groups,
 'CHUA_DU_DU_LIEU' AS profit_state
FROM periods p LEFT JOIN grouped g USING(start_at)
LEFT JOIN duplicate_groups d USING(start_at)
ORDER BY p.start_at;
