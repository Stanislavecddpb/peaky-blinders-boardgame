import { COLORS, type BBState } from '@bb/engine';
import { COLOR_HEX, COLOR_NAME, avatarImg } from './assets';
import { Page } from '../Page';

/** Перед партией: имена (в хотсите) и цвета; хост начинает игру. */
export function Lobby({ G, me, moves, nameOf, joined, hotseat }: {
  G: BBState; me: string | null; moves: any; nameOf: (pid: string) => string;
  /** Сетевая игра: кто уже занял место. */
  joined?: (pid: string) => boolean;
  hotseat?: boolean;
}) {
  const pids = Object.keys(G.players);
  const isHost = me === '0';
  const waiting = joined ? pids.filter((pid) => !joined(pid)) : [];
  const ready = pids.every((pid) => G.players[pid].color) && waiting.length === 0;
  return (
    <Page title="Перед партией" subtitle="Выберите цвет. Хост начинает игру, когда все готовы.">
      <section className="page-card">
        <div className="seat-list">
          {pids.map((pid) => {
            const color = G.players[pid].color;
            const canPick = me === pid || isHost;
            return (
              <div key={pid} className={`seat ${pid === me && !hotseat ? 'me' : ''}`} style={{ borderLeftColor: color ? COLOR_HEX[color] : undefined }}>
                {color ? <img className="seat-avatar" src={avatarImg(color)} alt="" /> : <span className="seat-avatar empty" />}
                <span className="seat-name">
                  {hotseat
                    ? <input defaultValue={G.players[pid].name || `Игрок ${Number(pid) + 1}`} maxLength={20}
                        onBlur={(e) => moves.setName(e.target.value, pid)} aria-label={`Имя игрока ${Number(pid) + 1}`} />
                    : joined && !joined(pid) ? <i>ждём игрока…</i> : <><b>{nameOf(pid)}</b>{pid === me && ' (вы)'}</>}
                </span>
                <span className="swatches">
                  {COLORS.map((c) => {
                    const taken = pids.some((o) => o !== pid && G.players[o].color === c);
                    return (
                      <button key={c} className={`swatch ${color === c ? 'on' : ''}`} title={COLOR_NAME[c]} aria-label={COLOR_NAME[c]}
                        style={{ background: COLOR_HEX[c] }} disabled={!canPick || taken}
                        onClick={() => moves.setColor(c, pid)} />
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
        {isHost && waiting.length > 0 && (
          <div className="page-note warn">Ещё не зашли: {waiting.length}. Отправьте друзьям ссылку («Скопировать ссылку» вверху).</div>
        )}
        {isHost
          ? <button className="btn" disabled={!ready} onClick={() => moves.startGame()}>Начать игру</button>
          : <div className="page-note">Ждём, пока хост начнёт игру…</div>}
        {isHost && !ready && waiting.length === 0 && <div className="page-note">Нужно, чтобы у всех был цвет.</div>}
      </section>
    </Page>
  );
}
