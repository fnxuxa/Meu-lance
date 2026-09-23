import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/** Compartilhar anúncio: menu nativo no celular, cópia do link no desktop. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — dê seu lance no MeuLance`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // usuário cancelou o menu de compartilhamento ou o navegador negou a área de transferência
    }
  }
  return (
    <button type="button" className="btn secondary share-btn" onClick={() => void share()}>
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      <span role="status">{copied ? 'Link copiado' : 'Compartilhar'}</span>
    </button>
  );
}
