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
      <g className="nf-shard nf-shard-top">
        <path d="M44 16 L176 16 L108 52 Z" />
      </g>
      <g className="nf-shard nf-shard-right">
        <path d="M176 16 L176 174 L108 52 Z" />
      </g>
      <g className="nf-shard nf-shard-bottom">
        <path d="M176 174 L44 174 L108 52 Z" />
      </g>
      <g className="nf-shard nf-shard-left">
        <path d="M44 174 L44 16 L108 52 Z" />
      </g>
      <g transform="translate(108,40)">
        <g className="nf-chip nf-chip-1">
          <path d="M0 0 L13 -5 L6 11 Z" />
        </g>
      </g>
      <g transform="translate(132,58)">
        <g className="nf-chip nf-chip-2">
          <path d="M0 0 L11 5 L-2 12 Z" />
        </g>
      </g>
      <g transform="translate(90,62)">
        <g className="nf-chip nf-chip-3">
          <path d="M0 0 L-11 4 L-3 13 Z" />
        </g>
      </g>
      <g className="nf-spark" transform="translate(108,52)">
        <path d="M0 -18 L0 -8 M-13 -9 L-6 -4 M13 -9 L6 -4 M-16 3 L-7 2 M16 3 L7 2" />
      </g>
      <g transform="translate(54,30)">
        <g className="nf-hammer">
          <Hammer size={60} strokeWidth={1.75} />
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
