import { Gavel } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="MeuLance — página inicial">
      <span className="logo-mark">
        <Gavel size={20} />
      </span>
      <span>
        Meu<span>Lance</span>
      </span>
    </Link>
  );
}
