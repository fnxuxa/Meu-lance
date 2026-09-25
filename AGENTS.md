# AGENTS.md — MeuLance

> Leia este arquivo inteiro antes de qualquer tarefa. Ele é a fonte de verdade do projeto.
> Se usar Claude Code, copie este arquivo como `CLAUDE.md` (mesmo conteúdo). Codex, Cursor e similares leem `AGENTS.md`.
> Substitua `MeuLance` e os itens marcados com `[PREENCHER]`.

---

## 0. Como você (IA) deve trabalhar neste projeto

### 0.1 Regras de ouro (nunca violar)

1. **Toda lógica de lance, preço, vencedor e pagamento roda no servidor** (funções Postgres e Edge Functions). O client só exibe e envia intenções. Nunca confie em valor, preço, usuário ou horário vindo do client.
2. **Dinheiro sempre em centavos, inteiro** (`bigint`/`integer`). Nunca `float`. Formatação em R$ só na camada de UI.
3. **A plataforma nunca guarda saldo de usuário.** Não crie tabela de "carteira", "saldo" ou "créditos". O dinheiro fica no provedor de pagamento. Ver seção 6.
4. **Pagamento real fica desligado até o checklist de go-live (seção 16) estar completo.** Use a flag `PAYMENTS_LIVE=false` por padrão. Em desenvolvimento use o `MockPaymentProvider`.
5. **RLS (Row Level Security) ligada em todas as tabelas**, sem exceção. Tabela sem policy = ninguém acessa.
6. **Toda operação que mexe com dinheiro ou lance é idempotente** (chave de idempotência + constraint única). Webhooks podem chegar duplicados e fora de ordem.
7. **Não invente texto jurídico.** Termos de Uso, Política de Privacidade e regras de leilão são gerados como **rascunho com aviso "REVISAR COM ADVOGADO"**. Nunca os apresente como definitivos.
8. **Não afirme detalhes de APIs de terceiros de memória.** Antes de integrar Mercado Pago, WhatsApp/Evolution API, SMS ou qualquer provedor, leia a documentação oficial atual. Nomes de campos e produtos mudam (ex.: `marketplace_fee`/`application_fee` variam conforme o checkout). Se não conseguir verificar, deixe `TODO(verificar-doc)` e explique.
9. **Nunca commitar segredos.** Tokens, chaves e service role ficam em variáveis de ambiente. Ofereça `.env.example` sem valores reais.
10. **Não remova nem enfraqueça validação, RLS, rate limit ou log de auditoria** para "fazer funcionar". Se algo bloqueia, explique e proponha a correção certa.

### 0.2 Fluxo de trabalho

- **Planeje antes de mudanças grandes.** Para tarefa que toca mais de 3 arquivos ou o banco, escreva um plano curto (o que muda, por quê, riscos) e execute em seguida. Só pare para perguntar em decisões listadas na seção 15 ou quando houver ambiguidade que muda o resultado.
- **Passos pequenos e verificáveis.** Uma migration, um conjunto de testes, uma feature por vez.
- **Rode lint, typecheck e testes** antes de dizer que terminou. Se não puder rodar, diga claramente.
- **Mudou regra de negócio?** Atualize este arquivo (seções relevantes) e os testes na mesma tarefa.
- **Não crie abstração desnecessária**, mas isole o que é volátil: provedor de pagamento, notificações e antifraude ficam atrás de interfaces.
- **Comunique em português (pt-BR)**, código e nomes de tabelas/variáveis em inglês.
- Ao terminar, resuma: o que foi feito, arquivos alterados, como testar, pendências.

### 0.3 Definição de pronto (Definition of Done)

- Funciona no mobile (375px) e no desktop.
- Tipos estritos sem erros (`tsc --noEmit`), lint limpo.
- Testes escritos para regra de negócio nova (lances, estados, pagamento).
- RLS/policies revisadas para tabelas novas.
- Estados de loading, vazio e erro tratados na UI.
- Textos em pt-BR, valores em R$ (`Intl.NumberFormat('pt-BR')`), datas em `America/Sao_Paulo`.
- Sem `console.log` de dados sensíveis.

---

## 1. Visão do produto

**MeuLance** é um marketplace de leilões online entre pessoas (C2C) para itens usados, no Brasil.

- Qualquer pessoa cadastra **um ou vários itens** (não precisa ser lojista), define **valor inicial, duração, localização e forma de entrega**.
- Outras pessoas dão **lances online**. **Não há narrador/leiloeiro conduzindo**: o preço atualiza sozinho conforme os lances chegam.
- Ao fim do prazo, **o maior lance válido vence**. O vencedor **paga pela plataforma** (via provedor de pagamento) e o **vendedor só recebe depois que o comprador confirma o recebimento**.
- **Entrega é responsabilidade do vendedor** (envio com rastreio ou retirada local).
- A plataforma cobra **comissão de 5%** sobre a venda (configurável).

### 1.1 Proposta de valor

- Vendedor: "venda o que está parado em casa sem precisar descobrir quanto vale; o mercado define o preço".
- Comprador: "compre com pagamento protegido; o dinheiro só é liberado depois que você recebe".
- Diferencial: leilão local (itens perto de você), pagamento protegido, lance automático.

