import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, LogOut, MapPin, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from './useSession';
import { useProfile } from './useProfile';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { compressListingImage } from '../../lib/images';
import { BR_STATES, citiesForUf } from '../../lib/brazil';
import { BackButton } from '../../components/BackButton';
function ProfileCard() {
  const { user } = useSession();
  const profile = useProfile();
  const [displayName, setDisplayName] = useState(''),
    [fullName, setFullName] = useState(''),
    [uf, setUf] = useState(''),
    [city, setCity] = useState(''),
    [cityOptions, setCityOptions] = useState<string[]>([]),
    [avatarUrl, setAvatarUrl] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [uploadingAvatar, setUploadingAvatar] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState<'error' | 'success' | ''>('');
  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? '');
    setFullName(profile.data.full_name ?? '');
    setUf(profile.data.state ?? '');
    setCity(profile.data.city ?? '');
    setAvatarUrl(profile.data.avatar_url);
  }, [profile.data]);
  useEffect(() => {
    let active = true;
    if (!uf) return void setCityOptions([]);
    void citiesForUf(uf).then((list) => {
      if (active) setCityOptions(list);
    });
    return () => {
      active = false;
    };
  }, [uf]);
  if (!user) return null;
  if (profile.isPending)
    return (
      <div className="account-card">
        <p className="muted">Carregando perfil…</p>
      </div>
    );
  const verified = !!profile.data?.identity_verified_at;
  return (
    <div className="account-card">
      <div className="account-identity">
        <label className="account-avatar-upload" title="Clique para trocar sua foto de perfil">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={20} />}
          <span className="account-avatar-badge">
            <Camera size={12} />
          </span>
          <input
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadingAvatar}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !supabase || !user) return;
              setUploadingAvatar(true);
              setMessage('');
              try {
                const compressed = await compressListingImage(file, 400, 0.85);
                const path = `${user.id}/avatar-${crypto.randomUUID()}.webp`;
                const up = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true });
                if (up.error) throw up.error;
                const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
                const { error } = await supabase
                  .from('profiles')
                  .update({ avatar_url: url })
                  .eq('id', user.id);
                if (error) throw error;
                setAvatarUrl(url);
                await profile.refetch();
              } catch (err) {
                setStatus('error');
                setMessage(errorMessage(err));
              } finally {
                setUploadingAvatar(false);
              }
            }}
          />
        </label>
        <div>
          <h2 style={{ margin: 0 }}>Meu perfil</h2>
          <p className="muted" style={{ margin: 0 }}>
            {user.email}
          </p>
        </div>
        <span className={'identity-pill' + (verified ? ' verified' : '')}>
          {verified ? 'Identidade verificada' : 'Identidade não verificada'}
        </span>
      </div>
      {!verified && (
        <div className="notice identity-cta">
          <div>
            <b>Verifique sua identidade para vender.</b>
            <p style={{ margin: '2px 0 0' }}>Leva menos de 2 minutos: documento com foto + selfie.</p>
          </div>
          <Link className="btn primary" to="/conta/verificacao">
            Verificar identidade
          </Link>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase || !user || busy) return;
          setBusy(true);
          setMessage('');
          try {
            const { error } = await supabase
              .from('profiles')
              .update({
                display_name: displayName.trim(),
                full_name: fullName.trim() || null,
                city: city.trim() || null,
                state: uf || null,
              })
              .eq('id', user.id);
            if (error) throw error;
            setStatus('success');
            setMessage('Perfil atualizado.');
            await profile.refetch();
          } catch (err) {
            setStatus('error');
            setMessage(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nome de exibição
          <input
            required
            minLength={2}
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          Nome completo (privado)
          <input maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            UF
            <select
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                setCity('');
              }}
            >
              <option value="">Selecione</option>
              {BR_STATES.map((s) => (
                <option value={s.uf} key={s.uf}>
                  {s.name} ({s.uf})
                </option>
              ))}
            </select>
          </label>
          <label>
            Cidade
            <select value={city} disabled={!uf} onChange={(e) => setCity(e.target.value)}>
              <option value="">{uf ? 'Selecione' : 'Escolha a UF primeiro'}</option>
              {cityOptions.map((c) => (
                <option value={c} key={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar perfil'}
        </button>
        {message && (
          <p className={`auth-message ${status}`} role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
function AddressCard() {
  const { user } = useSession();
  const profile = useProfile();
  const [zip, setZip] = useState(''),
    [street, setStreet] = useState(''),
    [number, setNumber] = useState(''),
    [complement, setComplement] = useState(''),
    [neighborhood, setNeighborhood] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState<'error' | 'success' | ''>('');
  useEffect(() => {
    if (!profile.data) return;
    setZip(profile.data.address_zip ?? '');
    setStreet(profile.data.address_street ?? '');
    setNumber(profile.data.address_number ?? '');
    setComplement(profile.data.address_complement ?? '');
    setNeighborhood(profile.data.address_neighborhood ?? '');
  }, [profile.data]);
  if (!user) return null;
  if (profile.isPending)
    return (
      <div className="account-card">
        <p className="muted">Carregando endereço…</p>
      </div>
    );
  return (
    <div className="account-card">
      <h2>
        <MapPin size={17} style={{ verticalAlign: 'text-bottom' }} /> Endereço de entrega
      </h2>
      <p className="muted">
        Ainda não temos envio ativo nesta fase de validação. Salve seu endereço agora para agilizar quando o
        pagamento e o envio estiverem prontos.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase || !user || busy) return;
          setBusy(true);
          setMessage('');
          try {
            const { error } = await supabase
              .from('profiles')
              .update({
                address_zip: zip.trim() || null,
                address_street: street.trim() || null,
                address_number: number.trim() || null,
                address_complement: complement.trim() || null,
                address_neighborhood: neighborhood.trim() || null,
              })
              .eq('id', user.id);
            if (error) throw error;
            setStatus('success');
            setMessage('Endereço salvo.');
            await profile.refetch();
          } catch (err) {
            setStatus('error');
            setMessage(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            CEP
            <input
              maxLength={9}
              placeholder="00000-000"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </label>
          <label>
            Bairro
            <input maxLength={80} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          </label>
        </div>
        <label>
          Rua
          <input maxLength={120} value={street} onChange={(e) => setStreet(e.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Número
            <input maxLength={20} value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label>
            Complemento
            <input maxLength={60} value={complement} onChange={(e) => setComplement(e.target.value)} />
          </label>
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar endereço'}
        </button>
        {message && (
          <p className={`auth-message ${status}`} role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
export function AccountSettings() {
  const { user, loading } = useSession();
  useDocumentMeta({ title: 'Minha conta', noindex: true });
  const [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [busySignOut, setBusySignOut] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState<'error' | 'success' | ''>('');
  if (loading)
    return (
      <main className="page simple">
        <p>Carregando conta…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Minha conta</h1>
        <p>Entre na conta ou abra o link de recuperação enviado por e-mail.</p>
        <Link className="btn primary" to="/entrar">
          Entrar
        </Link>
      </main>
    );
  return (
    <main className="page">
      <div className="account-settings-shell">
        <BackButton />
        <ProfileCard />
        <AddressCard />
        <form
          className="account-card"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirmation) {
              setStatus('error');
              setMessage('As senhas não coincidem.');
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase!.auth.updateUser({ password });
              if (error) throw error;
              setPassword('');
              setConfirmation('');
              setStatus('success');
              setMessage('Senha alterada com sucesso.');
            } catch (err) {
              setStatus('error');
              setMessage(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Segurança</h2>
          <p className="muted">Defina uma nova senha para sua conta.</p>
          <label>
            Nova senha
            <input
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Repita a senha
            <input
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            <ShieldCheck size={17} />
            {busy ? 'Salvando…' : 'Salvar senha'}
          </button>
          {message && (
            <p className={`auth-message ${status}`} role="status">
              {message}
            </p>
          )}
        </form>
        <div className="account-card danger">
          <div>
            <h2>Sair da conta</h2>
            <p style={{ margin: 0 }}>Encerra sua sessão neste dispositivo.</p>
          </div>
          <button
            type="button"
            className="btn ghost-danger"
            disabled={busySignOut}
            onClick={async () => {
              setBusySignOut(true);
              const { error } = await supabase!.auth.signOut();
              if (error) {
                setStatus('error');
                setMessage(errorMessage(error));
              }
              setBusySignOut(false);
            }}
          >
            <LogOut size={17} />
            {busySignOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </div>
    </main>
  );
}
