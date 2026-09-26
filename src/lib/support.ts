// Canal de suporte por WhatsApp (número público do MeuLance).
export const SUPPORT_WHATSAPP_E164 = '5534992711012';
export const SUPPORT_HOURS = 'Respondemos assim que possível, em geral em horário comercial.';

export function supportWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_E164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Abre a conversa só no clique: o número não aparece na página nem em links visíveis.
export function openSupportWhatsApp(message?: string): void {
  window.open(supportWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
}