### 1.2 Escopo inicial de itens

Faixa alvo: **R$ 50 a R$ 2.000**. Categorias: games, celulares, TVs, monitores, placas de vídeo, notebooks, bicicletas, ferramentas, móveis, eletrodomésticos, instrumentos musicais, colecionáveis, roupas, itens domésticos, "outros".

**Fora do escopo (bloqueados):** veículos, imóveis, joias, armas, munição, drogas e medicamentos, animais, produtos falsificados ou de origem ilícita, conteúdo adulto, tabaco/vape, dados pessoais, serviços. A lista é configurável (`prohibited_categories`) e deve ser validada com advogado.

### 1.3 Público e contexto

- Brasil, mobile-first (maioria dos acessos será por celular), idioma pt-BR, moeda BRL, fuso `America/Sao_Paulo` (armazenar tudo em UTC).
- Pagamento: Pix e cartão via Mercado Pago.

---

## 2. Stack técnica

| Camada | Escolha |
|---|---|
| Frontend | React + Vite + TypeScript (strict), React Router, TanStack Query, Zustand (só estado de UI), Tailwind CSS, shadcn/ui |
| Formulários/validação | React Hook Form + Zod (schemas compartilhados) |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Row Level Security |
| Lógica crítica | Funções Postgres (`plpgsql`) para lances e transições de estado; Supabase Edge Functions (Deno) para webhooks, pagamento e integrações |
| Agendamento | `pg_cron` (fechar leilões, expirar pagamentos, liberar valores, lembretes) |
| Pagamentos | Mercado Pago (Split/Marketplace) atrás da interface `PaymentProvider` |
| E-mail | Resend (ou equivalente) |
| WhatsApp/SMS | Verificação de telefone e notificações; Evolution API como canal opcional de WhatsApp. Abstrair atrás de `NotificationChannel` |
| Deploy | Vercel (frontend), Supabase (backend). Ambientes: `local`, `staging`, `production` |
| Qualidade | ESLint, Prettier, Vitest, Playwright, GitHub Actions |
| Observabilidade | Sentry (front e Edge Functions), logs estruturados |

> Se algo aqui precisar mudar (ex.: Next.js em vez de Vite por SEO), registre a decisão na seção 15 antes de mudar.

**SEO:** páginas públicas de leilão precisam ser indexáveis. Se usar SPA pura, avalie pré-render/SSR (Next.js ou prerender) para `/l/:slug` e categorias. Decisão pendente (seção 15).

---

## 3. Estrutura de pastas

```
/
├── AGENTS.md
├── .env.example
├── supabase/
│   ├── migrations/            # SQL versionado, nunca editar migration já aplicada
│   ├── functions/             # Edge Functions (webhooks, payments, notify)
│   ├── seed.sql
│   └── tests/                 # testes SQL (pgTAP) de place_bid e transições
├── src/
│   ├── app/                   # rotas e layouts
│   ├── features/
│   │   ├── auth/
│   │   ├── listings/          # criar/editar/exibir leilão
│   │   ├── bidding/           # lance manual, lance automático, tempo real
│   │   ├── orders/            # pagamento, envio, confirmação
│   │   ├── disputes/
│   │   ├── messaging/
│   │   ├── reviews/
│   │   ├── notifications/
│   │   ├── search/
│   │   └── admin/
│   ├── lib/                   # supabase client, money, dates, geo, validators
│   ├── components/            # UI reutilizável
│   └── types/                 # tipos gerados do banco (supabase gen types)
├── e2e/                       # Playwright
└── docs/
    ├── legal-drafts/          # rascunhos jurídicos (REVISAR COM ADVOGADO)
    ├── payments.md            # decisões e respostas do Mercado Pago
    └── runbook.md             # operação, incidentes, disputas
```

---

## 4. Convenções de código

- TypeScript `strict: true`. Proibido `any` sem comentário justificando.
- Componentes funcionais, hooks para lógica. Uma responsabilidade por arquivo.
- Validação de entrada com **Zod** no client (UX) **e** no servidor (segurança). O schema é compartilhado.
- Tipos do banco gerados com `supabase gen types typescript`. Não escrever tipos de tabela à mão.
- Dinheiro: helper `formatBRL(cents)` e `parseBRLToCents(input)` em `lib/money.ts`. Testado.
- Datas: armazenar UTC (`timestamptz`), exibir em `America/Sao_Paulo`. Contador regressivo usa **hora do servidor** (sincronizar offset no carregamento), nunca só o relógio do dispositivo.
- Erros de domínio com códigos estáveis (`BID_TOO_LOW`, `AUCTION_ENDED`, `SELLER_CANNOT_BID`...). A UI traduz o código para mensagem pt-BR.
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Migrations: uma mudança lógica por arquivo, nome `YYYYMMDDHHMMSS_descricao.sql`, sempre com RLS/policies junto da tabela.
- Acessibilidade: labels, foco visível, contraste, navegação por teclado.

---

## 5. Modelo de dados

