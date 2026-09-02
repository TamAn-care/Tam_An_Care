import { Injectable, BadRequestException } from '@nestjs/common';

type Observation = {
  date: string;
  weightKg?: number;
  foodFluidIntakePercent?: number;
  sleepHours?: number;
  spo2?: number;
  mobility?: string;
};

type WarningPattern = {
  patternId: string;
  type: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH';
  metrics: string[];
  message: string;
  evidence: any;
};

const n = (x: any): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;

const pct = (a: number, b: number): number =>
  a === 0 ? 0 : ((b - a) / a) * 100;

@Injectable()
export class EarlyWarningService {

  analyze(data: any) {

    const series: Observation[] =
      Array.isArray(data?.observations)
        ? data.observations
        : Array.isArray(data?.longitudinalObservations)
          ? data.longitudinalObservations
          : [];

    const sorted = [...series]
      .filter(x => x && typeof x.date === 'string')
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length < 3) {
      return {
        engine: 'health-trend-early-warning',
        version: '7.4.1',
        status: 'INSUFFICIENT_DATA',
        warningLevel: 'UNKNOWN',
        confidence: null,
        patterns: [],
        recommendation:
          'Collect at least 3 dated observations before early-warning pattern analysis.',
        dataPoints: sorted.length,
        minDataPoints: 3,
        humanReviewRequired: true,
        autonomousClinicalAction: false
      };
    }

    const patterns: WarningPattern[] = [];

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const addPattern = (
      patternId: string,
      type: string,
      severity: 'LOW' | 'MODERATE' | 'HIGH',
      metrics: string[],
      message: string,
      evidence: any
    ) => {
      patterns.push({
        patternId,
        type,
        severity,
        metrics,
        message,
        evidence
      });
    };

    /*
     * 1. PERSISTENT DECLINE
     */
    const declineMetric = (
      metric: keyof Observation,
      label: string
    ) => {

      const values = sorted
        .map(o => n(o[metric]))
        .filter((v): v is number => v !== undefined);

      if (values.length < 3) return;

      let decliningSteps = 0;

      for (let i = 1; i < values.length; i++) {
        if (values[i] < values[i - 1]) {
          decliningSteps++;
        }
      }

      if (decliningSteps >= values.length - 2) {

        const change = pct(values[0], values[values.length - 1]);

        if (change <= -15) {
          addPattern(
            `${String(metric)}-persistent`,
            'PERSISTENT_DECLINE',
            'HIGH',
            [String(metric)],
            `${label} shows a persistent downward pattern.`,
            {
              baseline: values[0],
              current: values[values.length - 1],
              changePercent: Number(change.toFixed(2)),
              decliningSteps,
              observations: values.length
            }
          );
        } else if (change <= -5) {
          addPattern(
            `${String(metric)}-persistent`,
            'PERSISTENT_DECLINE',
            'MODERATE',
            [String(metric)],
            `${label} shows a persistent downward pattern.`,
            {
              baseline: values[0],
              current: values[values.length - 1],
              changePercent: Number(change.toFixed(2)),
              decliningSteps,
              observations: values.length
            }
          );
        }
      }
    };

    declineMetric('weightKg', 'Weight');
    declineMetric('foodFluidIntakePercent', 'Food/fluid intake');
    declineMetric('sleepHours', 'Sleep duration');
    declineMetric('spo2', 'SpO2');

    /*
     * 2. ACCELERATION
     */
    const accelerationMetric = (
      metric: keyof Observation,
      label: string
    ) => {

      const values = sorted
        .map(o => n(o[metric]))
        .filter((v): v is number => v !== undefined);

      if (values.length < 4) return;

      const midpoint = Math.floor(values.length / 2);

      const firstHalf = values.slice(0, midpoint);
      const secondHalf = values.slice(midpoint);

      const avgChange = (arr: number[]) => {
        if (arr.length < 2) return 0;

        let total = 0;

        for (let i = 1; i < arr.length; i++) {
          total += arr[i] - arr[i - 1];
        }

        return total / (arr.length - 1);
      };

      const early = avgChange(firstHalf);
      const recent = avgChange(secondHalf);

      if (early < 0 && recent < early) {

        addPattern(
          `${String(metric)}-acceleration`,
          'ACCELERATING_DECLINE',
          'HIGH',
          [String(metric)],
          `${label} is deteriorating faster in the recent observation period.`,
          {
            earlyAverageChange: Number(early.toFixed(3)),
            recentAverageChange: Number(recent.toFixed(3))
          }
        );
      }
    };

    accelerationMetric('weightKg', 'Weight');
    accelerationMetric('foodFluidIntakePercent', 'Food/fluid intake');
    accelerationMetric('sleepHours', 'Sleep duration');
    accelerationMetric('spo2', 'SpO2');

    /*
     * 3. MOBILITY DETERIORATION
     */
    if (first.mobility && last.mobility) {

      const rank = (x: string) =>
        x === 'INDEPENDENT' ? 0 :
        x === 'SUPERVISION' ? 1 :
        x === 'ASSISTED' ? 2 :
        x === 'HIGH_ASSISTANCE' ? 3 :
        4;

      const mobilityChange =
        rank(last.mobility) - rank(first.mobility);

      if (mobilityChange > 0) {

        addPattern(
          'mobility-deterioration',
          'MOBILITY_DETERIORATION',
          mobilityChange >= 2 ? 'HIGH' : 'MODERATE',
          ['mobility'],
          'Mobility assistance requirement has increased.',
          {
            baseline: first.mobility,
            current: last.mobility,
            rankChange: mobilityChange
          }
        );
      }
    }

    /*
     * 4. MULTI-SIGNAL CONVERGENCE
     */
    const uniqueMetrics = new Set<string>();

    for (const pattern of patterns) {
      for (const metric of pattern.metrics) {
        uniqueMetrics.add(metric);
      }
    }

    if (uniqueMetrics.size >= 3) {

      addPattern(
        'multi-signal-convergence',
        'MULTI_SIGNAL_CONVERGENCE',
        uniqueMetrics.size >= 4 ? 'HIGH' : 'MODERATE',
        Array.from(uniqueMetrics),
        'Multiple health domains show concurrent warning signals.',
        {
          signalCount: uniqueMetrics.size,
          metrics: Array.from(uniqueMetrics)
        }
      );
    }

    /*
     * 5. WARNING LEVEL
     */
    const high = patterns.filter(p => p.severity === 'HIGH').length;
    const moderate = patterns.filter(p => p.severity === 'MODERATE').length;

    const warningLevel =
      high >= 2
        ? 'HIGH'
        : high === 1 || moderate >= 2
          ? 'MODERATE'
          : patterns.length > 0
            ? 'LOW'
            : 'NONE';

    const confidence = Number(
      Math.min(
        0.95,
        0.60 +
        Math.min(0.20, sorted.length * 0.03) +
        Math.min(0.15, patterns.length * 0.03)
      ).toFixed(2)
    );

    return {
      engine: 'health-trend-early-warning',
      version: '7.4.1',
      status: 'ANALYSIS_COMPLETE',
      warningLevel,
      confidence,
      patterns,
      patternCount: patterns.length,
      metricsAffected: Array.from(uniqueMetrics),
      period: {
        from: first.date,
        to: last.date
      },
      dataPoints: sorted.length,
      recommendation:
        patterns.length > 0
          ? 'Prioritize human care-team review of detected early-warning patterns.'
          : 'Continue routine monitoring; reassess if new warning signals appear.',
      humanReviewRequired: true,
      humanReviewStatus: 'PENDING',
      autonomousClinicalAction: false,
      audit: {
        required: true
      }
    };
  }
}
