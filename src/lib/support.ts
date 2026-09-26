// Canal de suporte por WhatsApp (número público do MeuLance).
export const SUPPORT_WHATSAPP_E164 = '5534992711012';
export const SUPPORT_WHATSAPP_LABEL = '(34) 99271-1012';
export const SUPPORT_HOURS = 'Respondemos assim que possível, em geral em horário comercial.';

export function supportWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_E164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
