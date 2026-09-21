# Revisão e consolidação — 21/09/2026

## Origem e decisão de consolidação

Foram inventariados os três ZIPs e comparados seus arquivos por caminho e conteúdo. O detalhamento está em `revisao/inventario.json`.

- **MeuLance-v6.zip:** referência inicial. Não foram recuperadas as implementações antigas inseguras de lances/pagamentos nem o cache de compilação.
- **MeuLance-v7-parte1.zip:** mantidas as correções do Claude de privilégios por coluna, políticas RLS, histórico mascarado, motor de proxy, fechamento e testes.
- **MeuLance-v9-continuacao-completa.zip:** contém uma pasta chamada `meu-lance-v8-corrigido`; dela foram aproveitados layout, galeria, autenticação, formulário, busca, preferências e rotas. Essas integrações precisaram das correções abaixo.

A pasta final é `E:\Meulance\meu-lance`. Os ZIPs e as extrações de referência não foram sobrescritos. Os documentos AUDITORIA_V8, IMPLEMENTACAO_STATUS e PARTE_2 são históricos, não comprovação de funcionamento desta versão.

## Problemas corrigidos

| Área                       | Problema encontrado                                                                                         | Correção                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Compilação                 | Array sem tipo em formulário morto; import inexistente de permissão push                                    | Removido formulário duplicado; preferências sem habilitação fictícia de push                                                       |
| Catálogo                   | Consulta a `delivery`, coluna inexistente; categoria mostrava UUID                                          | Consulta a `delivery_mode`, relação de categorias e tradução da condição                                                           |
| Home/detalhe               | Home sempre fictícia com backend; mudança de slug podia manter item anterior                                | Mesma fonte de dados para catálogo e home; cache por slug e atualização após RPC/Realtime                                          |
| Confiança                  | Selos de identidade, telefone e nota 4,9 fixos                                                              | Exibição somente com dados do perfil público; demo identificada                                                                    |
| Busca                      | `?q=` atualizado pelo Header não atualizava busca existente                                                 | URL é fonte do filtro                                                                                                              |
| Publicação                 | `unaccent` não instalado; condição `parts` inválida; declaração nunca salva                                 | RPC sem dependência de extensão; `for_parts`; aceite explícito gravado no servidor                                                 |
| Falha no upload/publicação | Erro de dinheiro escapava do tratamento; fotos apagadas após falha ambígua; novo rascunho em cada tentativa | Erro tratado; rascunho e imagens preservados; caminhos estáveis e retomada na mesma página; publicação repetível                   |
| Storage                    | Vendedor podia apagar fotos de anúncio ativo; concorrência contornava limite de imagens                     | Policies e trigger travam anúncio durante escrita; fotos publicadas protegidas; validação de caminho/objeto e limite sob trava     |
| Lances manuais             | Botões enviados sem confirmação; parse de dinheiro permissivo; retry gerava nova chave                      | Seleção seguida de confirmação; dinheiro validado em centavos; chave preservada em retry                                           |
| Motor                      | Manual empatado roubava liderança do proxy; teto remanescente menor que incremento era ignorado             | Prioridade do teto anterior e cobertura até seu limite                                                                             |
| Idempotência               | Mesma chave podia ser reutilizada com outro valor/anúncio                                                   | Vínculo com payload; serialização por usuário; proxy também recebe chave e tem registro privado                                    |
| Concorrência/horário       | Cancelamento de proxy sem trava; `now()` permitia horário velho em transação longa                          | Trava do anúncio; validação com relógio atual do servidor                                                                          |
| Histórico                  | Timestamps iguais deixavam ordenação aleatória por UUID                                                     | Sequência monotônica no banco e nos testes                                                                                         |
| Replicação                 | `REPLICA IDENTITY FULL` incluía coluna gerada não publicada                                                 | Identidade pela chave primária, validada no PostgreSQL 18                                                                          |
| Acompanhamento             | Conjunto de líderes sempre vazio; abas sem ação; consultas ignoravam erros                                  | Consulta real a `auction_leaders`; filtros, estados encerrados e erros                                                             |
| Conta                      | Recuperação terminava em página vazia; sem saída da conta                                                   | Formulário de nova senha e logout; tratamento de sessão                                                                            |
| Perguntas                  | Envio não atualizava lista; vendedor não tinha resposta na UI                                               | Atualização após gravação, assinatura e consulta periódica; resposta pela RPC existente                                            |
| Pedidos/chat/disputas      | Componentes desconectados; motivos incompatíveis; texto perdido em erro; anexos sem ação                    | Rotas de consulta de pedido, chat com erro e preservação do texto, abertura de disputa com enum válido; botões fictícios removidos |
| Admin                      | Erros viravam métricas zero; acesso não reagia à troca de conta                                             | Dados por sessão e erro explícito; contagem das disputas abertas/em análise                                                        |
| Notificações               | Salvar marcava sucesso local em caso de falha; preferências ignoradas pelo motor                            | Estado confirmado após gravação; preferências consideradas no envio in-app                                                         |
| Mock de pagamento          | Qualquer ID era informado como pago                                                                         | Estado inicial pendente; ID desconhecido falha; pagamento só por simulação explícita de teste                                      |
| Mobile                     | Miniaturas herdavam altura de 350/580 px da imagem principal                                                | Miniaturas quadradas; inspeção visual em 375 px                                                                                    |
| PWA/deploy                 | CSP bloqueava fotos de demo; cache limpava chaves de outros apps; push aceitava URL externa                 | Origem das fotos explicitamente permitida; limpeza limitada ao prefixo; navegação same-origin                                      |

