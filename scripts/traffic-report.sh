#!/usr/bin/env bash
# Nightly GoAccess report over the nginx access log, paschools requests only.
# No cookies, no client-side tracking: this is server-log page popularity for
# prioritising work. Served behind admin auth at /paschools/admin/traffic.
set -euo pipefail
OUT=/var/www/chrispeterkins.com/paschools/backend/logs
mkdir -p "$OUT"
zcat -f /var/log/nginx/access.log /var/log/nginx/access.log.1 /var/log/nginx/access.log.*.gz 2>/dev/null \
  | grep -a ' /paschools' \
  | grep -av ' /paschools/api/\| /paschools/assets/' \
  | goaccess - --log-format=COMBINED --no-query-string --ignore-crawlers --anonymize-ip \
      --html-report-title="PA School Data traffic" -o "$OUT/traffic.html" >/dev/null 2>&1
chmod 644 "$OUT/traffic.html"
