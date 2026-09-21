# Runbook — MeuLance

## Segurança operacional

- `PAYMENTS_LIVE` permanece `false` até o checklist de go-live (`AGENTS.md` §16).
- Nunca registrar CPF, tokens, secrets ou dados completos de pagamento.
- Incidente de pagamento: pausar automações de liberação, preservar `payment_events`/`audit_log` e reconciliar com o provedor.
- Incidente de lance: não editar `bids` (imutável); investigar por `audit_log`/`fraud_signals`.

## Deploy

Frontend: Vercel (`vercel.json` já traz rewrites de SPA e cabeçalhos de segurança/CSP). Backend: Supabase. Separar local/staging/production.

## Primeira configuração do Supabase

1. Aplicar as migrations em ordem (`supabase db push`).
2. Auth → URL Configuration: cadastrar URL local e de produção.
3. Criar a conta do admin pelo app e rodar `psql "$DATABASE_URL" -v admin_email='seu@email.com' -f supabase/scripts/promote-admin.sql`.
4. Agendar o fechamento de leilões: `supabase/scripts/schedule-close-auctions.sql` (pg_cron) **ou** a Edge Function `close-auctions` a cada minuto com `Authorization: Bearer $CRON_SECRET` (mínimo 16 caracteres).
5. Storage: os buckets `listing-images`, `avatars` e `dispute-evidence` e suas policies são criados pela migration `hardening`.

## Testes de banco

`npm run test:db` cria um banco limpo, aplica as migrations sobre um stub mínimo do Supabase e roda `supabase/tests/database.sql` (RLS, privilégios, motor de lances) e `concurrency.sh` (lances simultâneos).
