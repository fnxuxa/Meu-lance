/**
 * Estado do item: escala de condição, checklist de funcionamento por categoria e venda "no estado".
 * O servidor (publish_listing / set_listing_condition_report) valida tudo; isto só orienta a UI.
 * As explicações completas ficam nos Termos de Uso (/termos#estado-do-item).
 */
export type ConditionCode = 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';

export const CONDITIONS: readonly { code: ConditionCode; label: string; hint: string }[] = [
  { code: 'like_new', label: 'Como novo', hint: 'Funciona 100%, sem marcas visíveis.' },
  { code: 'good', label: 'Bom', hint: 'Funciona 100%, com marcas leves de uso.' },
  { code: 'fair', label: 'Regular', hint: 'Funciona, com marcas fortes ou pequenos defeitos declarados.' },
  {
    code: 'for_parts',
    label: 'No estado / para peças',
    hint: 'Pode não funcionar. Vendido como está, sem garantia de funcionamento.',
  },
];

const LABELS: Record<string, string> = {
  new: 'Novo',
  ...Object.fromEntries(CONDITIONS.map((c) => [c.code, c.label])),
};
export const conditionLabel = (code: string) => LABELS[code] ?? code;
export const conditionHint = (code: string) => CONDITIONS.find((c) => c.code === code)?.hint;

export type ChecklistAnswer = 'yes' | 'no' | 'untested' | 'na';
export type ChecklistItem = { key: string; label: string };
export type Checklist = Record<string, ChecklistAnswer>;
export type ChecklistConfig = Record<string, ChecklistItem[]>;

export const ANSWERS: readonly { value: ChecklistAnswer; label: string }[] = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
  { value: 'untested', label: 'Não testei' },
  { value: 'na', label: 'Não se aplica' },
];
/**
 * Cópia das perguntas padrão de app_config.condition_checklists (migration 20260922100000).
 * Usada quando a configuração ainda não chegou do banco, para o formulário nunca travar.
 * O servidor continua validando com a versão do banco.
 */
export const DEFAULT_CHECKLISTS: ChecklistConfig = {
  celulares: [
    { key: 'powers_on', label: 'Liga e funciona normalmente' },
    { key: 'screen_ok', label: 'Tela sem trincas, manchas ou toque falhando' },
    { key: 'battery_ok', label: 'Bateria segura carga normalmente' },
    { key: 'cameras_ok', label: 'Câmeras funcionam' },
    { key: 'biometrics_ok', label: 'Biometria / Face ID funciona' },
    { key: 'account_free', label: 'Sem bloqueio de conta (iCloud/Google) ou operadora' },
    { key: 'charging_ok', label: 'Carrega pelo conector' },
  ],
  'pc-games': [
    { key: 'powers_on', label: 'Liga e funciona normalmente' },
    { key: 'stable', label: 'Sem superaquecimento ou travamentos em uso prolongado' },
    { key: 'ports_ok', label: 'Todas as portas e entradas funcionam' },
    { key: 'accessories_ok', label: 'Controles e acessórios inclusos funcionam' },
    { key: 'never_mined', label: 'Nunca usado para mineração (placas de vídeo)' },
    { key: 'never_repaired', label: 'Sem sinais de abertura ou reparo' },
  ],
  eletronicos: [
    { key: 'powers_on', label: 'Liga e funciona normalmente' },
    { key: 'display_ok', label: 'Imagem sem manchas, linhas ou pixels mortos' },
    { key: 'sound_ok', label: 'Som funciona' },
    { key: 'ports_ok', label: 'Todas as entradas funcionam' },
    { key: 'accessories_ok', label: 'Controle remoto e acessórios inclusos' },
  ],
  casa: [
    { key: 'structure_ok', label: 'Estrutura firme, sem quebras' },
    { key: 'works_ok', label: 'Funciona normalmente (se for elétrico)' },
    { key: 'surface_ok', label: 'Sem manchas, rasgos ou mofo' },
    { key: 'parts_ok', label: 'Todas as peças e acessórios presentes' },
  ],
  ferramentas: [
    { key: 'powers_on', label: 'Liga e funciona normalmente' },
    { key: 'no_play', label: 'Sem folgas ou ruídos anormais' },
    { key: 'battery_ok', label: 'Bateria e carregador inclusos funcionam' },
    { key: 'accessories_ok', label: 'Acessórios presentes' },
  ],
  esportes: [
    { key: 'frame_ok', label: 'Quadro / estrutura sem trincas ou soldas' },
    { key: 'brakes_ok', label: 'Freios funcionam' },
    { key: 'gears_ok', label: 'Câmbio / marchas funcionam' },
    { key: 'tires_ok', label: 'Pneus e câmaras em condição de uso' },
  ],
  instrumentos: [
    { key: 'playable', label: 'Todas as notas / teclas / trastes funcionam' },
    { key: 'body_ok', label: 'Sem trincas no corpo ou braço' },
    { key: 'electronics_ok', label: 'Parte elétrica (captadores, saída) funciona' },
    { key: 'tuning_ok', label: 'Segura afinação normalmente' },
  ],
  colecionaveis: [
    { key: 'complete', label: 'Completo, sem peças faltando' },
    { key: 'no_damage', label: 'Sem danos, descolamentos ou desbotamento' },
    { key: 'original_box', label: 'Acompanha embalagem original' },
  ],
  _default: [
    { key: 'works_ok', label: 'Funciona normalmente' },
    { key: 'structure_ok', label: 'Sem danos estruturais' },
    { key: 'parts_ok', label: 'Peças e acessórios presentes' },
  ],
};

export const answerLabel = (a: string) => ANSWERS.find((x) => x.value === a)?.label ?? '—';

/** Perguntas da categoria (ou as genéricas). Espelha public._checklist_items(). */
export function checklistFor(config: ChecklistConfig | undefined, categorySlug?: string): ChecklistItem[] {
  if (!config) return [];
  return (categorySlug && config[categorySlug]) || config._default || [];
}

export const isChecklistComplete = (items: ChecklistItem[], answers: Partial<Checklist>) =>
  items.every((i) => ANSWERS.some((a) => a.value === answers[i.key]));

export const hasChecklistProblem = (answers: Partial<Checklist> | null | undefined) =>
  !!answers && Object.values(answers).includes('no');

/** Mesma regra do servidor: problema marcado, defeito descrito ou venda no estado exigem foto do defeito. */
export function defectRequirements(condition: string, answers: Partial<Checklist>, defectsText: string) {
  const problem = hasChecklistProblem(answers);
  const described = defectsText.trim().length > 0;
  return {
    needsDescription: problem || condition === 'for_parts',
    needsDefectPhoto: problem || described || condition === 'for_parts',
  };
}
