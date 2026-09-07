#!/usr/bin/env bash
# Warm the nginx API cache and backend memo caches after a deploy or restart so
# the first visitors do not pay for the heavy queries (rankings, map points,
# data status, summary bundles). Safe to run any time; hits the live site
# through nginx so the proxy cache is filled as well.
#   scripts/warm-cache.sh            # warm against the live site
#   BASE=http://127.0.0.1:3000 scripts/warm-cache.sh   # backend only
set -u
BASE="${BASE:-https://chrispeterkins.com/paschools}"
RESOLVE=(--resolve chrispeterkins.com:443:127.0.0.1 -k)
year=$(curl -s "${RESOLVE[@]}" "$BASE/api/performance/years" | sed -n 's/.*"latest":\([0-9]\{4\}\).*/\1/p')
year="${year:-2025}"
urls=(
  "api/performance/years" "api/performance/data-status" "api/performance/imports" "api/health"
  "api/performance/state?year=$year" "api/performance/summary-bundle?level=state"
  "api/indicators/state"
  "api/performance/rankings?year=$year&examType=pssa&subject=Mathematics&limit=10&minTested=40"
  "api/performance/rankings?year=$year&examType=pssa&subject=English%20Language%20Arts&limit=10&minTested=40"
  "api/performance/rankings?year=$year&examType=pssa&entity=district&subject=Mathematics&limit=10&minTested=40"
  "api/schools/map?year=$year&exam=pssa&subject=Mathematics"
  "api/districts/map-values?year=$year&exam=pssa&subject=Mathematics"
  "api/schools/filters" "api/counties" "api/districts?limit=50" "api/indicators/spending"
  "feed.xml" "sitemap.xml"
)
ok=0; bad=0
for u in "${urls[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "${RESOLVE[@]}" "$BASE/$u")
  if [[ "$code" == "200" ]]; then ok=$((ok+1)); else bad=$((bad+1)); echo "  warm $code /$u"; fi
done
echo "warmed $ok url(s), $bad failed"
