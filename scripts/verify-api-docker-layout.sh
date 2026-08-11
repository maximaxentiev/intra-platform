#!/usr/bin/env bash
# Assert the API production image matches the runtime contract used by apps/api/Dockerfile.
set -euo pipefail

IMAGE="${1:-intra-ops-test-api}"

docker run --rm --entrypoint sh "$IMAGE" -lc '
  set -e
  test -f /app/dist/main.js
  test -f /app/dist/db/migrate.js
  test -f /app/packages/shared/dist/index.js
  node -e "require(\"@intra/shared\"); console.log(\"@intra/shared ok\")"
  echo "API Docker layout OK"
'
