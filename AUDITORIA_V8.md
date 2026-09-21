> Documento histórico de um ZIP anterior. Para o resultado atual, leia [docs/REVISAO.md](docs/REVISAO.md).

# Auditoria v8 corrigida

Base utilizada: `MeuLance-v7-parte1.zip` (a versão refeita pelo Claude), não a v6 problemática.

## Correções aplicadas

- Componentes v5/v6 que existiam mas não eram usados foram integrados nas rotas reais.
- `endsAt` dos mocks agora é ISO válido; antes continha texto como `Hoje, 21:40`, incompatível com `new Date()` do contador.
- IDs mock agora têm formato UUID para não quebrar imediatamente contratos que esperam UUID.
- Página de anúncio ganhou galeria navegável de 5 imagens.
- Lance ao vivo ganhou contagem inicial, feedback e botões rápidos que chamam RPC quando Supabase está configurado.
- Sem Supabase, a UI informa explicitamente que está em demonstração em vez de fingir que enviou lance.
- Recuperação de senha, Central de Lances e Admin agora têm rotas reais.
- Criação de anúncio comprime imagens, limita 10, mostra preview/capa e exige 3 fotos antes de avançar.
- Busca passou a filtrar texto/categoria e ganhou estado vazio.
- PWA agora é registrada em `main.tsx`.
- Corrigida key ausente no map de cards do Admin.
- Removido import não utilizado no Admin.
- Linguagem de pagamento foi ajustada para não prometer retenção/escrow não homologado.

## Validação neste ambiente

`npm ci` não terminou porque o ambiente não conseguiu baixar todas as dependências do registry dentro do tempo disponível. O `node_modules` parcial gerado foi removido do pacote final. Por isso NÃO afirmar que typecheck/build/test passaram aqui.

No PC, a primeira ação obrigatória é:
npm ci
npm run typecheck
npm test
npm run build
npm run format:check

Depois aplicar/testar migrations em Supabase local/staging e executar `npm run test:db`.

## Atenção

As migrations v7 são substancialmente melhores que as v6, mas pagamentos reais, Web Push/VAPID, MFA de lance, Storage real e admin com dados reais ainda dependem da infraestrutura/credenciais e de testes de integração. `PAYMENTS_LIVE` deve continuar `false`.

## Correções adicionais após comparar com o relatório do Claude

- A Parte 1 do Claude já havia corrigido os problemas graves de migrations/RLS/lance/fechamento citados no relatório; ela permanece como base.
- O painel `/admin` deixou de mostrar números fictícios e agora exige sessão com role `admin`/`moderator` antes de consultar dados.
- Busca do Header, favoritos, notificações e acesso à conta agora navegam de verdade.
- A busca principal consome `?q=`.
- Efeitos Realtime/queries foram ajustados para não depender de narrowing inseguro de `supabase` dentro de callbacks.
- Não reintroduzir a migration antiga `20260921131000_proxy_close_admin.sql` por cima do motor corrigido.
