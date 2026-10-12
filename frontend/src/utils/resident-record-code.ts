/**
 * Pure display/validation functions only.
 * IMPORTANT: Never allocate an ID in the browser. Allocation must be an
 * atomic, durable server operation backed by a DB sequence/unique constraint.
 * issueYear is frozen at first allocation (VN-local year), not re-evaluated later.
 */
export interface ResidentRecordIdentity {
  /** Canonical positive serial, stored as decimal text to avoid JS integer limits. */
  serial: string;
  /** Issue year captured at allocation, yyyy. */
  issueYear: number;
  /** A short-stay trial without a contract is marked /TN. */
  isTrialWithoutContract: boolean;
}

export function formatResidentRecordCode(identity: ResidentRecordIdentity): string {
  const { serial, issueYear, isTrialWithoutContract } = identity;
  if (!/^[1-9][0-9]*$/.test(serial)) {
    throw new Error('Invalid resident record serial');
  }
  if (!Number.isInteger(issueYear) || issueYear < 1900 || issueYear > 9999) {
    throw new Error('Invalid issue year');
  }
  const padded = serial.padStart(4, '0');
  return `TA-${padded}/${issueYear}${isTrialWithoutContract ? '/TN' : ''}`;
}

/**
 * Legacy service-contract code shape: 001/2026/HĐDV-TA.
 * Validate an existing contract number without assigning a serial.
 * Both the resident record number and contract number must be linked to the
 * same canonical serial + issue year by the backend before /TN is removed.
 */
export function parseContractSerialAndYear(contractCode: string): {
  serial: string;
  issueYear: number;
} | null {
  const m = /^([0-9]+)\/([0-9]{4})\/HĐDV-TA$/.exec(contractCode.trim());
  if (!m || !/^[0-9]*[1-9][0-9]*$/.test(m[1])) return null;
  const serial = m[1].replace(/^0+(?=[0-9])/, '');
  const issueYear = Number(m[2]);
  if (issueYear < 1900) return null;
  return { serial, issueYear };
}

export function verifyContractMatchesResidentRecord(
  contractCode: string,
  identity: Pick<ResidentRecordIdentity, 'serial' | 'issueYear'>,
): boolean {
  const parsed = parseContractSerialAndYear(contractCode);
  return !!parsed && parsed.serial === identity.serial && parsed.issueYear === identity.issueYear;
}
