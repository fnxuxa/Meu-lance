import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, ShieldCheck, UploadCloud, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { compressListingImage } from '../../lib/images';
import { errorMessage } from '../../lib/errors';
import { useSession } from './useSession';
import { useProfile } from './useProfile';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { BackButton } from '../../components/BackButton';
export function IdentityVerification() {
  const { user, loading } = useSession();
  const profile = useProfile();
  useDocumentMeta({ title: 'Verificação de identidade', noindex: true });
  const pending = useQuery({
    queryKey: ['identity-verification', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('identity_verifications')
        .select('status,created_at,rejection_reason')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const row = pending.data;
  const [document, setDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (loading || profile.isPending || (user && pending.isPending))
    return (
      <main className="page simple">
        <p>Carregando…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Verificação de identidade</h1>
        <Link className="btn primary" to="/entrar">
          Entrar
        </Link>
      </main>
    );
  if (profile.data?.identity_verified_at)
    return (
      <main className="page simple">
        <BackButton />
        <h1>Verificação de identidade</h1>
        <div className="notice">
          <CheckCircle2 size={16} />
          Sua identidade já foi verificada. Você pode publicar leilões normalmente.
        </div>
      </main>
    );
  if (row?.status === 'pending')
    return (
      <main className="page simple">
        <BackButton />
        <h1>Verificação de identidade</h1>
        <div className="notice">
          <Clock size={16} />
          Seus documentos foram enviados em {new Date(row.created_at).toLocaleDateString('pt-BR')} e estão
          em análise. Isso costuma levar até 1 dia útil.
        </div>
      </main>
    );
  return (
    <main className="page auth-page">
      <div className="auth-card">
        <BackButton />
        <span className="auth-card-icon">
          <ShieldCheck size={22} />
        </span>
        <h1>Verifique sua identidade</h1>
        <p className="muted">
          Para vender no MeuLance, pedimos um documento com foto e uma selfie — isso ajuda a evitar fraude
          e a venda de itens roubados. Um documento nunca é publicado; só nossa equipe tem acesso.
        </p>
        {row?.status === 'rejected' && (
          <div className="auth-message error">
            Sua última verificação foi recusada{row.rejection_reason ? `: ${row.rejection_reason}` : '.'}{' '}
            Envie fotos mais nítidas e tente novamente.
          </div>
        )}
        <label className="upload">
          <UploadCloud />
          <b>{document ? document.name : 'Foto do RG, CNH ou passaporte'}</b>
          <span>JPG, PNG ou WebP</span>
          <input
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="upload">
          <UploadCloud />
          <b>{selfie ? selfie.name : 'Uma selfie sua, rosto visível'}</b>
          <span>JPG, PNG ou WebP</span>
          <input
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="btn primary wide"
          disabled={!document || !selfie || busy}
          onClick={async () => {
            if (!supabase || !document || !selfie) return;
            setBusy(true);
            setMessage('');
            try {
              const docFile = await compressListingImage(document);
              const selfieFile = await compressListingImage(selfie);
              const docPath = `${user.id}/document-${crypto.randomUUID()}.webp`;
              const selfiePath = `${user.id}/selfie-${crypto.randomUUID()}.webp`;
              const up1 = await supabase.storage.from('identity-documents').upload(docPath, docFile);
              if (up1.error) throw up1.error;
              const up2 = await supabase.storage.from('identity-documents').upload(selfiePath, selfieFile);
              if (up2.error) throw up2.error;
              const { error } = await supabase
                .from('identity_verifications')
                .insert({ user_id: user.id, document_path: docPath, selfie_path: selfiePath });
              if (error) throw error;
              await pending.refetch();
            } catch (e) {
              setMessage(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Enviando…' : 'Enviar para análise'}
        </button>
        {message && (
          <p className="auth-message error" role="status">
            <XCircle size={14} /> {message}
          </p>
        )}
      </div>
    </main>
  );
}
