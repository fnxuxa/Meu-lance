const messages: Record<string, string> = {
  AUTH_REQUIRED: 'Entre na sua conta para continuar.',
  ACCOUNT_RESTRICTED: 'Sua conta está restrita.',
  AUCTION_ENDED: 'Este leilão já encerrou.',
  SELLER_CANNOT_BID: 'Você não pode dar lance no próprio anúncio.',
  ALREADY_LEADING: 'Você já lidera este leilão. Pode aumentar seu teto automático.',
  BID_TOO_LOW: 'O lance está abaixo do mínimo. Confira o preço atualizado.',
  MAX_TOO_LOW: 'O teto está abaixo do lance mínimo.',
  MAX_NOT_HIGHER: 'O novo teto deve ser maior que o anterior.',
  INVALID_MONEY: 'Informe um valor válido, como 1.234,50.',
  CONTACT_SHARING_BLOCKED: 'Não compartilhe contatos ou links neste campo.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto.',
  DECLARATION_REQUIRED: 'Aceite a declaração de veracidade para publicar.',
  IDEMPOTENCY_CONFLICT: 'Esta tentativa já foi usada para outro lance. Atualize a página.',
  IDENTITY_NOT_VERIFIED: 'Verifique sua identidade antes de publicar leilões.',
  TOO_CLOSE_TO_END: 'Já tem lance e falta menos de 1 dia para o fim — não é mais possível cancelar.',
  HAS_BIDS: 'Este leilão já recebeu lances e não pode mais ser cancelado dessa forma.',
  NOT_CANCELLABLE: 'Este leilão não está mais em um estado que permite cancelamento.',
  INVALID_ORDER_STATE: 'O pedido não está em um estado que permite essa ação agora.',
  CHECKLIST_REQUIRED: 'Responda o checklist de funcionamento antes de publicar.',
  CHECKLIST_INCOMPLETE: 'Responda todas as perguntas do checklist de funcionamento.',
  CHECKLIST_INVALID: 'O checklist não corresponde à categoria escolhida. Revise as respostas.',
  DEFECTS_DESCRIPTION_REQUIRED: 'Descreva os defeitos do item antes de publicar.',
  DEFECT_PHOTO_REQUIRED: 'Adicione pelo menos 1 foto do defeito.',
  AS_IS_ACK_REQUIRED: 'Este item é vendido no estado. Aceite as condições antes de dar lance.',
  AS_IS_REASON_NOT_ALLOWED:
    'Item vendido no estado não admite disputa por dano ou mau funcionamento. Use "Item diferente do anúncio" se for o caso.',
  NOT_RELISTABLE: 'Só é possível relançar leilões encerrados sem lances.',
  INVALID_START_PRICE: 'O valor inicial deve ficar entre R$ 50 e R$ 200.000.',
  INVALID_DURATION: 'Escolha uma duração de 3, 5, 7 ou 10 dias.',
  SAVED_SEARCH_LIMIT: 'Você já tem 10 buscas salvas. Exclua uma para salvar outra.',
  MIN_IMAGES: 'Adicione pelo menos 3 fotos.',
  MAX_IMAGES: 'O limite é de 10 fotos por anúncio.',
  INVALID_IMEI: 'IMEI inválido: confira os 15 dígitos (disque *#06# no celular).',
  IMEI_REQUIRED: 'Informe o IMEI do celular antes de publicar.',
  OFFER_NOT_AVAILABLE: 'Esta oferta não está mais disponível.',
  OFFER_EXPIRED: 'O prazo desta oferta terminou.',
  ORDER_NOT_FOUND: 'Pedido não encontrado.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  LISTING_LOCKED: 'Este anúncio já foi publicado e não pode mais ser alterado.',
  // mensagens do Supabase Auth
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'User already registered': 'Este e-mail já tem cadastro. Tente entrar.',
  'Password should be at least': 'A senha precisa ter pelo menos 6 caracteres.',
  'rate limit': 'Muitas tentativas. Aguarde alguns minutos.',
  'Failed to fetch': 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
};

const GENERIC = 'Não foi possível concluir agora. Tente novamente em instantes.';

/**
 * Erro vindo do banco/API (Postgrest, Storage) ou texto técnico em inglês: nunca vai para a tela.
 * Os erros de domínio (códigos acima) e os textos pt-BR lançados pelo próprio app passam.
 */
function isInternal(error: unknown, message: string): boolean {
  if (error && typeof error === 'object' && ['code', 'details', 'hint', 'statusCode'].some((k) => k in error))
    return true;
  return /column|relation|function|permission denied|violates|syntax error|schema cache|JWT|does not exist|duplicate key|PGRST|constraint|null value/i.test(
    message,
  );
}

export function errorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const known = Object.entries(messages).find(([code]) => message.includes(code))?.[1];
  if (known) return known;
  if (!message || isInternal(error, message)) {
    if (import.meta.env.DEV && message) console.warn('[erro interno ocultado da UI]', message);
    return GENERIC;
  }
  return message;
}
