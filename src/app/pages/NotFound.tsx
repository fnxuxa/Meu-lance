import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { useDocumentMeta } from '../../lib/useDocumentMeta';

function BrokenTile() {
  return (
    <svg
      className="not-found-art"
      viewBox="0 0 220 190"
      width="220"
      height="190"
      aria-hidden
      focusable="false"
    >
      <g className="nf-tile nf-tile-left">
        <path d="M20 30 Q20 18 32 18 L108 18 L96 172 L32 172 Q20 172 20 160 Z" />
      </g>
      <g className="nf-tile nf-tile-right">
        <path d="M124 18 L188 18 Q200 18 200 30 L200 160 Q200 172 188 172 L112 172 Z" />
      </g>
      <g className="nf-crack">
        <path d="M108 18 L118 46 L100 70 L122 96 L104 122 L120 146 L96 172" />
      </g>
      <g transform="translate(114,52)">
        <g className="nf-chip nf-chip-1">
          <path d="M0 0 L14 4 L4 16 Z" />
        </g>
      </g>
      <g transform="translate(100,48)">
        <g className="nf-chip nf-chip-2">
          <path d="M0 0 L10 -3 L8 10 Z" />
        </g>
      </g>
      <g transform="translate(96,60)">
        <g className="nf-chip nf-chip-3">
          <path d="M0 0 L-12 2 L-4 12 Z" />
        </g>
      </g>
      <g className="nf-spark">
        <path d="M108 55 L108 40 M96 62 L84 54 M108 55 L122 48 M108 55 L96 44" />
      </g>
      <g transform="translate(150,-8)">
        <g className="nf-hammer">
          <Hammer size={62} strokeWidth={1.75} />
        </g>
      </g>
    </svg>
  );
}

export default function NotFound() {
  useDocumentMeta({ title: 'Página não encontrada', noindex: true });
  return (
    <main className="page simple not-found">
      <BrokenTile />
      <span className="kicker">ERRO 404</span>
      <h1>Página não encontrada</h1>
      <p>O endereço pode estar incorreto ou o anúncio não está mais disponível.</p>
      <div className="hero-actions">
        <Link className="btn primary" to="/buscar">
          Ver leilões ativos
        </Link>
        <Link className="btn secondary" to="/">
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
