import { cardName, incomeLevel, nameOf, type BBState } from '@bb/engine';
import { COLOR_HEX, avatarImg, cardImg } from './assets';

const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

/** Игроки в порядке хода: деньги, доход, ПО, траты, карты, жетоны связей, последний сброс. */
export function Players({ G, me, onMat }: { G: BBState; me: string | null; onMat: (pid: string) => void }) {
  return (
    <section className="players">
      {G.order.map((pid, i) => {
        const p = G.players[pid];
        const color = p.color ?? 'orange';
        const current = i === G.orderPos && !G.gameover;
        return (
          <div key={pid} className={`player ${current ? 'current' : ''}`} style={{ borderLeftColor: COLOR_HEX[color] }}>
            <img className="player-avatar" src={avatarImg(color)} alt="" style={{ borderColor: COLOR_HEX[color] }} />
            <div className="player-body">
              <div className="player-head">
                <b>{nameOf(G, pid)}</b>{pid === me && <span className="you"> (вы)</span>}
                {current && <span className="turn-mark">ходит</span>}
                <span className="money" title="Деньги">£{p.money}</span>
              </div>
              <div className="player-stats">
                <span title="Победные очки">★ {p.vp} ПО</span>
                <span title={`Уровень дохода (клетка ${p.incomeSpace})`} className={incomeLevel(p.incomeSpace) < 0 ? 'neg' : incomeLevel(p.incomeSpace) > 0 ? 'pos' : ''}>
                  доход {fmt(incomeLevel(p.incomeSpace))}
                </span>
                <span title="Потрачено в этом раунде — меньше тратишь, раньше ходишь">трат £{p.spent}</span>
              </div>
              <div className="player-stats">
                <span title="Карт на руке">🂠 {p.handCount ?? p.hand.length}</span>
                <span title="Жетонов связей осталось">⛓ {p.linksLeft}</span>
                <button className="link-btn" onClick={() => onMat(pid)}>планшет</button>
              </div>
            </div>
            {p.lastDiscard && (
              <img className="player-discard" src={cardImg(p.lastDiscard)} alt="" title={`Последний сброс: ${cardName(p.lastDiscard)}`} />
            )}
          </div>
        );
      })}
    </section>
  );
}
