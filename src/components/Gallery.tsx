import { KeyboardEvent, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Galeria do anúncio: miniaturas, setas, teclado (←/→) e gesto de arrastar no celular. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = images.length;
  const go = (i: number) => setActive(((i % count) + count) % count);
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') go(active + 1);
    else if (e.key === 'ArrowLeft') go(active - 1);
    else return;
    e.preventDefault();
  }
  return (
    <div className="gallery">
      <div
        className="gallery-stage"
        tabIndex={count > 1 ? 0 : -1}
        role="region"
        aria-roledescription="galeria"
        aria-label={`Fotos de ${title}`}
        onKeyDown={onKey}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
        }}
      >
        <img
          key={active}
          className="gallery-main"
          src={images[active]}
          alt={`${title} — foto ${active + 1}`}
          width={1000}
          height={750}
          fetchPriority={active === 0 ? 'high' : 'auto'}
        />
        {count > 1 && (
          <>
            <button
              type="button"
              className="gallery-nav prev"
              aria-label="Foto anterior"
              onClick={() => go(active - 1)}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="gallery-nav next"
              aria-label="Próxima foto"
              onClick={() => go(active + 1)}
            >
              <ChevronRight />
            </button>
            <span className="gallery-counter" aria-live="polite">
              {active + 1}/{count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="gallery-thumbs">
          {images.map((img, i) => (
            <button
              type="button"
              className={i === active ? 'active' : ''}
              key={img}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
            >
              <img src={img} alt="" loading="lazy" decoding="async" width={120} height={120} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
