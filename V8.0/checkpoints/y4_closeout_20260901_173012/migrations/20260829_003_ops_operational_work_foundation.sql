BEGIN;

CREATE TABLE operational_work_event_types (
    work_event_type_id text PRIMARY KEY,

    code text NOT NULL UNIQUE,

    display_name_vi text NOT NULL,

    category text NOT NULL,

    default_unit text NOT NULL,

    default_work_weight numeric(10,4)
        NOT NULL DEFAULT 1.0000,

    resident_related boolean
        NOT NULL DEFAULT true,

    inventory_link_allowed boolean
        NOT NULL DEFAULT false,

    active boolean
        NOT NULL DEFAULT true,

    created_at timestamptz
        NOT NULL DEFAULT now(),

    updated_at timestamptz
        NOT NULL DEFAULT now(),

    CONSTRAINT operational_work_event_types_code_ck
        CHECK (
            code ~ '^[A-Z][A-Z0-9_]*$'
        ),

    CONSTRAINT operational_work_event_types_weight_ck
        CHECK (
            default_work_weight > 0
        ),

    CONSTRAINT operational_work_event_types_category_ck
        CHECK (
            category IN (
                'PERSONAL_CARE',
                'HOUSEKEEPING',
                'LAUNDRY',
                'MOBILITY',
                'NUTRITION',
                'ACTIVITY',
                'OTHER'
            )
        )
);

CREATE TABLE operational_work_events (
    work_event_id text PRIMARY KEY,

    resident_id text NULL
        REFERENCES residents(resident_id)
        ON DELETE RESTRICT,

    work_event_type_id text NOT NULL
        REFERENCES operational_work_event_types(
            work_event_type_id
        )
        ON DELETE RESTRICT,

    source_domain text NOT NULL,

    source_entity_type text NULL,

    source_entity_id text NULL,

    planned_classification text NOT NULL,

    occurred_at timestamptz NOT NULL,

    started_at timestamptz NULL,

    completed_at timestamptz NULL,

    performed_by text NOT NULL
        REFERENCES staff_actors(actor_id)
        ON DELETE RESTRICT,

    performed_by_role text NOT NULL,

    quantity numeric(14,4)
        NOT NULL DEFAULT 1.0000,

    unit text NOT NULL,

    work_weight numeric(10,4)
        NOT NULL DEFAULT 1.0000,

    reason_code text NULL,

    note text NULL,

    status text NOT NULL
        DEFAULT 'COMPLETED',

    created_at timestamptz
        NOT NULL DEFAULT now(),

    CONSTRAINT operational_work_events_plan_ck
        CHECK (
            planned_classification IN (
                'PLANNED',
                'ADDITIONAL',
                'UNPLANNED'
            )
        ),

    CONSTRAINT operational_work_events_status_ck
        CHECK (
            status IN (
                'RECORDED',
                'VERIFIED',
                'COMPLETED',
                'AMENDED',
                'VOIDED'
            )
        ),

    CONSTRAINT operational_work_events_role_ck
        CHECK (
            performed_by_role IN (
                'CAREGIVER',
                'NURSE',
                'CARE_MANAGER',
                'SUPERVISOR'
            )
        ),

    CONSTRAINT operational_work_events_quantity_ck
        CHECK (
            quantity > 0
        ),

    CONSTRAINT operational_work_events_weight_ck
        CHECK (
            work_weight > 0
        ),

    CONSTRAINT operational_work_events_time_ck
        CHECK (
            (started_at IS NULL OR
             started_at <= occurred_at)
            AND
            (completed_at IS NULL OR
             started_at IS NULL OR
             completed_at >= started_at)
        ),

    CONSTRAINT operational_work_events_source_ck
        CHECK (
            (
                source_entity_type IS NULL
                AND source_entity_id IS NULL
            )
            OR
            (
                source_entity_type IS NOT NULL
                AND source_entity_id IS NOT NULL
            )
        )
);

CREATE INDEX idx_ops_work_event_type_active
    ON operational_work_event_types(
        active,
        category,
        code
    );

CREATE INDEX idx_ops_work_event_resident_time
    ON operational_work_events(
        resident_id,
        occurred_at DESC
    );

CREATE INDEX idx_ops_work_event_staff_time
    ON operational_work_events(
        performed_by,
        occurred_at DESC
    );

CREATE INDEX idx_ops_work_event_type_time
    ON operational_work_events(
        work_event_type_id,
        occurred_at DESC
    );

CREATE INDEX idx_ops_work_event_status_time
    ON operational_work_events(
        status,
        occurred_at DESC
    );

CREATE INDEX idx_ops_work_event_source
    ON operational_work_events(
        source_domain,
        source_entity_type,
        source_entity_id
    )
    WHERE source_entity_id IS NOT NULL;

CREATE UNIQUE INDEX uq_ops_work_event_source_type
    ON operational_work_events(
        source_domain,
        source_entity_type,
        source_entity_id,
        work_event_type_id
    )
    WHERE source_entity_id IS NOT NULL;

COMMIT;
