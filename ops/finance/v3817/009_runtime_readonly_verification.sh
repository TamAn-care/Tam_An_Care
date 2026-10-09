#!/usr/bin/env bash
# V3.8.17.9 — no-write runtime inspection. Run only on Tâm An server.
set -euo pipefail
echo "V3817_9_MODE=READ_ONLY"
echo "UTC=$(date -u +%FT%TZ)"
for name in tamancare-production-test-server-api-1 tamancare-production-test-server-frontend-1; do
  echo "CONTAINER=$name"
  docker inspect --format 'IMAGE_ID={{.Image}} IMAGE_REF={{.Config.Image}} STATUS={{.State.Status}}' "$name" || exit 1
  image_id=$(docker inspect --format '{{.Image}}' "$name")
  echo "IMAGE_BUILD_METADATA (labels only)"
  docker image inspect --format '{{json .Config.Labels}}' "$image_id" || true
done
echo "GIT_REPRODUCIBILITY=UNVERIFIED_UNTIL_SOURCE_AND_BUILD_MANIFEST_MATCH"
echo "FINANCE_HTTP_ROUTES=UNVERIFIED_UNTIL_AUTHENTICATED_CONTROLLED_TEST"
echo "BILLING_MOCK_RUNTIME=UNVERIFIED_UNTIL_ACTIVE_BUNDLE_REVIEW"
echo "PRODUCTION_GO_NO_GO=NO_GO"
echo "DATABASE_WRITE=NO"
echo "MIGRATION=NO"
echo "SEED=NO"
echo "DEPLOY=NO"
echo "RESTART=NO"
echo "DOCKER_VOLUME_CHANGE=NO"
echo "BACKUP_CHANGE=NO"
echo "RESULT=TAMANCARE_FINANCE_V3817_9_RUNTIME_METADATA_COLLECTED"
