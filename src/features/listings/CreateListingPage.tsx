import { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Camera, ShieldCheck, UploadCloud, X } from 'lucide-react';
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
import { useAppConfig } from '../../lib/useAppConfig';
import {
  ANSWERS,
  CONDITIONS,
  checklistFor,
  conditionHint,
  defectRequirements,
  isChecklistComplete,
  type Checklist,
  type ChecklistAnswer,
} from '../../lib/condition';
import { PriceSuggestion } from './PriceSuggestion';
import { isValidImei, normalizeImei } from '../../lib/imei';
type Photo = { file: File; url: string; defect: boolean };
type Cat = { id: string; name: string; slug?: string };
type Draft = {
  title?: string;
  category?: string;
  condition?: string;
  description?: string;
  defects?: string;
  price?: string;
  duration?: string;
  state?: string;
  city?: string;
  delivery?: string;
  secondChance?: string;
  checklist?: Partial<Checklist>;
};
const DRAFT_KEY = 'meulance:draft:create-listing';
const DRAFT_FIELDS: Exclude<keyof Draft, 'checklist'>[] = [
  'title',
  'category',
  'condition',
  'description',
  'defects',
  'price',
  'duration',
  'state',
  'city',
  'delivery',
  'secondChance',
];
const MAX_PHOTOS = 10;
function loadDraft(): Draft {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function CreateListingPage() {
  const { user, loading } = useSession();
  const profile = useProfile();
  const { checklists, imeiCategories } = useAppConfig();
  useDocumentMeta({ title: 'Anunciar um leilão', noindex: true });
  const nav = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const savedForm = useRef<FormData | null>(null);
  const draftId = useRef<string | null>(null);
  const uploadedCount = useRef(0);
  const photoUrls = useRef<string[]>([]);
  const initialDraft = useRef<Draft>(loadDraft());
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
    [category, setCategory] = useState(initialDraft.current.category ?? ''),
    [condition, setCondition] = useState(initialDraft.current.condition ?? 'like_new'),
    [answers, setAnswers] = useState<Partial<Checklist>>(initialDraft.current.checklist ?? {}),
    [defects, setDefects] = useState(initialDraft.current.defects ?? ''),
    [title, setTitle] = useState(initialDraft.current.title ?? ''),
    [imei, setImei] = useState(''),
    [secondChance, setSecondChance] = useState(initialDraft.current.secondChance === 'on'),
    [uf, setUf] = useState(initialDraft.current.state ?? ''),
    [city, setCity] = useState(initialDraft.current.city ?? ''),
    [cityOptions, setCityOptions] = useState<string[]>([]),
    [draftRestored] = useState(() => DRAFT_FIELDS.some((k) => initialDraft.current[k]));
  const categorySlug = cats.find((c) => c.id === category)?.slug;
  const checklistItems = category ? checklistFor(checklists, categorySlug) : [];
  const needsImei = !!categorySlug && imeiCategories.includes(categorySlug);
  const { needsDescription, needsDefectPhoto } = defectRequirements(condition, answers, defects);
  const regularPhotos = photos.filter((p) => !p.defect);
  const defectPhotos = photos.filter((p) => p.defect);
  function saveDraft() {
    if (!formRef.current || draftId.current) return;
    const fd = new FormData(formRef.current);
    const snapshot: Draft = {};
    for (const key of DRAFT_FIELDS) {
      const v = fd.get(key);
      if (v) snapshot[key] = String(v);
    }
    const checklist: Partial<Checklist> = {};
    for (const [k, v] of fd.entries())
      if (k.startsWith('chk_')) checklist[k.slice(4)] = String(v) as ChecklistAnswer;
    if (Object.keys(checklist).length) snapshot.checklist = checklist;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
  }
  const saveDraftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function scheduleDraftSave() {
    clearTimeout(saveDraftTimer.current);
    saveDraftTimer.current = setTimeout(saveDraft, 600);
  }
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
      .select('id,name,slug')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) setMessage(errorMessage(error));
        else setCats((data ?? []) as Cat[]);
      });
  }, []);
  async function add(files: FileList | null, defect: boolean) {
    if (!files || busy || draftId.current) return;
    setBusy(true);
    try {
      const made: Photo[] = [];
      for (const f of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024)
          throw new Error('Use JPG, PNG ou WebP de até 10 MB.');
        const c = await compressListingImage(f);
        const url = URL.createObjectURL(c);
        photoUrls.current.push(url);
        made.push({ file: c, url, defect });
      }
      setPhotos((v) => [...v, ...made]);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function validateCondition(): string | null {
    if (!isChecklistComplete(checklistItems, answers))
      return 'Responda todas as perguntas do checklist de funcionamento.';
    if (needsDescription && !defects.trim())
      return condition === 'for_parts'
        ? 'Descreva o que não funciona ou está faltando no item.'
        : 'Você marcou algum item com "Não": descreva o defeito.';
    if (needsDefectPhoto && !defectPhotos.length) return 'Adicione pelo menos 1 foto do defeito.';
    if (needsImei && !isValidImei(imei))
      return 'Informe um IMEI válido (15 dígitos). Disque *#06# no celular para ver o número.';
    return null;
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
    const conditionError = validateCondition();
    if (conditionError) {
      setMessage(conditionError);
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
      // só envia as perguntas da categoria atual; o servidor recusa chaves a mais
      const checklist = Object.fromEntries(checklistItems.map((i) => [i.key, answers[i.key]]));
      const { error: report } = await supabase.rpc('set_listing_condition_report', {
        p_listing: id,
        p_checklist: checklist,
      });
      if (report) throw report;
      if (needsImei) {
        const { error: imeiError } = await supabase.rpc('set_listing_imei', {
          p_listing: id,
          p_imei: normalizeImei(imei),
        });
        if (imeiError) throw imeiError;
      }
      const { error: optionError } = await supabase
        .from('listings')
        .update({ second_chance_enabled: secondChance })
        .eq('id', id);
      if (optionError) throw optionError;
      // fotos normais primeiro (a primeira é a capa), fotos de defeito no fim
      const ordered = [...regularPhotos, ...defectPhotos];
      for (let i = uploadedCount.current; i < ordered.length; i++) {
        setMessage(`Enviando foto ${i + 1} de ${ordered.length}…`);
        const path = `${user.id}/${id}/${ordered[i].file.name}`;
        const { error: up } = await supabase.storage
          .from('listing-images')
          .upload(path, ordered[i].file, { contentType: 'image/webp', upsert: true });
        if (up) throw up;
        const { error: row } = await supabase
          .from('listing_images')
          .insert({ listing_id: id, storage_path: path, sort_order: i, is_defect: ordered[i].defect });
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
      localStorage.removeItem(DRAFT_KEY);
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
  const locked = busy || !!draftId.current;
  const photoGrid = (list: Photo[], label: string) =>
    list.length > 0 && (
      <div className="photo-preview">
        {list.map((p, i) => (
          <div key={p.url}>
            <img src={p.url} alt={`${label} ${i + 1}`} />
            {!p.defect && i === 0 && <b>Capa</b>}
            {p.defect && <b className="defect-tag">Defeito</b>}
            <button
              disabled={locked}
              type="button"
              onClick={() => setPhotos((v) => v.filter((x) => x.url !== p.url))}
            >
              <X size={14} /> Remover
            </button>
          </div>
        ))}
      </div>
    );
  return (
    <main className="page sell-page">
      <BackButton />
      <div className="form-intro">
        <span className="kicker">NOVO LEILÃO</span>
        <h1>O que você quer vender?</h1>
        <p>Mostre o estado real do item. Fotos e descrição transparentes reduzem disputas.</p>
      </div>
      {draftRestored && (
        <div className="notice">
          <ShieldCheck />
          Continuando de um rascunho salvo automaticamente neste navegador.
        </div>
      )}
      <form className="sell-form" onSubmit={submit} onChange={scheduleDraftSave} ref={formRef}>
        <fieldset disabled={locked}>
          <section>
            <h2>Fotos do produto</h2>
            <p>3 a 10 fotos no total. A primeira será a capa.</p>
            <label className="upload">
              <UploadCloud />
              <b>{busy ? 'Processando…' : 'Adicionar fotos'}</b>
              <span>JPG, PNG ou WebP</span>
              <input
                hidden
                type="file"
                data-kind="regular"
                disabled={locked || photos.length >= MAX_PHOTOS}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => void add(e.target.files, false)}
              />
            </label>
            {photoGrid(regularPhotos, 'Prévia')}
          </section>
          <section>
            <h2>Sobre o item</h2>
            <label>
              Título
              <input
                name="title"
                required
                minLength={8}
                maxLength={120}
                defaultValue={initialDraft.current.title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Categoria
                <select
                  name="category"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
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
                <select
                  name="condition"
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  aria-describedby="condition-hint"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <small id="condition-hint" className="muted">
                  {conditionHint(condition)}
                </small>
              </label>
            </div>
            {condition === 'for_parts' && (
              <div className="as-is-banner" role="note">
                <AlertTriangle aria-hidden />
                <div>
                  <b>Venda no estado.</b>
                  <span>
                    O comprador aceita que o item pode não funcionar e não pode reclamar de dano ou mau
                    funcionamento, só de item diferente do anunciado ou não enviado.{' '}
                    <Link to="/termos#no-estado" target="_blank" rel="noopener">
                      Termos, §10
                    </Link>
                  </span>
                </div>
              </div>
            )}
            <label>
              Descrição
              <textarea
                name="description"
                required
                minLength={20}
                rows={5}
                defaultValue={initialDraft.current.description}
              />
            </label>
          </section>
          <section>
            <h2>Checklist de funcionamento</h2>
            {!category ? (
              <p className="muted">Escolha a categoria para ver as perguntas.</p>
            ) : !checklistItems.length ? (
              <p className="muted">Carregando perguntas…</p>
            ) : (
              <>
                <p className="muted">
                  Responda com sinceridade: a disputa compara o que você declarou aqui com o que o comprador
                  recebe. Use "Não testei" quando não souber.
                </p>
                <div className="checklist-form">
                  {checklistItems.map((item) => (
                    <fieldset key={item.key} className="checklist-row">
                      <legend>{item.label}</legend>
                      <div role="radiogroup" aria-label={item.label}>
                        {ANSWERS.map((a) => (
                          <label
                            key={a.value}
                            className={'chip' + (answers[item.key] === a.value ? ' active' : '')}
                          >
                            <input
                              type="radio"
                              name={'chk_' + item.key}
                              value={a.value}
                              checked={answers[item.key] === a.value}
                              onChange={() => setAnswers((v) => ({ ...v, [item.key]: a.value }))}
                            />
                            {a.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </>
            )}
            <label>
              Defeitos ou marcas de uso{needsDescription ? ' (obrigatório)' : ''}
              <textarea
                name="defects"
                rows={3}
                required={needsDescription}
                value={defects}
                onChange={(e) => setDefects(e.target.value)}
              />
            </label>
            {needsImei && (
              <label>
                IMEI do aparelho
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={20}
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  aria-invalid={imei !== '' && !isValidImei(imei)}
                  aria-describedby="imei-hint"
                />
                <small id="imei-hint" className="muted">
                  Disque *#06# para ver. O número não aparece no anúncio: só o comprador vê, depois de pagar,
                  para consultar na Anatel. Apagamos 20 dias após a conclusão do pedido.
                </small>
                {imei !== '' && !isValidImei(imei) && (
                  <small className="field-error">IMEI inválido: confira os 15 dígitos.</small>
                )}
              </label>
            )}
            <h3>Fotos dos defeitos{needsDefectPhoto ? ' (obrigatório)' : ''}</h3>
            <p className="muted">
              Mostre de perto cada defeito ou marca informada. Elas aparecem separadas no anúncio.
            </p>
            <label className="upload compact">
              <Camera />
              <b>Adicionar foto do defeito</b>
              <input
                hidden
                type="file"
                data-kind="defect"
                disabled={locked || photos.length >= MAX_PHOTOS}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => void add(e.target.files, true)}
              />
            </label>
            {photoGrid(defectPhotos, 'Foto do defeito')}
          </section>
          <section>
            <h2>Configure o leilão</h2>
            <div className="form-grid">
              <label>
                Valor inicial (R$)
                <input
                  ref={priceRef}
                  name="price"
                  required
                  inputMode="decimal"
                  placeholder="50,00"
                  defaultValue={initialDraft.current.price}
                />
              </label>
              <label>
                Duração
                <select name="duration" defaultValue={initialDraft.current.duration ?? '7'}>
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
                <select name="delivery" defaultValue={initialDraft.current.delivery ?? 'both'}>
                  <option value="both">Envio e retirada</option>
                  <option value="shipping">Somente envio</option>
                  <option value="pickup">Somente retirada</option>
                </select>
              </label>
            </div>
            <PriceSuggestion
              categoryId={category}
              title={title}
              onUse={(text) => {
                if (priceRef.current) priceRef.current.value = text;
                scheduleDraftSave();
              }}
            />
            <label className="setting-row option-card">
              <input
                type="checkbox"
                name="secondChance"
                checked={secondChance}
                onChange={(e) => setSecondChance(e.target.checked)}
              />
              <span>
                <b>Oferecer ao 2º colocado se o vencedor não pagar</b>
                <small className="muted">
                  O 2º maior lance recebe a oferta pelo valor do próprio lance e tem 24h para aceitar. Se não
                  marcar, o pedido é cancelado e você pode anunciar de novo.
                </small>
              </span>
            </label>
            <div className="notice">
              <ShieldCheck />
              Ao publicar, você declara que o item é seu e as informações são verdadeiras.
            </div>
            <div className="notice">
              <ShieldCheck />
              Você pode cancelar livremente enquanto ninguém der lance. Depois do primeiro lance, só dá para
              cancelar se faltar mais de 1 dia para o fim — perto do encerramento o compromisso do comprador é
              respeitado e o anúncio não pode mais ser removido.
            </div>
          </section>
        </fieldset>
        <section>
          <label className="setting-row">
            <input type="checkbox" name="declaration" required />
            <span>
              Declaro que o item é meu e que as fotos, o checklist e as informações são verdadeiras.
            </span>
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
