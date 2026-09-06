#!/usr/bin/env bash
# Build and deploy both apps with a rollback path, then smoke-test the live site.
#
#   scripts/deploy.sh            # build, deploy, restart, smoke check
#   scripts/deploy.sh --e2e      # also run the Playwright end-to-end checks
#   scripts/deploy.sh --rollback # restore the previous frontend build
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--rollback" ]]; then
  [[ -d frontend/dist-prev ]] || { echo "no previous build to roll back to"; exit 1; }
  rm -rf frontend/dist && mv frontend/dist-prev frontend/dist
  echo "frontend rolled back"; exit 0
fi

echo "== typecheck + tests"
npm run typecheck --workspaces --if-present
npm test --workspaces --if-present

echo "== backend"
npm run build -w backend

echo "== frontend (built beside the live one, then swapped)"
( cd frontend && rm -rf dist-new && npx vite build --outDir dist-new \
  && find dist-new/assets -type f \( -name '*.js' -o -name '*.css' -o -name '*.geojson' \) -exec gzip -kf9 {} \; )
node scripts/perf-budget.mjs frontend/dist-new || { echo 'size budget exceeded; not deploying'; exit 1; }
rm -rf frontend/dist-prev
mv frontend/dist frontend/dist-prev
mv frontend/dist-new frontend/dist
chown -R webapp:webapp frontend/dist backend/dist 2>/dev/null || true

echo "== restart backend"
supervisorctl restart paschools
sleep 3
# Drop nginx's API cache so the deploy is visible immediately.
rm -rf /var/cache/nginx/paschools/* 2>/dev/null || true

echo "== smoke"
for u in "" "api/health" "api/performance/years" "api/schools?limit=1" "sitemap.xml" "robots.txt"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --resolve chrispeterkins.com:443:127.0.0.1 -k "https://chrispeterkins.com/paschools/$u")
  printf "  %-30s %s\n" "/$u" "$code"
  [[ "$code" == "200" ]] || { echo "smoke check failed on /$u; run scripts/deploy.sh --rollback"; exit 1; }
done

if [[ "${1:-}" == "--layout" || "${1:-}" == "--e2e" ]]; then
  echo "== end-to-end checks against the live site"
  BASE=https://chrispeterkins.com/paschools RESOLVE=127.0.0.1 PLAYWRIGHT_MODULES="$ROOT/node_modules" node scripts/e2e.mjs
fi
echo "deployed $(git rev-parse --short HEAD)"
