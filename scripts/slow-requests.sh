#!/usr/bin/env bash
# Weekly digest of slow (>1s) and failed API requests from the backend log,
# posted to NOTIFY_URL so query regressions show up before visitors complain.
set -uo pipefail
ROOT=/var/www/chrispeterkins.com/paschools
NOTIFY_URL=$(grep -E '^NOTIFY_URL=' "$ROOT/backend/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
LOGS=$(ls /var/log/paschools-backend.out.log* 2>/dev/null)
[[ -n "$LOGS" ]] || { echo "no backend log"; exit 0; }
since=$(date -d '7 days ago' +%s000)
report=$(cat $LOGS | grep -a '"msg":"\(slow request\|request failed\)"' | python3 -c "
import sys, json, collections, re
since = int(sys.argv[1]); slow = collections.defaultdict(list); failed = collections.Counter()
for line in sys.stdin:
    try: d = json.loads(line)
    except Exception: continue
    if d.get('time', 0) < since: continue
    route = re.sub(r'\d+', ':id', d.get('url', '').split('?')[0])
    if d.get('msg') == 'slow request': slow[route].append(d.get('ms', 0))
    else: failed[route] += 1
lines = []
for route, ms in sorted(slow.items(), key=lambda kv: -len(kv[1]))[:10]:
    ms.sort(); lines.append(f'{len(ms):4d} slow  p50 {ms[len(ms)//2]:5.0f} ms  max {ms[-1]:5.0f} ms  {route}')
for route, n in failed.most_common(5): lines.append(f'{n:4d} failed  {route}')
print('\n'.join(lines) if lines else 'No slow (>1s) or failed API requests this week.')
" "$since")
echo "$report"
[[ -n "$NOTIFY_URL" ]] && curl -s -o /dev/null -X POST -H "Title: PA School Data weekly API digest" -H "Tags: stopwatch" -d "$report" "$NOTIFY_URL" || true
