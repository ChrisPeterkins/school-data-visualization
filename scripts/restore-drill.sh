#!/usr/bin/env bash
# Monthly proof that the newest backup actually restores: gunzip it to a temp
# file, run an integrity check, count rows in the core tables, and compare
# with production. Notifies NOTIFY_URL (from backend/.env) on any failure.
set -uo pipefail
ROOT=/var/www/chrispeterkins.com/paschools
BACKUPS=/var/backups/paschools
LOG=$ROOT/backend/logs/restore-drill.log
NOTIFY_URL=$(grep -E '^NOTIFY_URL=' "$ROOT/backend/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
notify() { [[ -n "$NOTIFY_URL" ]] && curl -s -o /dev/null -X POST -H "Title: PA School Data restore drill" -H "Tags: floppy_disk" -d "$1" "$NOTIFY_URL" || true; }
latest=$(ls -t "$BACKUPS"/school-data-*.db.gz 2>/dev/null | head -1)
[[ -n "$latest" ]] || { echo "$(date -Is) no backup found" | tee -a "$LOG"; notify "Restore drill: no backup found in $BACKUPS"; exit 1; }
tmp=$(mktemp /tmp/paschools-restore-XXXXXX.db); trap 'rm -f "$tmp"' EXIT
start=$(date +%s)
if ! gunzip -c "$latest" > "$tmp"; then echo "$(date -Is) gunzip failed for $latest" | tee -a "$LOG"; notify "Restore drill FAILED: could not gunzip $latest"; exit 1; fi
integrity=$(sqlite3 "$tmp" 'PRAGMA integrity_check;' | head -1)
counts() { sqlite3 "$1" "SELECT (SELECT COUNT(*) FROM schools)||' schools, '||(SELECT COUNT(*) FROM districts)||' districts, '||(SELECT COUNT(*) FROM pssa_results)||' pssa, '||(SELECT COUNT(*) FROM keystone_results)||' keystone, '||(SELECT MAX(year) FROM pssa_results)||' latest';"; }
restored=$(counts "$tmp"); live=$(counts "$ROOT/backend/school-data.db")
secs=$(( $(date +%s) - start ))
msg="backup $(basename "$latest") ($(du -h "$latest" | cut -f1)) restored in ${secs}s; integrity=$integrity; restored: $restored; live: $live"
echo "$(date -Is) $msg" | tee -a "$LOG"
if [[ "$integrity" != "ok" ]]; then notify "Restore drill FAILED: integrity=$integrity ($latest)"; exit 1; fi
# The nightly backup should be at most a day behind production on row counts.
r=$(echo "$restored" | grep -o '^[0-9]*'); l=$(echo "$live" | grep -o '^[0-9]*')
if (( l > 0 && r * 100 < l * 95 )); then notify "Restore drill: backup has $r schools vs $l live"; exit 1; fi
exit 0
