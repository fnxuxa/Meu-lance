import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
type Pref = {
  auction_ending: boolean;
  outbid: boolean;
  won: boolean;
  order_updates: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
};
const initial: Pref = {
  auction_ending: true,
  outbid: true,
  won: true,
  order_updates: true,
  push_enabled: false,
  email_enabled: true,
};
export function NotificationSettings() {
  const { user, loading: authLoading } = useSession();
  useDocumentMeta({ title: 'Notificações', noindex: true });
  const [p, setP] = useState(initial),
    [msg, setMsg] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setP(initial);
    setMsg('');
    setLoading(true);
    if (authLoading) return;
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    void supabase
      .from('notification_preferences')
      .select('auction_ending,outbid,won,order_updates,push_enabled,email_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMsg(errorMessage(error));
        else if (data) setP(data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, authLoading]);
  async function save(next: Pref) {
    if (!supabase || !user || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('notification_preferences').upsert({ user_id: user.id, ...next });
      if (error) throw error;
      setP(next);
      setMsg('Preferências salvas.');
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (authLoading || loading)
    return (
      <main className="page simple">
        <p>Carregando preferências…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Notificações</h1>
        <p>Entre para configurar seus alertas.</p>
      </main>
    );
  return (
    <main className="page simple settings">
      <h1>Notificações</h1>
      <p>Escolha os avisos que deseja receber na plataforma.</p>
      {(
        [
          ['auction_ending', 'Anúncio terminando'],
          ['outbid', 'Fui superado'],
          ['won', 'Meu lance foi o maior'],
          ['order_updates', 'Atualizações do pedido'],
        ] as [keyof Pref, string][]
      ).map(([k, label]) => (
        <label className="setting-row" key={k}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={p[k]}
            disabled={busy}
            onChange={() => void save({ ...p, [k]: !p[k] })}
          />
        </label>
      ))}
      <p>
        E-mail e notificações push ainda não estão disponíveis. Os alertas de encerramento aguardam ativação
        do agendamento.
      </p>
      {msg && <p role="status">{msg}</p>}
    </main>
  );
}
