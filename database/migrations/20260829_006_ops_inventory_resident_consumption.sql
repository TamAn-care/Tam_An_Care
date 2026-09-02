BEGIN;

CREATE TABLE inventory_items (
    inventory_item_id text PRIMARY KEY,
    code text NOT NULL UNIQUE,
    display_name_vi text NOT NULL,
    category text NOT NULL,
    base_unit text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT inventory_items_code_ck
        CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),

    CONSTRAINT inventory_items_category_ck
        CHECK (
            category IN (
                'PERSONAL_CARE',
                'HOUSEKEEPING',
                'LAUNDRY',
                'NUTRITION',
                'MEDICAL_SUPPLY',
                'GENERAL',
                'OTHER'
            )
        ),

    CONSTRAINT inventory_items_base_unit_ck
        CHECK (length(btrim(base_unit)) > 0)
);

CREATE TABLE inventory_lots (
    inventory_lot_id text PRIMARY KEY,

    inventory_item_id text NOT NULL
        REFERENCES inventory_items(inventory_item_id)
        ON DELETE RESTRICT,

    lot_code text NULL,
    received_at timestamptz NULL,
    expiry_date date NULL,
    supplier_reference text NULL,
    note text NULL,
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT inventory_lots_status_ck
        CHECK (
            status IN (
                'ACTIVE',
                'EXHAUSTED',
                'CLOSED',
                'QUARANTINED'
            )
        )
);

CREATE TABLE inventory_transactions (
    inventory_transaction_id text PRIMARY KEY,

    inventory_item_id text NOT NULL
        REFERENCES inventory_items(inventory_item_id)
        ON DELETE RESTRICT,

    inventory_lot_id text NULL
        REFERENCES inventory_lots(inventory_lot_id)
        ON DELETE RESTRICT,

    transaction_type text NOT NULL,

    quantity numeric(14,4) NOT NULL,

    unit text NOT NULL,

    occurred_at timestamptz NOT NULL,

    performed_by text NOT NULL
        REFERENCES staff_actors(actor_id)
        ON DELETE RESTRICT,

    performed_by_role text NOT NULL,

    source_domain text NOT NULL,
    source_entity_type text NULL,
    source_entity_id text NULL,

    reason_code text NULL,
    note text NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT inventory_transactions_type_ck
        CHECK (
            transaction_type IN (
                'RECEIPT',
                'ISSUE',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
                'RETURN_IN',
                'RETURN_OUT'
            )
        ),

    CONSTRAINT inventory_transactions_quantity_ck
        CHECK (quantity > 0),

    CONSTRAINT inventory_transactions_unit_ck
        CHECK (length(btrim(unit)) > 0),

    CONSTRAINT inventory_transactions_role_ck
        CHECK (
            performed_by_role IN (
                'CAREGIVER',
                'NURSE',
                'CARE_MANAGER',
                'SUPERVISOR'
            )
        ),

    CONSTRAINT inventory_transactions_source_ck
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

CREATE TABLE resident_consumption_events (
    resident_consumption_event_id text PRIMARY KEY,

    resident_id text NOT NULL
        REFERENCES residents(resident_id)
        ON DELETE RESTRICT,

    inventory_item_id text NOT NULL
        REFERENCES inventory_items(inventory_item_id)
        ON DELETE RESTRICT,

    inventory_lot_id text NULL
        REFERENCES inventory_lots(inventory_lot_id)
        ON DELETE RESTRICT,

    inventory_transaction_id text NOT NULL
        REFERENCES inventory_transactions(inventory_transaction_id)
        ON DELETE RESTRICT,

    work_event_id text NULL
        REFERENCES operational_work_events(work_event_id)
        ON DELETE RESTRICT,

    quantity numeric(14,4) NOT NULL,

    unit text NOT NULL,

    occurred_at timestamptz NOT NULL,

    recorded_by text NOT NULL
        REFERENCES staff_actors(actor_id)
        ON DELETE RESTRICT,

    recorded_by_role text NOT NULL,

    source_domain text NOT NULL,
    source_entity_type text NULL,
    source_entity_id text NULL,

    note text NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT resident_consumption_quantity_ck
        CHECK (quantity > 0),

    CONSTRAINT resident_consumption_unit_ck
        CHECK (length(btrim(unit)) > 0),

    CONSTRAINT resident_consumption_role_ck
        CHECK (
            recorded_by_role IN (
                'CAREGIVER',
                'NURSE',
                'CARE_MANAGER',
                'SUPERVISOR'
            )
        ),

    CONSTRAINT resident_consumption_source_ck
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

CREATE INDEX idx_inventory_items_active_category
    ON inventory_items(active, category, code);

CREATE INDEX idx_inventory_lots_item
    ON inventory_lots(inventory_item_id);

CREATE INDEX idx_inventory_lots_expiry
    ON inventory_lots(expiry_date)
    WHERE expiry_date IS NOT NULL;

CREATE INDEX idx_inventory_lots_status
    ON inventory_lots(status);

CREATE INDEX idx_inventory_tx_item_time
    ON inventory_transactions(
        inventory_item_id,
        occurred_at DESC
    );

CREATE INDEX idx_inventory_tx_lot_time
    ON inventory_transactions(
        inventory_lot_id,
        occurred_at DESC
    )
    WHERE inventory_lot_id IS NOT NULL;

CREATE INDEX idx_inventory_tx_staff_time
    ON inventory_transactions(
        performed_by,
        occurred_at DESC
    );

CREATE INDEX idx_inventory_tx_source
    ON inventory_transactions(
        source_domain,
        source_entity_type,
        source_entity_id
    )
    WHERE source_entity_id IS NOT NULL;

CREATE UNIQUE INDEX uq_inventory_tx_source_item_lot
    ON inventory_transactions(
        source_domain,
        source_entity_type,
        source_entity_id,
        inventory_item_id,
        COALESCE(inventory_lot_id, '')
    )
    WHERE source_entity_id IS NOT NULL;

CREATE INDEX idx_resident_consumption_resident_time
    ON resident_consumption_events(
        resident_id,
        occurred_at DESC
    );

CREATE INDEX idx_resident_consumption_item_time
    ON resident_consumption_events(
        inventory_item_id,
        occurred_at DESC
    );

CREATE INDEX idx_resident_consumption_transaction
    ON resident_consumption_events(
        inventory_transaction_id
    );

CREATE INDEX idx_resident_consumption_work_event
    ON resident_consumption_events(
        work_event_id
    )
    WHERE work_event_id IS NOT NULL;

CREATE INDEX idx_resident_consumption_source
    ON resident_consumption_events(
        source_domain,
        source_entity_type,
        source_entity_id
    )
    WHERE source_entity_id IS NOT NULL;

CREATE UNIQUE INDEX uq_resident_consumption_source_item_lot
    ON resident_consumption_events(
        source_domain,
        source_entity_type,
        source_entity_id,
        inventory_item_id,
        COALESCE(inventory_lot_id, '')
    )
    WHERE source_entity_id IS NOT NULL;

COMMIT;
