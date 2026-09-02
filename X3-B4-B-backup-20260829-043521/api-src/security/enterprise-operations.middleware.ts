type Bucket = {
  count: number;
  resetAt: number;
};

const buckets =
  new Map<string, Bucket>();

export function
enterpriseOperationsMiddleware(
  req: any,
  res: any,
  next: () => void,
): void {
  const now = Date.now();

  const configured =
    Number(
      process.env
        .RATE_LIMIT_PER_MINUTE ??
      600,
    );

  const limit =
    Number.isFinite(configured) &&
    configured > 0
      ? configured
      : 600;

  const key =
    String(
      req.headers?.[
        'x-actor-id'
      ] ??
      req.socket?.remoteAddress ??
      'anonymous',
    );

  const current =
    buckets.get(key);

  if (
    !current ||
    current.resetAt <= now
  ) {
    buckets.set(
      key,
      {
        count: 1,
        resetAt:
          now + 60_000,
      },
    );
  } else {
    current.count += 1;

    if (current.count > limit) {
      res.statusCode = 429;

      res.setHeader(
        'content-type',
        'application/json',
      );

      res.end(
        JSON.stringify({
          statusCode: 429,
          message:
            'Too many requests',
        }),
      );

      return;
    }
  }

  const started =
    process.hrtime.bigint();

  res.on(
    'finish',
    () => {
      const elapsed =
        Number(
          process.hrtime.bigint() -
          started,
        ) / 1_000_000;

      process.stdout.write(
        JSON.stringify({
          type:
            'http_request',
          timestamp:
            new Date()
              .toISOString(),
          requestId:
            req.headers?.[
              'x-request-id'
            ] ?? null,
          method:
            req.method ?? null,
          path:
            req.originalUrl ?? null,
          statusCode:
            res.statusCode,
          durationMs:
            Number(
              elapsed.toFixed(3),
            ),
          actorId:
            req.headers?.[
              'x-actor-id'
            ] ?? null,
        }) + '\n',
      );
    },
  );

  next();
}
