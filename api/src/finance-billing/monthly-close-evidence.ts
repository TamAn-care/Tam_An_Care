/**
 * Independent monthly closure evidence validator.
 * No writes, no default approval and no trust in client-supplied flags.
 * Evidence MUST be produced from independently reconciled canonical sources,
 * signed by an approved finance control process and checked against the
 * same immutable ledger snapshot. Until integrated: NEVER approve READY.
 */
export interface MonthlyCloseEvidence {
  month: string;
  snapshotDigest: string;
  sourceReconciliationDigest: string;
  approverId: string;
  approvalId: string;
  approvedAt: string;
  sourceCount: number;
  entryCount: number;
  completenessVerified: boolean;
  reconciliationVerified: boolean;
  approvalSignatureVerified: boolean;
}

export function verifyIndependentMonthlyClose(
  month: string,
  evidence: MonthlyCloseEvidence | null,
  observed: { entryCount: number; snapshotDigest: string },
): { verified: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!evidence) return { verified: false, reasons: ['MONTH_CLOSE_EVIDENCE_MISSING'] };
  if (evidence.month !== month ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(evidence.month))
    reasons.push('MONTH_CLOSE_PERIOD_MISMATCH');
  if (!/^[a-f0-9]{64}$/.test(evidence.snapshotDigest) ||
      !/^[a-f0-9]{64}$/.test(evidence.sourceReconciliationDigest) ||
      evidence.snapshotDigest !== observed.snapshotDigest)
    reasons.push('MONTH_CLOSE_DIGEST_MISMATCH');
  if (!Number.isSafeInteger(evidence.entryCount) ||
      evidence.entryCount !== observed.entryCount ||
      !Number.isSafeInteger(evidence.sourceCount) || evidence.sourceCount < 0)
    reasons.push('MONTH_CLOSE_COUNT_MISMATCH');
  if (evidence.completenessVerified !== true ||
      evidence.reconciliationVerified !== true)
    reasons.push('MONTH_CLOSE_RECONCILIATION_UNVERIFIED');
  if (evidence.approvalSignatureVerified !== true ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(evidence.approverId) ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(evidence.approvalId) ||
      Number.isNaN(Date.parse(evidence.approvedAt)))
    reasons.push('MONTH_CLOSE_APPROVAL_UNVERIFIED');
  return { verified: reasons.length === 0, reasons };
}
