#!/bin/sh
echo "Running database migrations..."
npx prisma db push --accept-data-loss

echo "Starting backup daemon..."
# Run a background loop that copies dev.db every 24 hours to maintain a 7-day rolling backup
(
  while true; do
    DAY=$(date +%A)
    cp /data/dev.db /backups/backup_${DAY}.db
    echo "Backup completed for ${DAY}"
    
    # Sleep for 24 hours (86400 seconds) before next backup
    sleep 86400
  done
) &

echo "Starting Next.js server..."
exec node server.js
