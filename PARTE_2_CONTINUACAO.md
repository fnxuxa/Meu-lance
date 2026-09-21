> Documento histórico de um ZIP anterior. Para o resultado atual, leia [docs/REVISAO.md](docs/REVISAO.md).

# Continuação — Parte 2

Implementado nesta continuação:

- autenticação real Supabase para login/cadastro;
- hook de sessão;
- busca/listagem lê anúncios ativos do Supabase quando configurado e usa demo somente sem backend;
- detalhe busca pelo slug real e retorna 404 quando não existe;
- perguntas usam sessão real e Realtime;
- Central de Lances deixou de usar cards fictícios e consulta bids/watchlist/auction_leaders;
- admin continua protegido por role;
- modo demonstração permanece explícito para preview.

Ainda precisa validar no PC com `npm ci && npm run typecheck && npm test && npm run build && npm run format:check`.
Próxima etapa: publicação real (Storage + draft + listing_images), perfil/telefone/MFA e respostas do vendedor.
