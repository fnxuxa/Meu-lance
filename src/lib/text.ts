/** Minúsculas e sem acentos: "Célular São Paulo" → "celular sao paulo". Usado na busca local. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Contagem com plural pt-BR: plural(1, 'lance', 'lances') → "1 lance". */
export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;
}
