#!/usr/bin/env bash
# Aplica stub + migrations num Postgres limpo e roda os testes SQL e o teste de concorrência.
# Uso local:  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DB="${TEST_DB:-meulance_test}"
[[ "$DB" =~ ^meulance_test(_[a-zA-Z0-9_]+)?$ ]] || { echo "Use somente banco de teste meulance_test*"; exit 1; }
psql -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
$P -f "$HERE/00_supabase_stub.sql"
HAS_CRON=$($P -tA -c "select count(*) from pg_available_extensions where name='pg_cron'")
for f in "$HERE"/../migrations/*.sql; do
  # Postgres de CI não traz pg_cron; o agendamento só é validado no Supabase.
  if [ "$HAS_CRON" = 0 ] && grep -qiE 'pg_cron|cron.job' "$f"; then echo "migration: $(basename "$f") (ignorada: pg_cron indisponível)"; continue; fi
  echo "migration: $(basename "$f")"; $P -1 -f "$f"
done
$P -f "$HERE/../seed.sql"
$P -f "$HERE/database.sql"
$P -f "$HERE/regressions.sql"
$P -f "$HERE/features.sql"
DB="$DB" bash "$HERE/concurrency.sh"
echo "TODOS OS TESTES DE BANCO PASSARAM"
