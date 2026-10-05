#!/bin/sh
set -e

echo "====================================================="
echo " HealthHUD container starting"
echo "====================================================="

# Make sure the persistent data folder exists
mkdir -p /data /backups

echo "[1/3] Creating / updating database tables at /data/dev.db ..."
# Use the global Prisma CLI pinned in the Dockerfile (must match @prisma/client).
# --skip-generate: the client was already generated at build time.
if prisma db push --schema ./prisma/schema.prisma --skip-generate --accept-data-loss; then
  echo "      Database ready."
else
  echo "!!! DATABASE SETUP FAILED - the app cannot save anything until this is fixed."
  echo "!!! Copy the error above and share it."
  exit 1
fi

echo "[2/4] Starting backup daemon (daily copy to /backups)..."
(
  while true; do
    DAY=$(date +%A)
    if [ -f /data/dev.db ]; then
      cp /data/dev.db "/backups/backup_${DAY}.db" && echo "Backup completed for ${DAY}"
    fi
    sleep 86400
  done
) &

echo "[3/4] Starting Withings background sync daemon (runs every 15 minutes)..."
(
  # Wait 20 seconds for the web server to start up
  sleep 20
  while true; do
    wget -q -O - "http://127.0.0.1:${PORT:-3000}/api/cron/withings" >/dev/null 2>&1 || true
    sleep 900
  done
) &

echo "[4/4] Starting HealthHUD web server on port ${PORT:-3000}..."
exec node server.js
