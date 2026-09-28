import { useState } from 'react';
import { ImageDown } from 'lucide-react';
import { formatBRL } from '../lib/money';

const WIDTH = 1080;
const HEIGHT = 1350;
const PHOTO_HEIGHT = 850;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale,
    sh = h / scale;
  const sx = (img.width - sw) / 2,
    sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) cut = cut.slice(0, -1);
  return cut + '…';
}

async function buildCard(opts: { title: string; imageUrl: string; priceCents: number; url: string }) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNSUPPORTED');
  ctx.fillStyle = '#063d2a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  try {
    const img = await loadImage(opts.imageUrl);
    drawCover(ctx, img, 0, 0, WIDTH, PHOTO_HEIGHT);
  } catch {
    // sem foto (falhou o carregamento, ex.: CORS): mantém o fundo verde sólido
  }
  const gradient = ctx.createLinearGradient(0, PHOTO_HEIGHT - 220, 0, PHOTO_HEIGHT);
  gradient.addColorStop(0, 'rgba(6,61,42,0)');
  gradient.addColorStop(1, 'rgba(6,61,42,0.9)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, PHOTO_HEIGHT - 220, WIDTH, 220);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(48, 48, 260, 76, 38);
  ctx.fill();
  ctx.fillStyle = '#063d2a';
  ctx.font = '700 34px Manrope, "DM Sans", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('MeuLance', 78, 88);
  ctx.fillStyle = '#063d2a';
  ctx.fillRect(0, PHOTO_HEIGHT, WIDTH, HEIGHT - PHOTO_HEIGHT);
  ctx.fillStyle = 'white';
  ctx.font = '800 56px Manrope, "DM Sans", system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(truncate(ctx, opts.title, WIDTH - 96), 48, PHOTO_HEIGHT + 100);
  ctx.fillStyle = '#8ff0c0';
  ctx.font = '800 72px Manrope, "DM Sans", system-ui, sans-serif';
  ctx.fillText(formatBRL(opts.priceCents), 48, PHOTO_HEIGHT + 190);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 32px Manrope, "DM Sans", system-ui, sans-serif';
  ctx.fillText('Confira e dê seu lance no MeuLance', 48, PHOTO_HEIGHT + 250);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 28px Manrope, "DM Sans", system-ui, sans-serif';
  ctx.fillText(opts.url.replace(/^https?:\/\//, ''), 48, PHOTO_HEIGHT + 300);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('CANVAS_EXPORT_FAILED'))), 'image/png'),
  );
}

/** Gera um card (foto + título + preço) pronto pra compartilhar no WhatsApp/Status. */
export function ShareImageButton({
  title,
  imageUrl,
  priceCents,
  url,
}: {
  title: string;
  imageUrl: string;
  priceCents: number;
  url: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const blob = await buildCard({ title, imageUrl, priceCents, url });
      const file = new File([blob], 'meulance-anuncio.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title} — confira no MeuLance` });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'meulance-anuncio.png';
        link.click();
        URL.revokeObjectURL(link.href);
        setMessage('Imagem baixada — já pode compartilhar no WhatsApp ou nos stories.');
      }
    } catch (e) {
      console.error('[ShareImageButton]', e);
      setMessage('Não deu para gerar a imagem agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" className="btn secondary" disabled={busy} onClick={() => void run()}>
        <ImageDown size={16} />
        {busy ? 'Gerando…' : 'Imagem para compartilhar'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