As três migrations de revisão são **aditivas**, depois das migrations originais. Nada foi aplicado a um banco hospedado. Não há integração de pagamento real nesta entrega.

## Validação

- TypeScript estrito e build de produção.
- ESLint e Prettier.
- 19 testes unitários/componentes, incluindo moeda malformada, confirmação, chave de retry, simulação de pagamento e retomada de publicação após falha.
- 113 assertivas SQL em PostgreSQL nativo, aplicando todas as migrations do zero e seed.
- Concorrência real: seis conexões dando lances e duas repetindo a mesma requisição. Preço, líder e número de lances conferidos.
- Seis testes de navegador: desktop e 375 px, demonstração, galeria, busca, autenticação indisponível, rotas restritas e 404.
- Capturas visuais em `revisao/desktop.png` e `revisao/mobile.png`.

Os testes SQL usam stubs dos schemas Auth/Storage do Supabase. Eles executam PostgreSQL e RLS reais, mas **não substituem teste integrado contra Supabase Auth, PostgREST, Storage HTTP e Realtime hospedados**. A publicação tem teste de componente com transporte simulado e teste SQL; o fluxo completo com conta e fotos reais ainda precisa de staging.

## Pendências reais, sem simulação de conclusão

1. Mercado Pago/OAuth/checkout/webhook, retenção, reembolso, reconciliação e homologação. `PAYMENTS_LIVE=false`. O mock é exclusivo de teste em memória.
2. Onboarding e verificação de telefone/CPF, antifraude completo e limites por IP. Hoje o motor checa sessão, conta não banida, autoria, preço e prazo; **não comprova telefone/identidade**. Não liberar operação real antes disso.
3. Transições completas de pedido, expiração de pagamento, envio, confirmação de recebimento, repasse e resolução administrativa de disputas.
4. Upload de evidências de disputa, avaliações e denúncias na interface, edição/gestão completa de anúncios e recuperação de rascunho depois de fechar a página. A retomada implementada preserva tentativas na mesma página.
5. Entrega de e-mail/WhatsApp/Web Push, assinatura VAPID, caixa de notificações e agendamento de lembretes de encerramento. Guardar preferência não significa que esses canais estejam ativos.
6. Páginas legais e institucionais finais, LGPD, SEO, telemetria, backup/restauração e homologação jurídica.
7. Gerar tipos completos do schema Supabase e ampliar testes com serviços reais. Os tipos de projeções usados na UI são locais, não uma geração completa do schema.
8. Auditar atualização de um banco v6 preexistente, se houver. Não se pode simplesmente pressupor que migrations de mesmo nome tiveram o mesmo conteúdo.

Não foram publicados site, banco ou pagamentos; credenciais não foram solicitadas nem inventadas.
