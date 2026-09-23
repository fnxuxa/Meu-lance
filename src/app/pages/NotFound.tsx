import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useDocumentMeta } from '../../lib/useDocumentMeta';

export default function NotFound() {
  useDocumentMeta({ title: 'Página não encontrada', noindex: true });
  return (
    <main className="page simple not-found">
      <SearchX className="not-found-icon" aria-hidden />
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
