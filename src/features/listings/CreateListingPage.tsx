import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { compressListingImage } from '../../lib/images';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { parseBRLToCents } from '../../lib/money';
import { BR_STATES, citiesForUf } from '../../lib/brazil';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { useProfile } from '../auth/useProfile';
import { BackButton } from '../../components/BackButton';
type Photo = { file: File; url: string };
type Cat = { id: string; name: string };
export function CreateListingPage() {
  const { user, loading } = useSession();
  const profile = useProfile();
  useDocumentMeta({ title: 'Anunciar um leilão', noindex: true });
  const nav = useNavigate();
  const savedForm = useRef<FormData | null>(null);
  const draftId = useRef<string | null>(null);
  const uploadedCount = useRef(0);
  const photoUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      photoUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  const [photos, setPhotos] = useState<Photo[]>([]),
    [cats, setCats] = useState<Cat[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [uf, setUf] = useState(''),
    [city, setCity] = useState(''),
    [cityOptions, setCityOptions] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setCityOptions([]);
    if (!uf) return;
    void citiesForUf(uf).then((list) => {
      if (active) setCityOptions(list);
    });
    return () => {
      active = false;
    };
  }, [uf]);
  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from('categories')
      .select('id,name')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) setMessage(errorMessage(error));
        else setCats((data ?? []) as Cat[]);
      });
  }, []);
  async function add(files: FileList | null) {
    if (!files || busy || draftId.current) return;
    setBusy(true);
    try {
      const made: Photo[] = [];
      for (const f of [...files].slice(0, 10 - photos.length)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024)
          throw new Error('Use JPG, PNG ou WebP de até 10 MB.');
        const c = await compressListingImage(f);
        const url = URL.createObjectURL(c);
        photoUrls.current.push(url);
        made.push({ file: c, url });
      }
      setPhotos((v) => [...v, ...made]);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !user) {
      setMessage('Entre na sua conta e configure o Supabase para publicar.');
      return;
    }
    if (photos.length < 3) {
      setMessage('Adicione pelo menos 3 fotos.');
      return;
    }
    const fd = draftId.current && savedForm.current ? savedForm.current : new FormData(e.currentTarget);
    savedForm.current = fd;
    const accepted = new FormData(e.currentTarget).get('declaration') === 'on';
    if (busy) return;
    setBusy(true);
    setMessage('Criando rascunho…');
    try {
      const cents = parseBRLToCents(String(fd.get('price') ?? ''));
      const { data: id, error } = draftId.current
        ? { data: draftId.current, error: null }
        : await supabase.rpc('create_listing_draft', {
            p_title: String(fd.get('title')),
            p_description: String(fd.get('description')),
            p_condition: String(fd.get('condition')),
            p_defects: String(fd.get('defects') ?? ''),
            p_start_price_cents: cents,
            p_delivery_mode: String(fd.get('delivery')),
            p_city: String(fd.get('city')),
            p_state: String(fd.get('state')),
            p_category: String(fd.get('category')) || null,
          });
      if (error || !id) throw error ?? new Error('Falha ao criar anúncio');
      draftId.current = id;
      for (let i = uploadedCount.current; i < photos.length; i++) {
        setMessage(`Enviando foto ${i + 1} de ${photos.length}…`);
        const path = `${user.id}/${id}/${photos[i].file.name}`;
        const { error: up } = await supabase.storage
          .from('listing-images')
          .upload(path, photos[i].file, { contentType: 'image/webp', upsert: true });
        if (up) throw up;
        const { error: row } = await supabase
          .from('listing_images')
          .insert({ listing_id: id, storage_path: path, sort_order: i });
        if (row && row.code !== '23505') throw row;
        uploadedCount.current = i + 1;
      }
      setMessage('Publicando leilão…');
      const duration = Number(fd.get('duration') ?? 7);
      const { data: published, error: pub } = await supabase.rpc('publish_listing', {
        p_listing: id,
        p_duration_days: duration,
        p_declaration_accepted: accepted,
      });
      if (pub) throw pub;
      nav(published?.slug ? `/l/${published.slug}` : '/conta/vendas');
    } catch (err) {
      setMessage(
        errorMessage(err) + (draftId.current ? ' O rascunho foi preservado. Tente publicar novamente.' : ''),
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading || (user && profile.isPending))
    return (
      <main className="page simple">
        <p>Carregando conta…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Entre para vender</h1>
        <p>Você precisa de uma conta para criar um leilão.</p>
        <button className="btn primary" onClick={() => nav('/entrar')}>
          Entrar
        </button>
      </main>
    );
  if (!profile.data?.identity_verified_at)
    return (
      <main className="page simple">
        <BackButton />
        <h1>Verifique sua identidade para vender</h1>
        <p>
          Para evitar fraude e venda de itens roubados, pedimos documento com foto e uma selfie antes de
          liberar a publicação de leilões.
        </p>
        <Link className="btn primary" to="/conta/verificacao">
          Verificar identidade
        </Link>
      </main>
    );
  return (
    <main className="page sell-page">
      <BackButton />
      <div className="form-intro">
        <span className="kicker">NOVO LEILÃO</span>
        <h1>O que você quer vender?</h1>
        <p>Mostre o estado real do item. Fotos e descrição transparentes reduzem disputas.</p>
      </div>
      <form className="sell-form" onSubmit={submit}>
        <fieldset disabled={busy || !!draftId.current}>
          <section>
            <h2>Fotos do produto</h2>
            <p>3 a 10 fotos. A primeira será a capa.</p>
            <label className="upload">
              <UploadCloud />
              <b>{busy ? 'Processando…' : 'Adicionar fotos'}</b>
              <span>JPG, PNG ou WebP</span>
              <input
                hidden
                type="file"
                disabled={busy || !!draftId.current}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => void add(e.target.files)}
              />
            </label>
            <div className="photo-preview">
              {photos.map((p, i) => (
                <div key={p.url}>
                  <img src={p.url} alt={`Prévia ${i + 1}`} />
                  {i === 0 && <b>Capa</b>}
                  <button
                    disabled={busy || !!draftId.current}
                    type="button"
                    onClick={() => setPhotos((v) => v.filter((x) => x.url !== p.url))}
                  >
                    <X size={14} /> Remover
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2>Sobre o item</h2>
            <label>
              Título
              <input name="title" required minLength={8} maxLength={120} />
            </label>
            <div className="form-grid">
              <label>
                Categoria
                <select name="category" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {cats.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select name="condition" required>
                  <option value="like_new">Como novo</option>
                  <option value="good">Bom</option>
                  <option value="fair">Regular</option>
                  <option value="for_parts">Para peças</option>
                </select>
              </label>
            </div>
            <label>
              Descrição
              <textarea name="description" required minLength={20} rows={5} />
            </label>
            <label>
              Defeitos ou marcas de uso
              <textarea name="defects" rows={3} />
            </label>
          </section>
          <section>
            <h2>Configure o leilão</h2>
            <div className="form-grid">
              <label>
                Valor inicial (R$)
                <input name="price" required inputMode="decimal" placeholder="50,00" />
              </label>
              <label>
                Duração
                <select name="duration">
                  <option value="7">7 dias</option>
                  <option value="3">3 dias</option>
                  <option value="5">5 dias</option>
                  <option value="10">10 dias</option>
                </select>
              </label>
              <label>
                UF
                <select
                  name="state"
                  required
                  value={uf}
                  onChange={(e) => {
                    setUf(e.target.value);
                    setCity('');
                  }}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {BR_STATES.map((s) => (
                    <option value={s.uf} key={s.uf}>
                      {s.name} ({s.uf})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cidade
                <select
                  name="city"
                  required
                  disabled={!uf}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="" disabled>
                    {uf ? 'Selecione' : 'Escolha a UF primeiro'}
                  </option>
                  {cityOptions.map((c) => (
                    <option value={c} key={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Entrega
                <select name="delivery">
                  <option value="both">Envio e retirada</option>
                  <option value="shipping">Somente envio</option>
                  <option value="pickup">Somente retirada</option>
                </select>
              </label>
            </div>
            <div className="notice">
              <ShieldCheck />
              Ao publicar, você declara que o item é seu e as informações são verdadeiras.
            </div>
            <div className="notice">
              <ShieldCheck />
              Você pode cancelar livremente enquanto ninguém der lance. Depois do primeiro lance, só dá
              para cancelar se faltar mais de 1 dia para o fim — perto do encerramento o compromisso do
              comprador é respeitado e o anúncio não pode mais ser removido.
            </div>
          </section>
        </fieldset>
        <section>
          <label className="setting-row">
            <input type="checkbox" name="declaration" required />
            <span>Declaro que o item é meu e que as fotos e informações são verdadeiras.</span>
          </label>
          <label className="setting-row">
            <input type="checkbox" name="terms" required />
            <span>
              Li e aceito os <Link to="/termos">Termos de Uso</Link> do MeuLance.
            </span>
          </label>
          <button className="btn primary wide" disabled={busy || photos.length < 3}>
            Publicar leilão <ArrowRight />
          </button>
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
        </section>
      </form>
    </main>
  );
}
