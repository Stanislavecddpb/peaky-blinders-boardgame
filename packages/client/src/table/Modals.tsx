import { useEffect, useRef, useState } from 'react';
import { incomeLevel, type BBState, type EraScore } from '@bb/engine';
import { COLOR_HEX, avatarImg } from './assets';

/** Хотсит: экран передачи хода закрывает руку следующего игрока. */
export function Handoff({ name, color, onReady }: { name: string; color?: string; onReady: () => void }) {
  return (
    <div className="popup handoff">
      <div className="popup-box">
        {color && <img className="handoff-avatar" src={avatarImg(color as any)} alt="" />}
        <h3>Ход переходит к игроку <span style={{ color: color ? COLOR_HEX[color as keyof typeof COLOR_HEX] : undefined }}>{name}</span></h3>
        <p>Передайте компьютер. Карты на руке откроются после нажатия.</p>
        <button className="btn" onClick={onReady} autoFocus>Я {name} — показать мои карты</button>
      </div>
    </div>
  );
}

function ScoreTable({ G, score, nameOf }: { G: BBState; score: EraScore; nameOf: (pid: string) => string }) {
  return (
    <table className="score">
      <thead><tr><th>Игрок</th><th>Связи</th><th>Плитки</th><th>Итого</th></tr></thead>
      <tbody>
        {G.order.map((pid) => {
          const r = score.rows[pid];
          return (
            <tr key={pid}>
              <td style={{ color: COLOR_HEX[G.players[pid].color ?? 'orange'] }}>{nameOf(pid)}</td>
              <td>+{r.links}</td><td>+{r.tiles}</td><td><b>+{r.links + r.tiles}</b></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Итоги эпохи каналов — всплывают у всех, когда эпоха закончилась. */
export function EraModal({ G, nameOf }: { G: BBState; nameOf: (pid: string) => string }) {
  const seen = useRef(G.eraScores.length);
  const [show, setShow] = useState<EraScore | null>(null);
  useEffect(() => {
    if (G.eraScores.length > seen.current) {
      const s = G.eraScores[G.eraScores.length - 1];
      if (s.era === 'canal') setShow(s);
    }
    seen.current = G.eraScores.length;
  }, [G.eraScores]);
  if (!show || G.gameover) return null;
  return (
    <div className="popup" onClick={() => setShow(null)}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Конец эпохи каналов</h3>
        <ScoreTable G={G} score={show} nameOf={nameOf} />
        <p className="hint">Связи и плитки I уровня убраны, бочки торговцев пополнены, всем роздано по 8 карт. Начинается эпоха железных дорог.</p>
        <button className="btn" onClick={() => setShow(null)}>Продолжить</button>
      </div>
    </div>
  );
}

export function GameOver({ G, nameOf }: { G: BBState; nameOf: (pid: string) => string }) {
  const [hidden, setHidden] = useState(false);
  if (!G.gameover) return null;
  if (hidden) return <button className="btn gameover-restore" onClick={() => setHidden(false)}>🏆 Итоги</button>;
  const { ranking, winners } = G.gameover;
  return (
    <div className="popup">
      <div className="popup-box gameover">
        <h3>Игра окончена — {winners.map(nameOf).join(', ')} {winners.length > 1 ? 'делят победу' : 'побеждает'}!</h3>
        <table className="score">
          <thead><tr><th>#</th><th>Игрок</th><th>ПО</th><th>Каналы</th><th>Ж/д</th><th>Доход</th><th>Деньги</th></tr></thead>
          <tbody>
            {ranking.map((pid, i) => {
              const p = G.players[pid];
              const canal = G.eraScores[0]?.rows[pid];
              const rail = G.eraScores[1]?.rows[pid];
              return (
                <tr key={pid} className={winners.includes(pid) ? 'win' : ''}>
                  <td>{i + 1}</td>
                  <td style={{ color: COLOR_HEX[p.color ?? 'orange'] }}>{nameOf(pid)}</td>
                  <td><b>{p.vp}</b></td>
                  <td>{canal ? `+${canal.links + canal.tiles}` : '—'}</td>
                  <td>{rail ? `+${rail.links + rail.tiles}` : '—'}</td>
                  <td>{incomeLevel(p.incomeSpace)}</td>
                  <td>£{p.money}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">При равенстве ПО побеждает больший доход, затем больше денег.</p>
        <div className="buttons">
          <button className="btn ghost" onClick={() => setHidden(true)}>Посмотреть поле</button>
          <a className="btn" href="#/">На главную</a>
        </div>
      </div>
    </div>
  );
}
