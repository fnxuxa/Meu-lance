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
};
export function errorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return (
    Object.entries(messages).find(([code]) => message.includes(code))?.[1] ||
    message ||
    'Não foi possível concluir. Tente novamente.'
  );
}
