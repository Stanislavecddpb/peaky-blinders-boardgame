import { cardName } from '@bb/engine';
import { cardImg } from './assets';

export interface HandSelect {
  /** Можно ли выбрать карту. */
  can: (card: string) => boolean;
  selected: string[];
  onCard: (card: string) => void;
}

/** Рука внизу экрана. В режиме выбора подсвечиваются подходящие карты. */
export function Hand({ cards, select, hidden }: { cards: string[]; select?: HandSelect; hidden?: boolean }) {
  if (hidden) return <div className="hand hand-hidden">Карты скрыты</div>;
  return (
    <div className="hand">
      {cards.length === 0 && <div className="hand-empty">Карт нет</div>}
      {cards.map((c) => {
        const can = !!select?.can(c);
        const sel = !!select?.selected.includes(c);
        return (
          <button key={c} className={`hand-card ${select ? (can ? 'can' : 'dim') : ''} ${sel ? 'sel' : ''}`}
            disabled={!select || !can} onClick={() => select?.onCard(c)} title={cardName(c)}>
            <img src={cardImg(c)} alt={cardName(c)} />
          </button>
        );
      })}
    </div>
  );
}
