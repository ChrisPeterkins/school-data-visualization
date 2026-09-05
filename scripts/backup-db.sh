#!/usr/bin/env bash
# Nightly SQLite backup with rotation: keep the newest 3 plus the first backup
# of each month. Backups live outside the repo so they are never committed.
#
#   scripts/backup-db.sh            # run as the webapp user from cron
set -euo pipefail

DB="/var/www/chrispeterkins.com/paschools/backend/school-data.db"
DEST="${BACKUP_DIR:-/var/backups/paschools}"
KEEP_RECENT="${KEEP_RECENT:-3}"

mkdir -p "$DEST"
stamp="$(date +%Y%m%d-%H%M%S)"
out="$DEST/school-data-$stamp.db"
sqlite3 "$DB" ".backup '$out'"
gzip -f "$out"
echo "$(date -Is) backed up to $out.gz ($(du -h "$out.gz" | cut -f1))"

# Rotation: newest N by name (timestamps sort), plus the earliest file per month.
mapfile -t all < <(ls -1 "$DEST"/school-data-*.db.gz 2>/dev/null | sort)
declare -A keep
n=${#all[@]}
for ((i = n - KEEP_RECENT; i < n; i++)); do [[ $i -ge 0 ]] && keep["${all[$i]}"]=1; done
declare -A seen_month
for f in "${all[@]}"; do
  m="$(basename "$f" | sed -E 's/school-data-([0-9]{6}).*/\1/')"
  if [[ -z "${seen_month[$m]:-}" ]]; then seen_month[$m]=1; keep["$f"]=1; fi
done
for f in "${all[@]}"; do
  if [[ -z "${keep[$f]:-}" ]]; then rm -f "$f"; echo "$(date -Is) pruned $(basename "$f")"; fi
done
