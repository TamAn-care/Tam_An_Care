-- Additive, isolated-only mapping workflow. No mapping values are seeded.
BEGIN;
CREATE TABLE public.finance_service_code_mappings (
  mapping_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  source_domain text NOT NULL CHECK (source_domain IN ('ROOM_TYPE','CARE_LEVEL','MEAL_PLAN','MEAL_CHARGE_TYPE')),
  source_entity_id text NOT NULL CHECK (length(trim(source_entity_id)) BETWEEN 1 AND 160),
  service_code text NOT NULL CHECK (service_code ~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'),
  service_scope text NOT NULL CHECK (
    (source_domain='ROOM_TYPE' AND service_scope='ROOM') OR
    (source_domain='CARE_LEVEL' AND service_scope='CARE') OR
    (source_domain IN ('MEAL_PLAN','MEAL_CHARGE_TYPE') AND service_scope='MEAL')
  ),
  price_list_id text NOT NULL,
  price_list_version integer NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SUPERSEDED')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_reason text,
  superseded_effective_from date,
  source_evidence_ref text,
  change_reason text NOT NULL CHECK (length(trim(change_reason)) BETWEEN 5 AND 1000),
  PRIMARY KEY (mapping_id,version),
  FOREIGN KEY (price_list_id,price_list_version)
    REFERENCES public.service_price_list_versions(price_list_id,version) ON DELETE RESTRICT,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (superseded_effective_from IS NULL OR superseded_effective_from > effective_from),
  CHECK ((status='DRAFT' AND submitted_by IS NULL AND submitted_at IS NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR (status='PENDING_APPROVAL' AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR (status IN ('APPROVED','REJECTED','SUPERSEDED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND length(trim(decision_reason))>=5))
);
CREATE INDEX finance_service_mapping_lookup
 ON public.finance_service_code_mappings(source_domain,source_entity_id,status,effective_from,effective_to);
CREATE TABLE public.finance_service_mapping_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mapping_id text NOT NULL,
  version integer NOT NULL,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATED','SUBMITTED','APPROVED','REJECTED','SUPERSEDED')),
  reason text NOT NULL,
  previous_version integer,
  source_evidence_ref text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mapping_id,version) REFERENCES public.finance_service_code_mappings(mapping_id,version) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION public.finance_service_mapping_guard()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE item jsonb; price_status text; price_from date; price_to date; prior_version integer; prior_source record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_DELETE_FORBIDDEN'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('finance-service-mapping-version:'||NEW.mapping_id,0));
    SELECT max(version) INTO prior_version FROM public.finance_service_code_mappings WHERE mapping_id=NEW.mapping_id;
    IF prior_version IS NULL AND NEW.version<>1 THEN RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_VERSION_SEQUENCE_INVALID'; END IF;
    IF prior_version IS NOT NULL THEN
      IF NEW.version<>prior_version+1 THEN RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_VERSION_SEQUENCE_INVALID'; END IF;
      SELECT source_domain,source_entity_id,service_scope INTO prior_source
        FROM public.finance_service_code_mappings WHERE mapping_id=NEW.mapping_id AND version=prior_version;
      IF (prior_source.source_domain,prior_source.source_entity_id,prior_source.service_scope)
         IS DISTINCT FROM (NEW.source_domain,NEW.source_entity_id,NEW.service_scope) THEN
        RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_VERSION_SOURCE_MISMATCH';
      END IF;
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status <> 'DRAFT' AND
    (NEW.source_domain,NEW.source_entity_id,NEW.service_code,NEW.service_scope,NEW.price_list_id,NEW.price_list_version,
     NEW.effective_from,NEW.effective_to,NEW.created_by,NEW.created_at,NEW.change_reason,NEW.source_evidence_ref)
    IS DISTINCT FROM
    (OLD.source_domain,OLD.source_entity_id,OLD.service_code,OLD.service_scope,OLD.price_list_id,OLD.price_list_version,
     OLD.effective_from,OLD.effective_to,OLD.created_by,OLD.created_at,OLD.change_reason,OLD.source_evidence_ref)
    AND NOT (OLD.status='APPROVED' AND NEW.status='SUPERSEDED'
      AND (NEW.superseded_effective_from IS NOT NULL)
      AND (NEW.source_domain,NEW.source_entity_id,NEW.service_code,NEW.service_scope,NEW.price_list_id,NEW.price_list_version,
           NEW.effective_from,NEW.effective_to,NEW.created_by,NEW.created_at,NEW.change_reason,NEW.source_evidence_ref)
          IS NOT DISTINCT FROM
          (OLD.source_domain,OLD.source_entity_id,OLD.service_code,OLD.service_scope,OLD.price_list_id,OLD.price_list_version,
           OLD.effective_from,OLD.effective_to,OLD.created_by,OLD.created_at,OLD.change_reason,OLD.source_evidence_ref)) THEN
    RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_IMMUTABLE';
  END IF;
    SELECT v.status, v.effective_from, v.effective_to, p.item INTO price_status,price_from,price_to,item
    FROM public.service_price_list_versions v
    LEFT JOIN LATERAL (
      SELECT e.value AS item FROM jsonb_array_elements(v.items) e(value)
       WHERE e.value->>'serviceCode'=NEW.service_code AND e.value->>'scope'=NEW.service_scope
       LIMIT 1
    ) p ON true
   WHERE v.price_list_id=NEW.price_list_id AND v.version=NEW.price_list_version;
  IF item IS NULL THEN RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_CODE_NOT_IN_PRICE_VERSION'; END IF;
  IF price_from>NEW.effective_from OR (price_to IS NOT NULL AND (NEW.effective_to IS NULL OR price_to<NEW.effective_to)) THEN
    RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_OUTSIDE_PRICE_EFFECTIVE_PERIOD';
  END IF;
  IF NEW.status='APPROVED' AND price_status<>'APPROVED' THEN
    RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_PRICE_VERSION_NOT_APPROVED';
  END IF;
  IF NEW.status='APPROVED' AND NEW.source_evidence_ref IS NULL THEN
    RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_SOURCE_EVIDENCE_REQUIRED';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status<>NEW.status AND NOT (
      (OLD.status='DRAFT' AND NEW.status='PENDING_APPROVAL') OR
      (OLD.status='PENDING_APPROVAL' AND NEW.status IN ('APPROVED','REJECTED')) OR
      (OLD.status='APPROVED' AND NEW.status='SUPERSEDED')) THEN
    RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_STATE_TRANSITION_FORBIDDEN';
  END IF;
  IF NEW.status='APPROVED' AND (TG_OP='INSERT' OR OLD.status='PENDING_APPROVAL') THEN
    IF NEW.decided_by=NEW.created_by OR NEW.decided_by=NEW.submitted_by THEN
      RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_APPROVAL_SEPARATION_REQUIRED';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('finance-service-mapping:'||NEW.source_domain||':'||NEW.source_entity_id||':'||NEW.service_scope,0));
    IF EXISTS (
      SELECT 1 FROM public.finance_service_code_mappings m
       WHERE m.status='APPROVED' AND (m.source_domain,m.source_entity_id,m.service_scope)=(NEW.source_domain,NEW.source_entity_id,NEW.service_scope)
         AND (m.mapping_id,m.version)<>(NEW.mapping_id,NEW.version)
         AND daterange(m.effective_from,COALESCE(LEAST(m.effective_to, m.superseded_effective_from-1),m.effective_to,'infinity'::date)+1,'[)')
             && daterange(NEW.effective_from,COALESCE(NEW.effective_to,'infinity'::date)+1,'[)')
    ) THEN RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_EFFECTIVE_CONFLICT'; END IF;
  END IF;
  IF NEW.status='SUPERSEDED' AND OLD.status='APPROVED' AND
     (NEW.superseded_effective_from IS NULL OR NEW.decided_by IS NULL OR NEW.decided_by=OLD.created_by) THEN
    RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_SUPERSEDE_INVALID';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_service_mapping_guard
 BEFORE INSERT OR UPDATE OR DELETE ON public.finance_service_code_mappings
 FOR EACH ROW EXECUTE FUNCTION public.finance_service_mapping_guard();
CREATE OR REPLACE FUNCTION public.finance_service_mapping_audit_write()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 INSERT INTO public.finance_service_mapping_audit(mapping_id,version,actor_id,actor_role,action,reason,previous_version,source_evidence_ref)
 VALUES(NEW.mapping_id,NEW.version,COALESCE(NEW.decided_by,NEW.submitted_by,NEW.created_by),
   COALESCE(NULLIF(current_setting('taman.finance_actor_role',true),''),'UNSET'),
   CASE WHEN NEW.status='PENDING_APPROVAL' THEN 'SUBMITTED' WHEN NEW.status='APPROVED' THEN 'APPROVED'
        WHEN NEW.status='REJECTED' THEN 'REJECTED' WHEN NEW.status='SUPERSEDED' THEN 'SUPERSEDED' ELSE 'CREATED' END,
   COALESCE(NEW.decision_reason,NEW.change_reason),
   CASE WHEN TG_OP='UPDATE' THEN OLD.version
        ELSE (SELECT max(v.version) FROM public.finance_service_code_mappings v WHERE v.mapping_id=NEW.mapping_id AND v.version<NEW.version) END,
   NEW.source_evidence_ref);
 RETURN NEW;
END $fn$;
CREATE TRIGGER finance_service_mapping_audit_on_insert
 AFTER INSERT ON public.finance_service_code_mappings FOR EACH ROW EXECUTE FUNCTION public.finance_service_mapping_audit_write();
CREATE TRIGGER finance_service_mapping_audit_on_state
 AFTER UPDATE OF status ON public.finance_service_code_mappings FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION public.finance_service_mapping_audit_write();
CREATE OR REPLACE FUNCTION public.finance_service_mapping_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RAISE EXCEPTION 'FINANCE_SERVICE_MAPPING_AUDIT_IMMUTABLE'; END $fn$;
CREATE TRIGGER finance_service_mapping_audit_immutable_guard
 BEFORE UPDATE OR DELETE ON public.finance_service_mapping_audit FOR EACH ROW EXECUTE FUNCTION public.finance_service_mapping_audit_immutable();
COMMIT;
