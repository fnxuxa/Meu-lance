/** IMEI: 15 dígitos com dígito verificador (Luhn). Espelha public.imei_is_valid(). */
export const normalizeImei = (input: string) => input.replace(/\D/g, '');

export function isValidImei(input: string): boolean {
  const imei = normalizeImei(input);
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Página oficial da Anatel para consultar se o aparelho tem restrição (roubo, perda, irregular). */
export const ANATEL_IMEI_URL = 'https://www.gov.br/anatel/pt-br/assuntos/celular-legal/consulte-sua-situacao';
