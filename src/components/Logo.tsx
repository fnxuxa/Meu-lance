import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="MeuLance — página inicial">
      <img src="/logo.png" alt="MeuLance — leilão na palma da mão" />
    </Link>
  );
}