Convenção: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` com trigger. Dinheiro em `*_cents bigint`.

### 5.1 Tabelas principais

- **profiles**: `id` (= `auth.users.id`), `full_name`, `display_name`, `cpf_hash` (único), `cpf_encrypted`, `phone_e164` (único), `phone_verified_at`, `city`, `state`, `ibge_city_code`, `avatar_url`, `role` (`user|moderator|admin`), `seller_status` (`none|pending|active|suspended`), `strikes_count`, `banned_at`.
- **seller_payment_accounts**: `user_id`, `provider`, `external_account_id`, `access_token_enc`, `refresh_token_enc`, `expires_at`, `status`. Tokens criptografados; nunca expostos ao client.
- **categories**: `id`, `slug`, `name`, `parent_id`, `active`, `risk_level`.
- **listings** (o leilão): `seller_id`, `category_id`, `title`, `description`, `condition` (`new|like_new|good|fair|for_parts`), `brand`, `model`, `serial_number`, `defects_declared`, `start_price_cents`, `current_price_cents`, `highest_bidder_id`, `bid_count`, `starts_at`, `ends_at`, `original_ends_at`, `extensions_count`, `status`, `delivery_mode` (`pickup|shipping|both`), `city`, `state`, `lat`, `lng`, `shipping_notes`, `declaration_accepted_at`, `slug`, `view_count`.
- **listing_images**: `listing_id`, `storage_path`, `position`, `width`, `height`, `content_hash`.
- **bids** (append-only, imutável): `listing_id`, `bidder_id`, `amount_cents`, `kind` (`manual|auto`), `max_amount_cents` (nulo em lance automático gerado), `device_id`, `ip_hash`, `created_at`. Sem UPDATE/DELETE por ninguém (policy + trigger que bloqueia).
- **proxy_bids** (lance automático): `listing_id`, `bidder_id`, `max_amount_cents`. Único por `(listing_id, bidder_id)`.
- **orders**: `listing_id` (um pedido "vivo" por leilão: índice único parcial fora de `payment_expired`/`cancelled`), `buyer_id`, `seller_id`, `amount_cents`, `fee_cents`, `seller_net_cents`, `status`, `payment_due_at`, `ship_by`, `shipped_at`, `carrier`, `tracking_code`, `delivered_at`, `confirm_by`, `confirmed_at`, `completed_at`, `buyer_fee_cents`, `cancel_reason`.
- **payments**: `order_id`, `provider`, `provider_payment_id`, `method` (`pix|card`), `status`, `amount_cents`, `idempotency_key` (único), `raw jsonb`.
- **payment_events**: `provider`, `event_id` (único), `payload jsonb`, `processed_at`. Deduplicação de webhook.
- **refunds**: `payment_id`, `amount_cents`, `reason`, `status`, `provider_refund_id`.
- **disputes**: `order_id`, `opened_by`, `reason` (`not_shipped|not_as_described|damaged|other`), `status` (`open|awaiting_seller|awaiting_buyer|under_review|resolved_buyer|resolved_seller`), `description`, `resolution_note`, `resolved_by`, `resolved_at`.
- **dispute_evidence**: `dispute_id`, `author_id`, `kind` (`text|image|video|tracking`), `storage_path`, `text`.
- **questions**: perguntas públicas ao vendedor (`listing_id`, `asker_id`, `text`, `answer`, `answered_at`).
- **messages**: chat por pedido (`order_id`, `sender_id`, `text`).
- **notifications**: `user_id`, `type`, `payload`, `read_at`.
- **reviews**: `order_id`, `reviewer_id`, `reviewee_id`, `rating` (1-5), `comment`. Um por parte por pedido.
- **watchlist**: `user_id`, `listing_id`.
- **reports**: denúncias (`reporter_id`, `target_type`, `target_id`, `reason`, `status`).
- **strikes**: `user_id`, `reason`, `order_id`.
- **fraud_signals**: `user_id`, `kind`, `score`, `data jsonb`.
- **audit_log**: `actor_id`, `action`, `entity`, `entity_id`, `diff jsonb`, `ip_hash`. Toda ação administrativa e toda transição de estado de pedido.
- **app_config**: `key`, `value jsonb` (comissão em basis points, prazos, incrementos, lista de proibidos). Editável só por admin.

### 5.2 Máquina de estados

**listing.status:** `draft → scheduled → active → ended_no_bids | ended_with_winner | cancelled | removed`

**order.status:**
```
pending_payment → paid → awaiting_shipment → shipped → delivered → completed
      │              │            │                          │
      ▼              ▼            ▼                          ▼
