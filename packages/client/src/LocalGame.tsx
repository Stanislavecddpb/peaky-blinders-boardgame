import { useMemo, useState } from 'react';
import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import { BrassGame } from '@bb/engine';
import { HotseatBoard, SeatContext } from './table/Table';
import { Page, PlayerCountPicker } from './Page';

// Хотсит: локальный «сервер» в браузере, партия сохраняется в localStorage и переживает перезагрузку.
// Скрытие информации выключено (playerView: undefined), интерфейс сам показывает руку только текущего
// игрока — с экраном передачи хода.
const STORAGE = 'bb-hotseat';
const SAVE_KEY = 'bb:hotseat';

interface Saved { matchID: string; numPlayers: number }

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function clearStorage(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`${STORAGE}_`)) localStorage.removeItem(k);
    localStorage.removeItem(SAVE_KEY);
  } catch { /* приватный режим */ }
}

function makeHotseatClient(numPlayers: number) {
  return Client({
    game: { ...BrassGame, playerView: undefined },
    board: HotseatBoard,
    numPlayers,
    multiplayer: Local({ persist: true, storageKey: STORAGE }),
    debug: false,
  });
}

export function LocalGame() {
  const [numPlayers, setNumPlayers] = useState(4);
  const [game, setGame] = useState<Saved | null>(null);
  const saved = useMemo(loadSaved, []);
  // Чьими глазами смотрит клиент: текущий игрок.
  const [seat, setSeat] = useState('0');
  const HotseatClient = useMemo(() => (game ? makeHotseatClient(game.numPlayers) : null), [game]);

  function startNew() {
    clearStorage();
    const g = { matchID: `local-${Date.now()}`, numPlayers };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch { /* без сохранения */ }
    setGame(g);
  }

  if (!game || !HotseatClient) {
    return (
      <Page title="Игра за одним компьютером" subtitle="Ходите по очереди: перед каждым ходом экран закрывает карты, пока не подойдёт следующий игрок.">
        {saved && (
          <section className="page-card">
            <h2>Сохранённая партия</h2>
            <div className="page-note">Игроков: {saved.numPlayers}</div>
            <button className="btn" onClick={() => setGame(saved)}>Продолжить партию</button>
          </section>
        )}
        <section className="page-card">
          <h2>Новая партия</h2>
          <div className="page-field">Игроков
            <PlayerCountPicker value={numPlayers} onChange={setNumPlayers} />
          </div>
          <button className={`btn ${saved ? 'ghost' : ''}`} onClick={startNew}>Начать{saved ? ' новую (сохранённая пропадёт)' : ''}</button>
        </section>
        <a className="page-link" href="#/">← На главную</a>
      </Page>
    );
  }
  return (
    <SeatContext.Provider value={setSeat}>
      <HotseatClient matchID={game.matchID} playerID={seat} />
    </SeatContext.Provider>
  );
}
