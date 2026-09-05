#!/usr/bin/env bash
# Every 15 minutes from cron: if the site or API is down, notify once per hour
# via NOTIFY_URL (read from backend/.env), and log recoveries.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NOTIFY_URL="$(grep -E '^NOTIFY_URL=' "$ROOT/backend/.env" 2>/dev/null | cut -d= -f2-)"
STATE="$ROOT/backend/logs/healthcheck.state"
mkdir -p "$(dirname "$STATE")"

fail=""
for u in "https://chrispeterkins.com/paschools/" "https://chrispeterkins.com/paschools/api/health"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$u" || echo 000)
  [[ "$code" == "200" ]] || fail="$fail $u=$code"
done

if [[ -n "$fail" ]]; then
  last=$(cat "$STATE" 2>/dev/null || echo 0)
  now=$(date +%s)
  echo "$(date -Is) DOWN:$fail"
  if [[ -n "$NOTIFY_URL" && $((now - last)) -gt 3600 ]]; then
    curl -s -o /dev/null -X POST -H "Title: PA School Data is down" -H "Priority: high" -d "Health check failed:$fail" "$NOTIFY_URL" && echo "$now" > "$STATE"
  fi
else
  if [[ -s "$STATE" ]]; then
    echo "$(date -Is) recovered"
    [[ -n "$NOTIFY_URL" ]] && curl -s -o /dev/null -X POST -H "Title: PA School Data recovered" -d "Site and API responding again." "$NOTIFY_URL"
    : > "$STATE"
  fi
fi
