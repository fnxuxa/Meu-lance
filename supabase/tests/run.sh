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
for f in "$HERE"/../migrations/*.sql; do echo "migration: $(basename "$f")"; $P -1 -f "$f"; done
$P -f "$HERE/../seed.sql"
$P -f "$HERE/database.sql"
$P -f "$HERE/regressions.sql"
DB="$DB" bash "$HERE/concurrency.sh"
echo "TODOS OS TESTES DE BANCO PASSARAM"
