import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
type Q = { id: string; body: string; answer: string | null };
export function PublicQuestions({ listingId, sellerId }: { listingId: string; sellerId?: string }) {
  const { user } = useSession();
  const [body, setBody] = useState(''),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['questions', listingId],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('questions')
        .select('id,body,answer')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Q[];
    },
    refetchInterval: 30000,
  });
  const refetch = query.refetch;
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase,
      c = sb
        .channel('questions:' + listingId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'questions', filter: 'listing_id=eq.' + listingId },
          () => {
            void refetch();
          },
        )
        .subscribe();
    return () => {
      void sb.removeChannel(c);
    };
  }, [listingId, refetch]);
  async function send(id?: string) {
    if (!supabase || !user || busy) {
      setMessage('Entre na sua conta para continuar.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const text = (id ? (answers[id] ?? '') : body).trim();
      if (text.length < 2 || text.length > 800) throw new Error('Escreva entre 2 e 800 caracteres.');
      const { error } = id
        ? await supabase.rpc('answer_question', { p_question: id, p_answer: text })
        : await supabase.from('questions').insert({ listing_id: listingId, author_id: user.id, body: text });
      if (error) throw error;
      setBody('');
      setMessage(id ? 'Resposta salva.' : 'Pergunta enviada.');
      await refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="questions">
      <h2>Perguntas e respostas</h2>
      {user?.id !== sellerId && (
        <div className="ask-row">
          <input
            aria-label="Pergunta ao vendedor"
            maxLength={800}
            value={body}
            disabled={busy || !user}
            onChange={(e) => setBody(e.target.value)}
            placeholder={user ? 'Pergunte ao vendedor…' : 'Entre para perguntar'}
          />
          <button className="btn primary" disabled={busy || !user || !supabase} onClick={() => void send()}>
            Perguntar
          </button>
        </div>
      )}
      {(message || query.error) && <p role="status">{message || errorMessage(query.error)}</p>}
      {supabase && query.isPending ? (
        <p>Carregando perguntas…</p>
      ) : (
        !query.data?.length && <p>Ainda não há perguntas.</p>
      )}
      {query.data?.map((q) => (
        <article key={q.id}>
          <p>{q.body}</p>
          {q.answer ? (
            <blockquote>
              <b>Vendedor</b>
              <p>{q.answer}</p>
            </blockquote>
          ) : (
            <small>Aguardando resposta</small>
          )}
          {user?.id === sellerId && (
            <div>
              <label>
                Resposta
                <input
                  maxLength={800}
                  value={answers[q.id] ?? q.answer ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                />
              </label>
              <button disabled={busy} onClick={() => void send(q.id)}>
                Salvar resposta
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
