# API Scale-Out Guard

Current accepted production topology: one API instance.

The in-memory rate limiter and process-local metrics are not distributed.

Before API replica count may exceed one, TamAnCare requires:

1. shared rate-limit architecture;
2. aggregated observability design;
3. failure-mode definition;
4. configuration and secret design;
5. concurrency acceptance;
6. controlled production release acceptance.

Until those gates pass, production API replica count greater than one is an
unsupported configuration.

This rule is an API topology guard. It is not a resident capacity limit.
