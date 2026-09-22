import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export function BackButton({ fallback = '/', label = 'Voltar' }: { fallback?: string; label?: string }) {
  const nav = useNavigate();
  return (
    <button
      type="button"
      className="back-btn"
      onClick={() => {
        if (window.history.length > 1) nav(-1);
        else nav(fallback);
      }}
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
