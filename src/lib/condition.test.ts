import { describe, expect, it } from 'vitest';
import {
  checklistFor,
  conditionLabel,
  defectRequirements,
  hasChecklistProblem,
  isChecklistComplete,
} from './condition';
import { feeCents } from './money';

const config = {
  celulares: [
    { key: 'powers_on', label: 'Liga' },
    { key: 'screen_ok', label: 'Tela' },
  ],
  _default: [{ key: 'works_ok', label: 'Funciona' }],
};

describe('estado do item', () => {
  it('usa perguntas da categoria ou as genéricas', () => {
    expect(checklistFor(config, 'celulares')).toHaveLength(2);
    expect(checklistFor(config, 'casa')).toEqual(config._default);
    expect(checklistFor(undefined, 'celulares')).toEqual([]);
  });

  it('só considera completo com resposta válida para cada item', () => {
    const items = checklistFor(config, 'celulares');
    expect(isChecklistComplete(items, { powers_on: 'yes' })).toBe(false);
    expect(isChecklistComplete(items, { powers_on: 'yes', screen_ok: 'untested' })).toBe(true);
  });

  it('segue a regra do servidor para descrição e foto do defeito', () => {
    expect(defectRequirements('good', { powers_on: 'yes' }, '')).toEqual({
      needsDescription: false,
      needsDefectPhoto: false,
    });
    expect(defectRequirements('good', { powers_on: 'no' }, '')).toEqual({
      needsDescription: true,
      needsDefectPhoto: true,
    });
    expect(defectRequirements('good', {}, 'Risco na tampa')).toEqual({
      needsDescription: false,
      needsDefectPhoto: true,
    });
    expect(defectRequirements('for_parts', {}, '').needsDescription).toBe(true);
    expect(hasChecklistProblem(null)).toBe(false);
  });

  it('traduz a condição', () => {
    expect(conditionLabel('for_parts')).toBe('No estado / para peças');
    expect(conditionLabel('new')).toBe('Novo');
  });

  it('taxa do comprador de 3% arredonda como o servidor', () => {
    expect(feeCents(10_000, 300)).toBe(300);
    expect(feeCents(12_345, 300)).toBe(370); // 370,35 → 370
    expect(feeCents(12_350, 300)).toBe(371); // 370,5 → 371 (round do Postgres)
  });
});
