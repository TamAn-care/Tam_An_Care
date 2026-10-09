-- V3.8.10 isolated CI-only evidence metadata proposal. Not a production migration.
BEGIN;
CREATE TABLE finance_document_attachments (
 attachment_id text PRIMARY KEY CHECK(attachment_id ~ '^[A-Za-z0-9_-]{1,160}$'),
 document_id text NOT NULL REFERENCES finance_source_documents(document_id) ON DELETE RESTRICT,
 object_key text NOT NULL UNIQUE CHECK(object_key ~ '^finance/documents/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+[.](pdf|jpg|png)$'),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 byte_length bigint NOT NULL CHECK(byte_length BETWEEN 1 AND 10485760),
 content_type text NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png')),
 storage_state text NOT NULL DEFAULT 'PENDING' CHECK(storage_state IN ('PENDING','VERIFIED','QUARANTINED')),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 CHECK((storage_state='VERIFIED' AND verified_at IS NOT NULL)
    OR (storage_state<>'VERIFIED' AND verified_at IS NULL))
);
-- Never place binaries in PostgreSQL; back up the attachment object store independently.
CREATE FUNCTION finance_v3810_document_attachment_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.object_key NOT LIKE ('finance/documents/'||NEW.document_id||'/%')
 THEN RAISE EXCEPTION 'FINANCE_ATTACHMENT_CROSS_DOCUMENT_KEY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_v3810_attachment_scope
 BEFORE INSERT OR UPDATE ON finance_document_attachments
 FOR EACH ROW EXECUTE FUNCTION finance_v3810_document_attachment_guard();
REVOKE ALL ON finance_document_attachments FROM PUBLIC;
COMMIT;
