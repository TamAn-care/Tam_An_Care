# M6 Nutrition — decisions required before durable workflow completion

The existing M6 branch has a durable resident meal-registration contract and
passing isolated policy/HTTP coverage. The repository does not contain an
approved durable contract for the following workflows. These decisions are
required before adding schema, API routes, or role permissions.

## Tray handover

- What is the canonical source object: a meal registration, a meal batch, or a
  dispatch document?
- Which approved roles may dispatch and receive, and which floor identifier is
  authoritative?
- What state transitions are allowed, and how are duplicate acknowledgements
  handled?
- Is quantity checked per resident, per meal, or per batch?

## Hygiene

- What is the approved checklist/task vocabulary and task reference?
- Which roles may record, amend, or only read a record?
- Are amendments append-only events, or may an authorized actor correct the
  current record?
- Which existing notes/evidence fields are mandatory?

## 24-hour food samples

- Is a sample linked to a meal registration, batch, or another existing
  Nutrition object?
- Which roles may collect, record retention, and record physical disposal?
- What statuses and evidence fields are approved?
- Is the retention deadline calculated from collection time, and what clock/
  timezone semantics apply?

Until these contracts are approved, the unresolved actions must remain
disabled-by-default. No production schema or data is changed by this document.
