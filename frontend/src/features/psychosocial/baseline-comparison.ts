/**
 * Pure, server-independent comparison contract. Does not load or store resident data.
 * Periodic reports must compare against immutable baseline AND immediately prior report.
 */
export type DassDomain = 'D' | 'A' | 'S';
export type DomainScores = Record<DassDomain, number>;
export type ClinicalSnapshot = {
  residentId: string;
  recordId: string;
  assessedAt: string; // server-issued ISO timestamp
  assessment: Record<string, string | readonly string[] | null>;
  dass42: DomainScores | null; // null until all 42 responses complete
};
export type BaselineSnapshot = ClinicalSnapshot & { kind: 'BASELINE'; revision: number; finalizedAt: string };
export type PeriodicSnapshot = ClinicalSnapshot & { kind: 'PERIODIC'; baselineId: string; previousReportId: string | null };
export type FieldComparison = { field: string; baseline: string | readonly string[] | null; current: string | readonly string[] | null; previous: string | readonly string[] | null; changedSinceBaseline: boolean; changedSincePrevious: boolean | null };
export type DomainComparison = { domain: DassDomain; current: number; baseline: number; previous: number | null; deltaFromBaseline: number; deltaFromPrevious: number | null };
export type ComparisonResult = { residentId: string; baselineId: string; previousReportId: string | null; fields: FieldComparison[]; dass: DomainComparison[] | null };

function sameValue(a: string | readonly string[] | null, b: string | readonly string[] | null): boolean {
  return Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i])
    : a === b;
}
export function comparePsychosocialAssessments(baseline: BaselineSnapshot, current: PeriodicSnapshot, previous: PeriodicSnapshot | null): ComparisonResult {
  if (!baseline.finalizedAt || baseline.revision < 1) throw new Error('Baseline must be finalized');
  if (current.residentId !== baseline.residentId || current.baselineId !== baseline.recordId)
    throw new Error('Baseline link mismatch');
  if (previous && (previous.residentId !== current.residentId || previous.baselineId !== baseline.recordId || current.previousReportId !== previous.recordId))
    throw new Error('Previous report link mismatch');
  if (!previous && current.previousReportId !== null) throw new Error('Missing referenced prior report');
  if (previous && previous.assessedAt >= current.assessedAt) throw new Error('Previous report must predate current report');
  const fields = Array.from(new Set([...Object.keys(baseline.assessment), ...Object.keys(current.assessment), ...Object.keys(previous?.assessment || {})]))
    .sort().map(field => {
      const base = baseline.assessment[field] ?? null;
      const now = current.assessment[field] ?? null;
      const prior = previous?.assessment[field] ?? null;
      return { field, baseline: base, current: now, previous: prior, changedSinceBaseline: !sameValue(base, now), changedSincePrevious: previous ? !sameValue(prior, now) : null };
    });
  const dass = baseline.dass42 && current.dass42 && (!previous || previous.dass42)
    ? (['D', 'A', 'S'] as const).map(domain => ({
        domain, current: current.dass42![domain], baseline: baseline.dass42![domain],
        previous: previous ? previous.dass42![domain] : null,
        deltaFromBaseline: current.dass42![domain] - baseline.dass42![domain],
        deltaFromPrevious: previous ? current.dass42![domain] - previous.dass42![domain] : null,
      })) : null;
  return { residentId: current.residentId, baselineId: baseline.recordId, previousReportId: current.previousReportId, fields, dass };
}
