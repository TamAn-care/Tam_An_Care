-- TAMANCARE FINANCE FOUNDATION V2.2.1
-- DEVELOPMENT ONLY. NEVER AUTO-APPLY.
-- NO SEED, MOCK, DEMO OR BUSINESS ROWS.

BEGIN;

CREATE TABLE service_contract_records (
 contract_id text PRIMARY KEY,
 contract_code text NOT NULL UNIQUE,
 resident_id text NOT NULL,
 status text NOT NULL CHECK
  (status IN ('DRAFT','SIGNED','ACTIVE',
              'TERMINATED','CANCELLED')),
 effective_date date,
 payload jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1
  CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_invoices (
 invoice_id text PRIMARY KEY,
 invoice_code text NOT NULL UNIQUE,
 resident_id text NOT NULL,
 contract_id text REFERENCES service_contract_records(contract_id),
 billing_month date NOT NULL
  CHECK (EXTRACT(DAY FROM billing_month) = 1),
 status text NOT NULL CHECK
  (status IN ('DRAFT','APPROVED','ISSUED',
              'PARTIAL','PAID','VOID')),
 total_amount_vnd numeric(18,2) NOT NULL
  CHECK (total_amount_vnd >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_invoice_items (
 item_id text PRIMARY KEY,
 invoice_id text NOT NULL REFERENCES billing_invoices(invoice_id),
 description text NOT NULL,
 quantity numeric(18,4) NOT NULL CHECK (quantity >= 0),
 unit_price_vnd numeric(18,2) NOT NULL,
 line_total_vnd numeric(18,2) NOT NULL
);

CREATE TABLE billing_receipts (
 receipt_id text PRIMARY KEY,
 receipt_code text NOT NULL UNIQUE,
 resident_id text NOT NULL,
 amount_vnd numeric(18,2) NOT NULL CHECK (amount_vnd > 0),
 received_date date NOT NULL,
 status text NOT NULL CHECK
  (status IN ('DRAFT','CONFIRMED','VOID')),
 external_reference text,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_payment_allocations (
 allocation_id text PRIMARY KEY,
 receipt_id text NOT NULL REFERENCES billing_receipts(receipt_id),
 invoice_id text NOT NULL REFERENCES billing_invoices(invoice_id),
 amount_vnd numeric(18,2) NOT NULL CHECK (amount_vnd > 0),
 UNIQUE(receipt_id,invoice_id)
);

CREATE TABLE finance_source_links (
 source_domain text NOT NULL,
 source_type text NOT NULL,
 source_id text NOT NULL,
 posting_kind text NOT NULL,
 finance_entry_id text NOT NULL UNIQUE,
 PRIMARY KEY (source_domain,source_type,source_id,posting_kind)
);

COMMIT;