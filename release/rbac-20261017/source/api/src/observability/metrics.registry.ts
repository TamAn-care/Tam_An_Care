type DurationState = {
  count: number;
  sum: number;
  max: number;
};

class ProcessMetricsRegistry {
  private readonly startedAt = new Date();

  private totalRequests = 0;
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private rateLimited429 = 0;

  private readonly duration: DurationState = {
    count: 0,
    sum: 0,
    max: 0,
  };

  recordHttp(
    statusCode: number,
    durationMs: number,
  ): void {
    this.totalRequests += 1;

    if (
      statusCode >= 200 &&
      statusCode < 300
    ) {
      this.status2xx += 1;
    }

    if (
      statusCode >= 400 &&
      statusCode < 500
    ) {
      this.status4xx += 1;
    }

    if (statusCode >= 500) {
      this.status5xx += 1;
    }

    if (statusCode === 429) {
      this.rateLimited429 += 1;
    }

    if (
      Number.isFinite(durationMs) &&
      durationMs >= 0
    ) {
      this.duration.count += 1;
      this.duration.sum += durationMs;
      this.duration.max =
        Math.max(
          this.duration.max,
          durationMs,
        );
    }
  }

  snapshot() {
    const average =
      this.duration.count === 0
        ? 0
        : this.duration.sum /
          this.duration.count;

    return {
      scope: 'process-local',
      processStartedAt:
        this.startedAt.toISOString(),
      uptimeSeconds:
        Math.floor(process.uptime()),

      http: {
        totalRequests:
          this.totalRequests,

        status2xx:
          this.status2xx,

        status4xx:
          this.status4xx,

        status5xx:
          this.status5xx,

        rateLimited429:
          this.rateLimited429,

        durationMs: {
          count:
            this.duration.count,

          sum:
            Number(
              this.duration.sum
                .toFixed(3),
            ),

          average:
            Number(
              average.toFixed(3),
            ),

          max:
            Number(
              this.duration.max
                .toFixed(3),
            ),
        },
      },
    };
  }
}

export const processMetrics =
  new ProcessMetricsRegistry();
