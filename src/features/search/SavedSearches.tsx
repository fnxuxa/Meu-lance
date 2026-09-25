import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BellPlus, BellRing, Check, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { formatBRL } from '../../lib/money';
import { CONDITIONS, conditionLabel } from '../../lib/condition';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { BackButton } from '../../components/BackButton';

type SavedSearch = {
  id: string;
  query: string | null;
  condition: string | null;
  state: string | null;
  max_price_cents: number | null;
  created_at: string;
  categories: { name: string; slug: string } | null;
};

/** Salva os filtros atuais da busca; o servidor avisa quando um anúncio compatível começar. */
export function SaveSearchButton({
  q,
  categorySlug,
  conditionText,
}: {
  q: string;
  categorySlug: string;
  /** rótulo exibido no filtro de condição (ex.: "Como novo") */
  conditionText: string;
}) {
  const { user } = useSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [message, setMessage] = useState('');
  const query = q.trim().replace(/\s+/g, ' ');
  if (!supabase) return null;
  if (!user)
    return (
      <div className="save-search">
        <BellRing className="save-search-icon" aria-hidden />
        <div>
          <b>Receba um aviso quando aparecer um anúncio assim</b>
          <span>Entre na sua conta para ativar alertas de busca.</span>
        </div>
        <Link className="btn secondary" to="/entrar">
          Entrar
        </Link>
      </div>
    );
  const usable = query.length >= 2 || !!categorySlug;
  async function save() {
    if (!supabase || !user || busy) return;
    setBusy(true);
    setMessage('');
    try {
      let categoryId: string | null = null;
      if (categorySlug) {
        const { data, error } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', categorySlug)
          .maybeSingle();
        if (error) throw error;
        categoryId = data?.id ?? null;
      }
      const code = CONDITIONS.find((c) => conditionLabel(c.code) === conditionText)?.code ?? null;
      const { error } = await supabase.from('saved_searches').insert({
        user_id: user.id,
        query: query.length >= 2 ? query.slice(0, 100) : null,
        category_id: categoryId,
        condition: code,
      });
      if (error && error.code !== '23505') throw error;
      setSaved(true);
      void client.invalidateQueries({ queryKey: ['saved-searches'] });
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={'save-search' + (saved ? ' saved' : '')}>
      <BellRing className="save-search-icon" aria-hidden />
      <div>
        <b>{saved ? 'Alerta ativado' : 'Receba um aviso quando aparecer um anúncio assim'}</b>
        <span>
          {saved ? (
            <>
              Avisaremos quando um anúncio compatível começar.{' '}
              <Link to="/conta/buscas">Gerenciar alertas</Link>
            </>
          ) : usable ? (
            'Salvamos esta busca e você recebe uma notificação a cada novo anúncio compatível.'
          ) : (
            'Digite o que procura ou escolha uma categoria para criar um alerta.'
          )}
        </span>
        {message && (
          <span role="alert" className="auth-message error">
            {message}
          </span>
        )}
      </div>
      {saved ? (
        <span className="btn secondary save-search-done" aria-live="polite">
          <Check size={16} aria-hidden /> Ativado
        </span>
      ) : (
        <button type="button" className="btn primary" disabled={!usable || busy} onClick={() => void save()}>
          <BellPlus size={16} aria-hidden /> {busy ? 'Salvando…' : 'Criar alerta'}
        </button>
      )}
    </div>
  );
}

function describe(s: SavedSearch) {
  return [
    s.query && `“${s.query}”`,
    s.categories?.name,
    s.condition && conditionLabel(s.condition),
    s.state,
    s.max_price_cents && `até ${formatBRL(s.max_price_cents)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function searchHref(s: SavedSearch) {
  const p = new URLSearchParams();
  if (s.query) p.set('q', s.query);
  if (s.categories?.slug) p.set('cat', s.categories.slug);
  if (s.condition) p.set('condicao', conditionLabel(s.condition));
  const qs = p.toString();
  return '/buscar' + (qs ? '?' + qs : '');
}

export function SavedSearchesPage() {
  const { user, loading } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null),
    [message, setMessage] = useState('');
  useDocumentMeta({ title: 'Buscas salvas', noindex: true });
  const query = useQuery({
    queryKey: ['saved-searches', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('saved_searches')
        .select('id,query,condition,state,max_price_cents,created_at,categories(name,slug)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SavedSearch[];
    },
  });
  async function remove(id: string) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.from('saved_searches').delete().eq('id', id);
      if (error) throw error;
      await query.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  if (loading || (user && query.isPending))
    return (
      <main className="page simple">
        <p>Carregando buscas salvas…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Buscas salvas</h1>
        <Link className="btn primary" to="/entrar">
          Entrar
        </Link>
      </main>
    );
  return (
    <main className="page simple">
      <BackButton />
      <h1>Buscas salvas</h1>
      <p className="muted">
        Você recebe uma notificação quando um anúncio compatível começa. Limite de 10 buscas.
      </p>
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
      {query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : !query.data?.length ? (
        <div className="empty-state">
          <BellRing />
          <h2>Nenhuma busca salva</h2>
          <p>Faça uma busca e toque em “Criar alerta”.</p>
          <Link className="btn secondary" to="/buscar">
            <Search size={15} /> Buscar anúncios
          </Link>
        </div>
      ) : (
        <ul className="saved-search-list">
          {query.data.map((s) => (
            <li key={s.id}>
              <Link to={searchHref(s)}>{describe(s)}</Link>
              <button
                type="button"
                className="icon-btn"
                aria-label={'Excluir busca ' + describe(s)}
                disabled={busyId === s.id}
                onClick={() => void remove(s.id)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
