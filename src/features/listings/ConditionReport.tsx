import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CircleHelp, Minus, X } from 'lucide-react';
import { answerLabel, checklistFor, conditionHint, conditionLabel } from '../../lib/condition';
import { useAppConfig } from '../../lib/useAppConfig';
import type { Listing } from '../../types/domain';

const ICON = { yes: Check, no: X, untested: CircleHelp, na: Minus } as const;

/** Resumo do estado declarado pelo vendedor. As regras completas ficam nos Termos (§8–10). */
export function ConditionReport({ item }: { item: Listing }) {
  const { checklists } = useAppConfig();
  const code = item.conditionCode ?? '';
  const items = checklistFor(checklists, item.categorySlug);
  const answered = item.checklist ? items.filter((i) => item.checklist?.[i.key]) : [];
  return (
    <section className="condition-report" aria-labelledby="condition-title">
      <span className="kicker">ESTADO DO ITEM</span>
      <h2 id="condition-title">
        <span className={'condition-badge ' + code}>{conditionLabel(code || item.condition)}</span>
      </h2>
      {code && <p className="muted">{conditionHint(code)}</p>}
      {code === 'for_parts' && (
        <div className="as-is-banner" role="note">
          <AlertTriangle aria-hidden />
          <div>
            <b>Vendido no estado, para peças ou conserto.</b>
            <span>
              Pode não funcionar e não tem garantia de funcionamento.{' '}
              <Link to="/termos#no-estado">Entenda o que isso cobre</Link>.
            </span>
          </div>
        </div>
      )}
      {answered.length > 0 && (
        <ul className="checklist-summary">
          {answered.map((i) => {
            const a = item.checklist![i.key];
            const Icon = ICON[a] ?? Minus;
            return (
              <li key={i.key} className={'answer-' + a}>
                <Icon size={16} aria-hidden />
                <span>{i.label}</span>
                <b>{answerLabel(a)}</b>
              </li>
            );
          })}
        </ul>
      )}
      {item.defects && (
        <>
          <h3>Defeitos e marcas informados</h3>
          <p className="prewrap">{item.defects}</p>
        </>
      )}
      {!!item.defectImages?.length && (
        <div className="defect-photos">
          {item.defectImages.map((src, i) => (
            <a key={src} href={src} target="_blank" rel="noopener">
              <img src={src} alt={`Foto do defeito ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <p className="muted small">
        Informações declaradas pelo vendedor. Como a proteção funciona em cada caso:{' '}
        <Link to="/termos#estado-do-item">Termos de Uso</Link>.
      </p>
    </section>
  );
}