payment_expired   refunded    cancelled                  disputed → resolved_buyer (refunded) | resolved_seller (completed)
```
Transições só por funções do servidor, cada uma validando o estado de origem e gravando em `audit_log`. Transição inválida lança erro.

---

## 6. Pagamentos (parte mais sensível)

### 6.1 Princípios

- Usar infraestrutura de marketplace do provedor (split/retenção), **não** criar carteira própria.
- Fluxo desejado: comprador paga → valor fica retido pelo provedor → vendedor envia → comprador confirma → provedor libera ao vendedor e a plataforma fica com 5%.
- **Premissa não confirmada:** o Split padrão do Mercado Pago divide o pagamento na transação, mas **não é necessariamente escrow**. Se o produto não permitir retenção/liberação posterior compatível com o fluxo, o desenho muda. Ver decisões abertas (seção 15) e `docs/payments.md`.
- Reembolso: no split, o valor tende a ser subtraído proporcionalmente das contas do vendedor e da plataforma. Se o vendedor já sacou/gastou, o reembolso integral pode falhar ou a plataforma pode ter que cobrir. **Tratar como risco de negócio a mitigar** (retenção, limites, reserva).

### 6.2 Interface obrigatória

```ts
interface PaymentProvider {
  connectSellerAccount(userId: string): Promise<{ authUrl: string }>;
  createCheckout(order: OrderForPayment): Promise<{ checkoutUrl?: string; pixQrCode?: string; providerPaymentId: string }>;
  handleWebhook(req: Request): Promise<WebhookResult>;   // valida assinatura, deduplica, idempotente
  releaseToSeller(orderId: string): Promise<void>;       // se aplicável ao produto contratado
  refund(paymentId: string, amountCents?: number): Promise<RefundResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>;
}
```

Implementações: `MockPaymentProvider` (dev/teste, simula tudo) e `MercadoPagoProvider`. O resto do app só conhece a interface.

### 6.3 Regras

- Validar a **assinatura do webhook** do provedor. Rejeitar sem assinatura válida.
- Gravar todo evento em `payment_events` (único por `event_id`) antes de processar.
- Sempre **reconsultar o status no provedor** ao receber webhook (não confiar só no payload).
- Job de **reconciliação** diário: compara `payments` locais com o provedor e alerta divergência.
- Comissão calculada no servidor: `fee_cents = round(amount_cents * fee_bps / 10000)`. Quem paga a taxa do provedor (vendedor, plataforma ou dividida) é decisão aberta.
- Dados de cartão **nunca** passam pelo nosso servidor (usar checkout/tokenização do provedor).
- Vendedor precisa **conectar a conta do provedor (OAuth)** antes de publicar o primeiro leilão.

### 6.4 Prazos (padrões, configuráveis em `app_config`)

| Evento | Prazo padrão |
|---|---|
| Vencedor pagar após o fim | 48 horas |
| Vendedor postar/entregar após pagamento | 3 dias |
| Comprador confirmar/abrir disputa após entrega | 7 dias |
| Liberação automática se comprador não agir | ao fim do prazo acima |
| Retirada local | o comprador confirma pelo **botão "Confirmar recebimento"** na plataforma (Meus pedidos / pedido). Não existe código de retirada |

Não pagou no prazo: pedido `payment_expired`, `strike` ao comprador, opção de oferecer ao segundo maior lance (decisão aberta).
Vendedor não enviou: cancelamento automático, reembolso integral, `strike` ao vendedor.

---

## 7. Regras de leilão

### 7.1 Ciclo

1. Vendedor cria o anúncio (rascunho), aceita a **declaração de veracidade** ("as informações e fotos são verdadeiras") e as **regras de leilão** (item vinculante).
2. Publica com valor inicial, duração (padrão **7 dias**; opções configuráveis), localização e modo de entrega.
3. Compradores dão lances. Preço atualiza em tempo real.
4. No fim, o maior lance válido vence, o servidor cria o `order` e notifica as partes.

### 7.2 Regras de negócio

- **Lance vinculante para os dois lados:** o vendedor **não pode cancelar** depois do primeiro lance (exceção: moderação/admin, ou motivo previsto nas regras, registrado em `audit_log`). O comprador que vence assume o compromisso de pagar.
- **Vendedor não pode dar lance** no próprio item (bloqueio por `seller_id` e por sinais de conta relacionada).
- **Incremento mínimo** por faixa de preço (`app_config.bid_increments`), exemplo: até R$100 → R$2; até R$500 → R$5; até R$2.000 → R$10.
- **Lance mínimo** = preço atual + incremento (ou valor inicial se não há lances).
- **Anti-sniping (prorrogação):** lance nos últimos 2 minutos estende o fim em 2 minutos, com limite de extensões. Ligado por padrão, configurável (decisão aberta).
- **Edição do anúncio** só antes do primeiro lance. Depois só acrescentar informações (nunca alterar título, fotos, defeitos declarados ou preço inicial).
- **Duração:** padrão 7 dias. Permitir 3, 5, 7, 10 dias (configurável).
- **Sem preço de reserva** na primeira versão (o valor inicial já funciona como piso).

### 7.3 Lance automático (proxy bidding)

O usuário define um **teto**. O sistema dá lances no lugar dele, no menor valor necessário, até o teto.

Algoritmo (executado dentro da transação do servidor, com trava na linha do leilão):

```
place_bid(listing, bidder B, max M):
  lock listing (SELECT ... FOR UPDATE)
  validar: listing ativo, agora < ends_at, B != seller, B verificado, B não banido
  min = (bid_count == 0) ? start_price : current_price + increment
  se M < min → erro BID_TOO_LOW
  H = maior proxy_bid atual (com dono D), se existir
  se D == B: só permitir AUMENTAR o teto; preço não muda
  se não existe H: current_price = start_price; highest = B
  senão se M > H.max: highest = B; current_price = min(M, H.max + increment)
  senão se M == H.max: continua D (quem deu primeiro); current_price = H.max
  senão (M < H.max): continua D; current_price = min(H.max, M + increment)
  gravar em bids cada mudança visível de preço (linha imutável)
  se lance nos últimos N minutos → estender ends_at (respeitando limite)
  atualizar listing (current_price, highest_bidder, bid_count, ends_at)
  publicar evento realtime
