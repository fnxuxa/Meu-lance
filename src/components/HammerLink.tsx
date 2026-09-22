import { MouseEvent, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function HammerLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const [striking, setStriking] = useState(false);
  const nav = useNavigate();
  function onClick(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (striking) return;
    setStriking(true);
    window.setTimeout(() => nav(to), 420);
  }
  return (
    <Link
      to={to}
      className={'hammer-strike' + (striking ? ' striking' : '') + (className ? ' ' + className : '')}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
