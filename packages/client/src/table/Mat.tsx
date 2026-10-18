import { INDUSTRIES, INDUSTRY_RU, ROMAN, STACKS, nameOf, type BBState, type Industry, type TileDef } from '@bb/engine';
import { tileImg } from './assets';

function TileStats({ t }: { t: TileDef }) {
  const cost = [`£${t.money}`];
  if (t.coal) cost.push(`уголь ×${t.coal}`);
  if (t.iron) cost.push(`железо ×${t.iron}`);
  return (
    <div className="tile-stats">
      <div title="Стоимость постройки">{cost.join(' + ')}</div>
      {t.beer > 0 && <div title="Пива для продажи">пиво ×{t.beer}</div>}
      {t.res > 0 && <div title="Кубов при постройке">кубов: {t.res}</div>}
      {t.industry === 'brewery' && <div>бочек: 1 / 2 (ж/д)</div>}
      <div title="ПО за перевёрнутую плитку · сдвиг дохода · значки связи">★{t.vp} · доход +{t.income} · ⛓{t.linkVp}</div>
      {!t.rail && <div className="warn">только эпоха каналов</div>}
      {!t.canal && <div className="warn">только эпоха ж/д</div>}
      {t.noDevelop && <div className="warn">💡 нельзя развивать</div>}
    </div>
  );
}

/** Планшет игрока: следующая плитка каждой отрасли и что осталось. */
export function Mat({ G, pid, onClose, pick }: {
  G: BBState; pid: string; onClose: () => void;
  /** Режим выбора отрасли (развитие). */
  pick?: { can: (i: Industry) => boolean; onPick: (i: Industry) => void; chosen: Industry[] };
}) {
  const p = G.players[pid];
  const color = p.color ?? 'orange';
  return (
    <div className="mat">
      <div className="mat-head">
        <b>Планшет: {nameOf(G, pid)}</b>
        {pick && <span className="hint"> — выберите отрасль для развития</span>}
        <button className="btn small ghost" onClick={onClose}>Закрыть</button>
      </div>
      <div className="mat-cols">
        {INDUSTRIES.map((ind) => {
          const taken = p.taken[ind] + (pick?.chosen.filter((c) => c === ind).length ?? 0);
          const rest = STACKS[ind].slice(taken);
          const next = rest[0];
          const can = pick ? pick.can(ind) : false;
          return (
            <div key={ind} className={`mat-col ${pick ? (can ? 'can' : 'dim') : ''}`}
              onClick={pick && can ? () => pick.onPick(ind) : undefined}>
              <div className="mat-title">{INDUSTRY_RU[ind]}</div>
              {next ? (
                <>
                  <img src={tileImg(ind, next.level, color)} alt="" />
                  <div className="mat-level">уровень {ROMAN[next.level]} · осталось {rest.length}</div>
                  <TileStats t={next} />
                  <div className="mat-rest">{rest.slice(1).map((t, i) => <span key={i}>{ROMAN[t.level]}</span>)}</div>
                </>
              ) : <div className="mat-empty">всё построено</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