```

Regras: histórico público de lances com identidade **mascarada** (ex.: "u***a"), o teto de cada usuário é **secreto**, o usuário só vê o próprio teto.

### 7.4 Fechamento

Job a cada minuto: `close_expired_listings()` (idempotente). Para cada leilão vencido: define vencedor, cria `order` (`pending_payment`, `payment_due_at`), grava `audit_log`, dispara notificações. Sem lances → `ended_no_bids`, com opção de republicar.

---

## 8. Antifraude e confiança

- **Cadastro:** e-mail verificado, **telefone verificado por código** (OTP), **CPF único** (validar dígitos + hash único). Vendedor: conta do provedor de pagamento conectada.
- **Contas múltiplas:** `device_id`, hash de IP, telefone/CPF únicos, `fraud_signals` para padrões (várias contas, mesmo dispositivo, lances cruzados).
- **Lance falso (shill bidding):** bloquear vendedor e contas relacionadas; alertar quando as mesmas contas sempre dão lance nos mesmos vendedores; painel admin com pontuação.
- **Rate limit** em: cadastro, OTP, lances (por usuário e por IP), perguntas, denúncias.
- **Anti-burla de comissão:** detectar telefone, e-mail, links e "chama no zap" em descrição, perguntas e chat **antes do pagamento**; bloquear/moderar.
- **Reputação:** notas e contadores públicos (vendas concluídas, disputas perdidas). Conta nova com limites (valor máximo de lance/anúncio até acumular histórico).
- **Strikes:** 3 strikes = suspensão para análise. Motivos: não pagar, não enviar, item diferente do anunciado, fraude.
- **Denúncias:** botão em anúncio, usuário e mensagem. Fila de moderação.
- **Moderação de imagens:** validar tipo/tamanho, remover EXIF de localização, hash para detectar duplicatas (foto reutilizada de outro anúncio).
- **Não prometer "produto 100% autêntico".** A plataforma exige declaração do vendedor e oferece proteção de pagamento; o que é garantia da plataforma e o que é responsabilidade do vendedor deve estar claro nos termos (texto validado por advogado).

---

## 9. Disputas

- Comprador abre disputa dentro do prazo pós-entrega. O **valor continua retido** (na medida em que o provedor permitir).
- Motivos: não recebi, diferente do anunciado, danificado, outro.
- Evidências: texto, fotos, vídeo de abertura, código de rastreio, capturas do anúncio original (o sistema mantém **snapshot imutável do anúncio** ao fim do leilão).
- Vendedor responde no prazo (ex.: 48h). Sem resposta: decisão a favor do comprador.
- Moderador decide: `resolved_buyer` (reembolso) ou `resolved_seller` (liberação). Toda decisão vai para `audit_log` com justificativa.
- Métricas de disputa alimentam reputação e strikes.

---

## 10. Funcionalidades (escopo completo)

### 10.1 Visitante
- Home com destaques, "terminando em breve", categorias, "perto de você".
- Busca e filtros: texto, categoria, faixa de preço, cidade/raio, condição, modo de entrega, "terminando hoje", ordenação (encerrando, menor preço, mais lances, recentes).
- Página do leilão: galeria, título, descrição, condição, defeitos, localização, contador, preço atual, número de lances, histórico mascarado, perguntas e respostas, reputação do vendedor, botão de lance, compartilhar, denunciar.

### 10.2 Usuário
- Cadastro/login (e-mail + senha, Google opcional), verificação de e-mail e telefone.
- Dar lance manual e **lance automático** com teto; confirmação clara de que **o lance é vinculante**.
- Favoritos/watchlist e alertas ("termina em 1h", "você foi superado", "você venceu").
- Área "Meus lances", "Minhas compras", "Meus favoritos", "Minhas vendas".
- Perguntas ao vendedor, chat do pedido, avaliações, denúncias.
- Configurações: perfil, endereço/cidade, notificações, exportar e excluir dados (LGPD).

### 10.3 Vendedor
- Onboarding: conectar conta do provedor de pagamento.
- Criar anúncio: fotos (mín. 3, máx. 10), título, categoria, condição, marca/modelo, número de série (quando aplicável), defeitos, valor inicial, duração, localização, modo de entrega, declaração de veracidade.
- Painel de vendas: leilões ativos, encerrados, pedidos aguardando envio, código de rastreio, disputas, repasses.
- Responder perguntas, informar rastreio, confirmar retirada por código.

### 10.4 Admin/Moderação
- Dashboard: GMV, leilões ativos, taxa de conversão (leilão → venda), disputas, fraude.
- Fila de denúncias, anúncios e usuários; suspender/banir; remover anúncio.
- Gestão de disputas com evidências.
- Configuração (`app_config`): comissão, prazos, incrementos, categorias, lista de proibidos.
- Visualizador de `audit_log` e de pedidos/pagamentos.

### 10.5 Notificações (eventos)
Lance superado, leilão terminando (1h, 10min), vencedor, pagamento pendente/expirando, pagamento confirmado, envio solicitado/atrasado, item enviado, confirme o recebimento, disputa aberta/atualizada, valor liberado, denúncia resolvida. Canais: in-app, e-mail e WhatsApp (opt-in). Preferências por usuário.

### 10.6 Localização
- Cidade/UF via lista do IBGE. Coordenadas aproximadas (nunca endereço exato público).
- Filtro por cidade/raio (PostGIS, se necessário). "Retirada em [cidade]" e "envio para todo o Brasil".

---

## 11. Rotas (frontend)

```
/                       home
/buscar                 busca e filtros
/c/:categoria           categoria
/l/:slug                página do leilão
/vender/novo            criar anúncio
/vender/:id/editar      editar (só antes do 1º lance)
/conta/lances           meus lances
/conta/compras          minhas compras
/conta/vendas           minhas vendas
/conta/favoritos
/conta/notificacoes
/conta/configuracoes
/pedido/:id             acompanhar pagamento/envio/confirmação
/disputa/:id
/u/:id                  perfil público e reputação
/entrar  /cadastrar  /recuperar-senha
/ajuda  /como-funciona  /termos  /privacidade  /regras-de-lance  /itens-proibidos
/admin/*                (apenas role admin/moderator)
```

---

## 12. UX e design

- Mobile-first, rápido, sem fricção. Confiança é o produto: mostrar selo de verificação, reputação, "pagamento protegido" e o histórico de lances.
- Contador destacado; cor de urgência nos últimos minutos; atualização em tempo real do preço com animação sutil.
- Tela de lance: mostrar **valor mínimo**, campo de teto (lance automático), resumo "Ao confirmar, seu lance é vinculante" e botão único.
- Estados vazios úteis; skeletons de carregamento; mensagens de erro em pt-BR claras.
- Tema claro/escuro; componentes acessíveis; imagens otimizadas (WebP, lazy load, tamanhos responsivos).
- Definir identidade visual em `docs/design.md` `[PREENCHER: cores, tipografia, tom de voz]` e seguir de forma consistente.

---

## 13. Segurança, privacidade e LGPD

- **RLS** por tabela com testes. Exemplos: usuário lê só os próprios pedidos; `bids` visíveis publicamente só com identidade mascarada (via view); `proxy_bids` visível só ao dono; nunca expor `cpf`, `phone`, tokens.
- **Service role** só em Edge Functions, nunca no client.
- **Storage:** buckets com policies; uploads validados (tipo, tamanho, dimensão); nomes aleatórios.
- **Segredos:** variáveis de ambiente; rotação documentada.
- **Cabeçalhos e proteção web:** CSP, HSTS, proteção contra XSS (sanitizar descrições), CSRF quando aplicável.
- **Dados sensíveis:** CPF armazenado com hash (busca/unicidade) e criptografia (exibição restrita). Mínimo de dados necessários.
- **LGPD:** base legal por finalidade, consentimento onde exigido, política de privacidade, canal do titular, **exportação e exclusão de dados**, registro de tratamento, retenção definida, contato do encarregado `[PREENCHER]`. Texto final é responsabilidade jurídica.
- **Auditoria:** `audit_log` para ações admin, mudanças de estado de pedido e decisões de disputa.
- **Registro de lances** auditável e imutável (leilão eletrônico exige rastreabilidade; validar requisitos com advogado).
- **Backups e recuperação:** backup do banco habilitado; restauração testada antes do go-live.

---

## 14. Testes e qualidade

**Obrigatórios (mínimo):**
- **Unitários** (Vitest): dinheiro, incrementos, comissão, validação de CPF, formatação.
- **Banco** (pgTAP ou testes de integração): `place_bid` cobrindo lance abaixo do mínimo, vendedor dando lance, leilão encerrado, empate de teto, teto do dono aumentando, prorrogação, **concorrência** (vários lances simultâneos no mesmo leilão: consistência de preço e vencedor).
- **Estados**: toda transição válida e inválida de `order` e `listing`.
- **Webhooks**: duplicado, fora de ordem, assinatura inválida, evento desconhecido.
- **RLS**: cada tabela com testes de "pode" e "não pode".
- **E2E** (Playwright): cadastro → criar anúncio → lances de dois usuários → fechamento → pedido → confirmação (com `MockPaymentProvider`).
- **CI:** GitHub Actions rodando lint, typecheck, testes e build em todo PR.

---

## 15. Decisões em aberto (não decida sozinho; pergunte ou registre)

**Jurídicas (validar com advogado antes do go-live):**
- [ ] O modelo (vendedor vende bem próprio, plataforma só hospeda lances e intermedia pagamento, sem conduzir pregão) exige leiloeiro? Existe alternativa (parceria com leiloeiro, "preço fixo + oferta")?
- [ ] Tipo de empresa/CNPJ, regime tributário e emissão de nota da comissão.
- [ ] Responsabilidade perante o consumidor (CDC) e texto dos Termos de Uso.
- [ ] Regras para vendedor pessoa física (habitualidade, tributação) e itens proibidos.
- [ ] LGPD: bases legais, política de privacidade, encarregado.

**Pagamento (perguntar ao Mercado Pago e registrar em `docs/payments.md`):**
- [ ] Existe produto que **retenha a parte do vendedor** até a confirmação de entrega? Por quantos dias no máximo?
- [ ] Como funciona o reembolso se o vendedor já sacou?
- [ ] Taxas por meio (Pix, cartão, parcelado) e **quem paga** (a comissão de 5% pode ficar pequena depois das taxas).
- [ ] Limites de valor, chargeback, requisitos de conta para vendedor pessoa física.

**Produto:**
- [ ] Anti-sniping ligado? Duração e limite de extensões.
- [x] Oferecer ao segundo colocado se o vencedor não pagar? **Decidido (22/09/2026):** opcional, o vendedor marca ao criar o anúncio (`listings.second_chance_enabled`).
- [ ] Prazos finais (pagamento, envio, confirmação).
- [ ] Faixa de preço inicial máxima e limites para contas novas.
- [ ] SEO: SPA com pré-render ou SSR (Next.js)?
- [ ] Nome, domínio e identidade visual.

---

## 16. Checklist de go-live (`PAYMENTS_LIVE=true` só depois de tudo)

- [ ] Parecer jurídico recebido e termos/regras/privacidade revisados por advogado.
- [ ] Respostas do Mercado Pago sobre retenção, reembolso e taxas documentadas.
- [ ] Fluxo completo testado em sandbox: pagamento, retenção/liberação, reembolso, disputa.
- [ ] Webhooks com assinatura validada e idempotência testada.
- [ ] Reconciliação diária funcionando e alertas configurados.
- [ ] RLS auditada tabela por tabela.
- [ ] Backup e restauração testados.
- [ ] Sentry, logs e alertas ativos (pagamento falho, webhook falho, job atrasado).
- [ ] Rate limit e antifraude ativos.
- [ ] Painel admin e processo de disputa prontos (quem atende, em quanto tempo).
- [ ] Lançamento gradual: convite, limite de valor, poucas cidades.

---

## 17. Roadmap de construção (ordem sugerida)

Cada fase termina com testes passando e o app rodando de ponta a ponta.

- [ ] **Fase 1 — Fundação:** projeto, Tailwind/shadcn, Supabase, CI, tipos gerados, `.env.example`, layout base, auth (e-mail/senha), perfil, RLS inicial.
- [ ] **Fase 2 — Anúncios:** categorias, criar/editar anúncio, upload de imagens, página do leilão, listagem e busca com filtros, localização.
- [ ] **Fase 3 — Lances:** `place_bid` (função Postgres), lance manual, **lance automático**, incrementos, realtime, contador com hora do servidor, prorrogação, histórico mascarado, testes de concorrência.
- [ ] **Fase 4 — Fechamento e pedido:** job de fechamento, criação de `order`, máquina de estados, notificações (in-app e e-mail), watchlist e alertas.
- [ ] **Fase 5 — Pagamento (mock):** `PaymentProvider`, `MockPaymentProvider`, fluxo completo pagar → enviar → confirmar (botão do comprador) → liberar, prazos e expirações automáticas.
- [ ] **Fase 6 — Confiança e segurança:** verificação de telefone/CPF, antifraude, strikes, denúncias, perguntas, chat do pedido, avaliações, reputação.
- [ ] **Fase 7 — Disputas e admin:** disputas com evidências, painel de moderação, `app_config` editável, métricas, `audit_log`.
- [ ] **Fase 8 — Mercado Pago real (sandbox):** OAuth do vendedor, checkout Pix/cartão, webhooks, split/retenção conforme decisão, reembolso, reconciliação.
- [ ] **Fase 9 — Jurídico e LGPD:** páginas legais (versões revisadas), consentimento, exportar/excluir dados, política de retenção.
- [ ] **Fase 10 — Polimento e lançamento:** performance, SEO, acessibilidade, E2E completo, observabilidade, checklist da seção 16, lançamento gradual.

---

## 18. Variáveis de ambiente (`.env.example`)

```
# Frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
VITE_SENTRY_DSN=

# Edge Functions / servidor (NUNCA no client)
SUPABASE_SERVICE_ROLE_KEY=
PAYMENTS_LIVE=false
PAYMENT_PROVIDER=mock            # mock | mercadopago
MP_APP_ID=
MP_CLIENT_SECRET=
MP_WEBHOOK_SECRET=
MP_REDIRECT_URI=
RESEND_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
ENCRYPTION_KEY=                  # criptografia de tokens e CPF
```

---

## 19. Primeira tarefa sugerida para a IA

1. Leia este arquivo por completo.
2. Proponha o plano da **Fase 1** (arquivos, migrations, decisões) e aguarde confirmação.
3. Depois de confirmado, execute a Fase 1 seguindo a seção 0.
4. Ao final, atualize o checklist da seção 17 e liste pendências.


## 20. Estado verificado em 21/09/2026 — consolidação 0.3.0

Leia docs/REVISAO.md para o estado real; o roadmap acima não significa implementação concluída. A base usa React/Vite, React Query e CSS próprio. Nenhuma migração de framework foi realizada nesta revisão.

- Lance manual tem valor exato; proxy guarda teto. Em empate entre manual novo e teto anterior, o teto anterior mantém liderança. Se o teto só cobre parte do incremento, o preço para no teto.
- Chaves de idempotência vinculam usuário, anúncio e valor; retries com payload diferente são recusados. O frontend preserva a chave em falha de transporte. Lances manuais e registros proxy têm limite de 30 operações aceitas por minuto por usuário, separadamente. Antifraude completo e limite por IP continuam pendentes.
- Histórico usa sequence_no para desempatar horários iguais. Não ordenar lances apenas por UUID.
- Publicação exige aceite; retries de publicação do próprio anúncio já ativo são idempotentes. Fotos publicadas não podem ser apagadas/sobrescritas pelo vendedor.
- Não mostrar verificação/reputação sem dados reais. Não usar MockPaymentProvider para comprovar pagamento: ele é exclusivo de testes em memória.
- Usar as migrations corretivas aditivas; não reescrever migrations históricas nem aplicar a base v7 sobre banco v6 sem auditar diferenças de histórico.
- Estado do item (22/09/2026): checklist de funcionamento por categoria em app_config.condition_checklists (respostas yes/no/untested/na), gravado só por set_listing_condition_report enquanto rascunho. publish_listing exige checklist completo; resposta "no" ou condição for_parts exige descrição do defeito; resposta "no", defeito descrito ou for_parts exige ao menos 1 foto com listing_images.is_defect.
- Venda "no estado" = condition for_parts. _lock_bidding recusa lance manual e proxy sem registro em as_is_acknowledgments (RPC acknowledge_as_is). Disputa com motivo damaged é recusada para for_parts. O snapshot da disputa inclui condição e checklist. Explicações ficam nos Termos (§8–11), não na tela do leilão.
- Taxa de proteção do comprador: app_config.buyer_fee_bps (padrão 300) gravada em orders.buyer_fee_cents no fechamento. Ver docs/payments.md.
- Sugestão de valor inicial: suggest_start_price usa sale_price_samples (sem dados pessoais; amostra removida se o pedido expira ou é cancelado). Relançamento: relist_listing reabre o mesmo anúncio encerrado sem lances, com novo valor inicial e duração.
- Buscas salvas: saved_searches (máx. 10 por usuário) com alerta in-app quando um leilão compatível fica ativo (publicação ou relançamento), no máximo um aviso por usuário por leilão.
- Confirmação de recebimento (22/09/2026): só pelo botão do comprador (confirm_delivery), aceito a partir de paid/awaiting_shipment/shipped/delivered, inclusive na retirada em mãos. Não há código de retirada.
- Oferta ao 2º colocado: opcional por anúncio. expire_unpaid_orders (cron a cada 5 min) só expira pedidos com payments_live = true; ao expirar, dá 1 strike ao comprador e, com a opção ligada, cria uma única second_chance_offers para o maior lance de outro participante, pelo valor desse lance, com prazo de app_config.second_chance_hours (24h). accept_second_chance cria o novo pedido; aceitar é opcional.
- IMEI: obrigatório nas categorias de app_config.imei_required_categories (padrão celulares), validado com Luhn por set_listing_imei, guardado em listing_imeis (privado: vendedor, comprador após pagamento, staff). purge_expired_imeis apaga 20 dias (imei_retention_days) após o pedido concluído/reembolsado; cleanup_expired_listings espera o IMEI sair. Link de consulta: página oficial da Anatel (Celular Legal).
- Termos de Uso: por decisão do dono do produto (22/09/2026), a página /termos não mostra mais o aviso de rascunho. O texto continua sem revisão jurídica; o item do checklist de go-live (seção 16) segue pendente.
- Relançar (relist_listing): vale para ended_no_bids e para ended_with_winner sem pedido em andamento (todos payment_expired/cancelled) e sem oferta pendente. Cada relançamento abre uma nova rodada (listings.auction_round): lances antigos ficam guardados em bids com a rodada anterior, public_bids mostra só a rodada atual, auction_leaders é limpo e proxy_bids desativados.
- Reputação durável: reviews sobrevivem à limpeza (order_id vira NULL) e guardam subject_role e listing_title; vendas concluídas = profiles.completed_sales_count (trigger). Em public_profiles, rating_avg/rating_count são só avaliações como vendedor; buyer_rating_* separado.
- Limpeza automática: block_bid_mutation só libera DELETE (nunca UPDATE) para cleanup_expired_listings, via chave de transação meulance.bid_purge. Antes disso a limpeza falhava para todo leilão com lances. Lances de leilões concluídos são apagados junto após a retenção; validar esse prazo com advogado (rastreabilidade de leilão).
- errorMessage nunca mostra texto técnico do banco (Postgrest/Storage): só códigos de domínio traduzidos ou mensagem genérica.
- Testes de banco locais pulam migrations que dependem de pg_cron (indisponível no Postgres embarcado, no PGlite e no Postgres de CI).
- Rodar lint, typecheck, testes, build e format:check. Banco local: test:db:native; navegador: test:e2e. Não declarar integração Supabase hospedada validada com base apenas nos stubs.
