import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
export function OrderChat({ orderId, userId }: { orderId: string; userId: string }) {
  const [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['chat', orderId, userId],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('order_messages')
        .select('id,body,sender_id,created_at')
        .eq('order_id', orderId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
  const refetch = query.refetch;
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const c = sb
      .channel('chat:' + orderId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: 'order_id=eq.' + orderId },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(c);
    };
  }, [orderId, refetch]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [query.data]);
  return (
    <section className="chat">
      <div className="chat-header">
        <h2>Chat do pedido</h2>
        <span className="chat-live">
          <i /> Tempo real
        </span>
      </div>
      <div className="messages" ref={listRef}>
        {query.isPending ? (
          <p className="chat-empty">Carregando mensagens…</p>
        ) : query.error ? (
          <p className="chat-empty" role="alert">
            {errorMessage(query.error)}
          </p>
        ) : query.data?.length ? (
          query.data.map((x) => (
            <div className={x.sender_id === userId ? 'message mine' : 'message'} key={x.id}>
              <p>{x.body}</p>
              <small>
                {new Date(x.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </small>
            </div>
          ))
        ) : (
          <p className="chat-empty">Ainda não há mensagens. Diga oi!</p>
        )}
      </div>
      <div className="chat-footer">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase || !body.trim() || busy) return;
            setBusy(true);
            try {
              const { error } = await supabase
                .from('order_messages')
                .insert({ order_id: orderId, sender_id: userId, body: body.trim() });
              if (error) throw error;
              setBody('');
              setMessage('');
              await refetch();
            } catch (err) {
              setMessage(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            maxLength={2000}
            required
            aria-label="Mensagem"
            placeholder="Escreva uma mensagem…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="send" type="submit" disabled={busy || !body.trim()} aria-label="Enviar mensagem">
            <Send size={17} />
          </button>
        </form>
      </div>
      {message && (
        <p role="status" className="chat-error">
          {message}
        </p>
      )}
    </section>
  );
}
