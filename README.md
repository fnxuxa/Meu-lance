# MeuLance — versão consolidada e revisada

Base consolidada dos três ZIPs de `Arquivos rascunho`. O motor e as políticas da v7 foram preservados e corrigidos; a interface e os fluxos úteis da v9 foram integrados. Os arquivos originais permanecem intactos.

## Rodar no Windows

Requer Node.js 22.13 ou superior (recomendado: Node 24).

```powershell
cd E:\Meulance\meu-lance
npm ci
npm run dev
```

Sem variáveis de ambiente, abre em **demonstração**, com anúncios ilustrativos e sem envio de lances. Para conectar um ambiente de teste, copie `.env.example` para `.env.local`, configure apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend e aplique as migrations em ordem. Não use service role no navegador.

## Verificar

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run test:db:native
npm run test:e2e
```

O teste de banco nativo inicia PostgreSQL temporário apenas em localhost, em um diretório novo dentro de `.test-db`, executa migrations, RLS e testes simultâneos e encerra o servidor. Não usa nem apaga banco externo. `test:db:portable` é uma alternativa em memória, sem concorrência real. `test:db` é o executor Linux/CI com PostgreSQL instalado.

Os testes de navegador usam Microsoft Edge instalado. Para Chromium, instale com `npx playwright install chromium` e configure `PLAYWRIGHT_CHANNEL=chromium`.

## O que está entregue

Catálogo e detalhe conectados ao banco; sessão e recuperação de senha; criação/publicação com fotos e retomada de falhas; lances manuais e automáticos; favoritos e acompanhamento de liderança; perguntas/respostas; consulta de pedidos; chat; abertura de disputa; preferências; métricas administrativas; testes e CI.

**Isso ainda não é um marketplace pronto para operar vendas reais.** Pagamentos, verificação completa de identidade, logística, resolução de disputas, notificações externas e diversas partes do roadmap continuam pendentes. Confira o [relatório de revisão](docs/REVISAO.md), que distingue correções, validações e limites.

Nenhum deploy foi feito e nenhum Supabase hospedado foi alterado. Bancos antigos que tenham aplicado a versão v6 exigem revisão específica antes de atualização: há migrations com o mesmo nome e conteúdo diferente entre os ZIPs.
