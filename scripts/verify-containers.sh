#!/usr/bin/env bash
set -euo pipefail
if [[ -f .env ]]; then
  echo 'Container verification requires a clean checkout without an existing .env.' >&2
  exit 1
fi
PROVIEW_VERIFY_PROJECT="proview_verify_$(date +%s)_$$"
mkdir -p test-results
cleanup() {
  docker compose -p "$PROVIEW_VERIFY_PROJECT" --profile production logs --no-color > test-results/containers.log 2>&1 || true
  docker compose -p "$PROVIEW_VERIFY_PROJECT" --profile production down --volumes --remove-orphans > /dev/null 2>&1 || true
  rm -f .env
}
trap cleanup EXIT
cat > .env <<'ENV'
NODE_ENV=production
APP_ENV=local
PORT=3001
POSTGRES_USER=proview
POSTGRES_PASSWORD=container_test
POSTGRES_DB=proview
DATABASE_URL=postgresql://proview:container_test@127.0.0.1:5432/proview?schema=public
JWT_ACCESS_SECRET=container-test-only-private-verification-key-12345678901234567890
FRONTEND_URL=http://localhost:8080
COOKIE_SECURE=false
ENABLE_API_DOCS=false
SEED_DEMO=false
STORAGE_DRIVER=s3
STORAGE_LOCAL_PATH=/app/.data/files
MAX_UPLOAD_BYTES=20971520
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=proview-private
S3_ACCESS_KEY_ID=proview_storage
S3_SECRET_ACCESS_KEY=container_test_storage_password
S3_FORCE_PATH_STYLE=true
MINIO_ROOT_USER=proview_storage
MINIO_ROOT_PASSWORD=container_test_storage_password
LOCAL_PROXY_PORT=8080
ENV
compose() { docker compose -p "$PROVIEW_VERIFY_PROJECT" --profile production "$@"; }
compose config --quiet
compose build api web minio minio-init
compose up -d --wait postgres minio
compose run --rm minio-init
compose run --rm api node scripts/prisma.cjs migrate deploy
compose run --rm -e SEED_DEMO=true api node scripts/prisma.cjs db seed
compose run --rm -e SEED_DEMO=true api node scripts/prisma.cjs db seed
compose up -d --wait api web proxy
export SMOKE_API_URL=http://127.0.0.1:8080
export API_TEST_URL=http://127.0.0.1:8080/api/v1
export FRONTEND_URL=http://localhost:8080
export WEB_TEST_URL=http://localhost:8080
export APP_ENV=test
export DATABASE_URL=postgresql://proview:container_test@127.0.0.1:5432/proview?schema=public
node scripts/acceptance-courses-submissions.mjs
compose restart api
compose up -d --wait api
node scripts/acceptance-auth-grading-archive.mjs
compose restart api
compose up -d --wait api
RUN_HTTP_TESTS=true pnpm --filter @proview/api exec node --import tsx --test test/review-http.test.ts
compose restart api
compose up -d --wait api
pnpm exec playwright test --grep-invert '@lifecycle'
compose restart api
compose up -d --wait api
pnpm exec playwright test --grep '@lifecycle'
PROVIEW_VERIFY_PRIVATE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9000/proview-private/demo/active-group-1-submission-1-v1.pdf)
[[ "$PROVIEW_VERIFY_PRIVATE_STATUS" == 403 ]]
echo 'PASS production API/web/PostgreSQL/Nginx/MinIO containers, S3 PDFs and denied anonymous object access.'
