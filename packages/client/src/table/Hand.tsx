import { useEffect, useState } from 'react';
import { cardName } from '@bb/engine';
import { cardImg } from './assets';

export interface HandSelect {
  /** Можно ли выбрать карту. */
  can: (card: string) => boolean;
  selected: string[];
  onCard: (card: string) => void;
}

interface Preview { id: string; left: number; bottom: number; height: number }

/** Рука внизу экрана. В режиме выбора подсвечиваются подходящие карты; наведённая карта видна крупно. */
export function Hand({ cards, select, hidden }: { cards: string[]; select?: HandSelect; hidden?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => setPreview(null), [cards.join()]);
  // mouseleave теряется при резком уходе указателя — закрываем по любому движению вне карты.
  useEffect(() => {
    if (!preview) return;
    const off = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest('.hand-card')) setPreview(null);
    };
    window.addEventListener('pointermove', off);
    window.addEventListener('pointerdown', off);
    return () => {
      window.removeEventListener('pointermove', off);
      window.removeEventListener('pointerdown', off);
    };
  }, [preview]);
  if (hidden) return <div className="hand hand-hidden">Карты скрыты</div>;
  return (
    <div className="hand">
      {cards.length === 0 && <div className="hand-empty">Карт нет</div>}
      {cards.map((c) => {
        const can = !!select?.can(c);
        const sel = !!select?.selected.includes(c);
        return (
          <button key={c} className={`hand-card ${select ? (can ? 'can' : 'dim') : ''} ${sel ? 'sel' : ''}`}
            aria-disabled={!select || !can} onClick={() => { if (select && can) select.onCard(c); }}
            onMouseEnter={(e) => {
              // Крупно над рукой, по центру наведённой карты, не выходя за края экрана.
              const r = e.currentTarget.getBoundingClientRect();
              const top = e.currentTarget.parentElement!.getBoundingClientRect().top;
              const height = Math.min(window.innerHeight * 0.6, top - 24, 618);
              const width = height * 0.712;
              const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
              setPreview({ id: c, left, bottom: window.innerHeight - top + 14, height });
            }}
            onMouseLeave={() => setPreview(null)}>
            <img src={cardImg(c)} alt={cardName(c)} />
            <span className="hand-card-name">{cardName(c)}</span>
          </button>
        );
      })}
      {preview && (
        <img className="card-preview" src={cardImg(preview.id)} alt=""
          style={{ left: preview.left, bottom: preview.bottom, height: preview.height }} />
      )}
    </div>
  );
}
