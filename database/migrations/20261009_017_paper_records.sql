-- Tâm An Care — Paper record registry
-- Schema only. NO seed/demo/fake data.
BEGIN;

CREATE TABLE IF NOT EXISTS paper_records (
  paper_record_id TEXT PRIMARY KEY DEFAULT ('paper-record-' || gen_random_uuid()::text),
  resident_id TEXT NOT NULL UNIQUE REFERENCES residents(resident_id) ON DELETE CASCADE,
  record_code VARCHAR(64) NOT NULL UNIQUE,
  cabinet VARCHAR(120),
  drawer VARCHAR(120),
  position VARCHAR(160),
  status VARCHAR(32) NOT NULL DEFAULT 'STORED'
    CHECK (status IN ('STORED', 'BORROWED', 'RETURNED_TO_FAMILY', 'ARCHIVED')),
  current_borrower_actor_id TEXT,
  current_borrower_name VARCHAR(255),
  borrowed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  document_catalog JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_inventory_at DATE,
  qr_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(document_catalog) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_paper_records_status
  ON paper_records(status);

CREATE TABLE IF NOT EXISTS paper_record_loan_history (
  paper_record_loan_id TEXT PRIMARY KEY DEFAULT ('paper-loan-' || gen_random_uuid()::text),
  paper_record_id TEXT NOT NULL REFERENCES paper_records(paper_record_id) ON DELETE CASCADE,
  resident_id TEXT NOT NULL REFERENCES residents(resident_id) ON DELETE CASCADE,
  borrower_actor_id TEXT NOT NULL,
  borrower_name VARCHAR(255) NOT NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  returned_by_actor_id TEXT,
  returned_by_name VARCHAR(255),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_record_loan_history_resident
  ON paper_record_loan_history(resident_id, borrowed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_paper_record_open_loan
  ON paper_record_loan_history(paper_record_id)
  WHERE returned_at IS NULL;

COMMIT;
