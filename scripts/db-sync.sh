#!/usr/bin/env bash
# Синхронизация схемы и сид (Linux/macOS/VPS). Из корня репозитория:
#   chmod +x scripts/db-sync.sh && ./scripts/db-sync.sh
# Или: npm run db:sync
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== ClientSay: prisma db push + db seed ==="
npx prisma db push
npx prisma db seed
echo "=== Готово ==="
