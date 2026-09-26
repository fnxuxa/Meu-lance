import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { compressListingImage } from '../../lib/images';

type Role = 'buyer' | 'seller' | 'staff';
type Thread = {
  dispute: {
    id: string;
    status: string;
    closed: boolean;
    purged: boolean;
    resolved_at: string | null;
    resolution_note: string | null;
    purge_at: string | null;
  };
  messages: { id: string; body: string; created_at: string; mine: boolean; role: Role }[];
  evidence: {
    id: string;
    kind: string;
    storage_path: string | null;
    created_at: string;
    mine: boolean;
    role: Role;
  }[];
};
const ROLE_LABEL: Record<Role, string> = { buyer: 'Comprador', seller: 'Vendedor', staff: 'Equipe MeuLance' };
const BUCKET = 'dispute-evidence';

function EvidenceImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase?.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return <span className="muted small">Carregando foto…</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Prova da disputa" loading="lazy" width={120} height={120} />
    </a>
  );
}

// Provas (fotos) e conversa a três: comprador, vendedor e equipe. Some do pedido sozinha
// se não houver disputa. Papéis e permissões vêm do servidor.
export function DisputeThread({
  orderId,
  userId,
  staff = false,
}: {
  orderId: string;
  userId: string;
  staff?: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const key = ['dispute-thread', orderId];
  const query = useQuery({
    queryKey: key,
    enabled: !!supabase,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_dispute_thread', { p_order_id: orderId });
      if (error) throw error;
      return data as Thread | null;
    },
  });
  const t = query.data;
  if (!t) return null;
  const d = t.dispute;
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  async function send() {
    if (!supabase || busy || !body.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('send_dispute_message', { p_dispute: d.id, p_body: body.trim() });
      if (error) throw error;
      setBody('');
      await refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!supabase || busy || !file) return;
    setBusy(true);
    setMessage('');
    try {
      const webp = await compressListingImage(file);
      const path = `${userId}/${d.id}/${webp.name}`;
      const up = await supabase.storage.from(BUCKET).upload(path, webp, { contentType: 'image/webp' });
      if (up.error) throw up.error;
      const { error } = await supabase
        .from('dispute_evidence')
        .insert({ dispute_id: d.id, author_id: userId, kind: 'image', storage_path: path });
      if (error) throw error;
      await refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const purgeText = d.purge_at
    ? 'em ' + new Date(d.purge_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '30 dias após a decisão';

  return (
    <section className="chat dispute-thread" aria-label="Disputa">
      <div className="chat-header">
        <h2>Disputa: provas e conversa</h2>
      </div>
      <p className="muted small" style={{ padding: '0 16px' }}>
        Comprador, vendedor e a equipe do MeuLance conversam aqui. As fotos e mensagens são apagadas{' '}
        {purgeText}.
      </p>
      {d.closed && (
        <p className="notice" style={{ margin: '0 16px' }}>
          Disputa encerrada{d.resolution_note ? ': ' + d.resolution_note : '.'}
        </p>
      )}
      {d.purged && (
        <p className="muted small" style={{ padding: '0 16px' }}>
          As provas e a conversa foram apagadas.
        </p>
      )}
      {t.evidence.some((e) => e.storage_path) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
          {t.evidence.map(
            (e) =>
              e.storage_path && (
                <figure key={e.id} style={{ margin: 0 }}>
                  <EvidenceImage path={e.storage_path} />
                  <figcaption className="muted small">{e.mine ? 'Você' : ROLE_LABEL[e.role]}</figcaption>
                </figure>
              ),
          )}
        </div>
      )}
      <div className="messages">
        {!t.messages.length && <p className="chat-empty">Nenhuma mensagem ainda.</p>}
        {t.messages.map((m) => (
          <div key={m.id} className={m.mine ? 'msg mine' : 'msg'}>
            <small className="muted">{m.mine ? 'Você' : ROLE_LABEL[m.role]}</small>
            <p style={{ margin: 0 }}>{m.body}</p>
          </div>
        ))}
      </div>
      {!d.closed && (
        <div className="chat-footer">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {!staff && (
              <label className="btn ghost" aria-label="Anexar foto" style={{ cursor: 'pointer' }}>
                <ImagePlus size={17} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            <input
              maxLength={2000}
              aria-label="Mensagem da disputa"
              placeholder="Escreva na conversa da disputa…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              className="send"
              type="submit"
              disabled={busy || !body.trim()}
              aria-label="Enviar mensagem"
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
      {message && (
        <p role="status" className="chat-error">
          {message}
        </p>
      )}
    </section>
  );
}
