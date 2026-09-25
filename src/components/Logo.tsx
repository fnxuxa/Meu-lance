import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="MeuLance — página inicial">
      <img
        src="/logo.webp"
        alt="MeuLance — oportunidades na palma da mão"
        width={420}
        height={140}
        decoding="async"
      />
    </Link>
  );
}
