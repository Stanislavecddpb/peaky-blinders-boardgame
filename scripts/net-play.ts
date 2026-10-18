// Полная сетевая партия ботами через сервер (socket.io) + проверка секретности и переподключения.
// npx tsx scripts/net-play.ts [сервер=http://localhost:3001] [игроков=3]
import { LobbyClient } from 'boardgame.io/client';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { BrassGame, COLORS, GAME_ID, currentPid, enumerateActions, type BBState } from '../packages/engine/src/index';

const server = process.argv[2] ?? 'http://localhost:3001';
const N = Number(process.argv[3] ?? 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lobby = new LobbyClient({ server });

async function main() {

const { matchID } = await lobby.createMatch(GAME_ID, { numPlayers: N });
const creds: string[] = [];
for (let i = 0; i < N; i++) {
  const { playerCredentials } = await lobby.joinMatch(GAME_ID, matchID, { playerID: String(i), playerName: `Бот ${i + 1}` });
  creds.push(playerCredentials);
}
console.log('Партия', matchID);

function connect(i: number) {
  const c = Client({ game: BrassGame, multiplayer: SocketIO({ server }), matchID, playerID: String(i), credentials: creds[i], debug: false });
  c.start();
  return c;
}
const clients = Array.from({ length: N }, (_, i) => connect(i));

async function until(pred: () => boolean, what: string, ms = 15000) {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error(`Не дождались: ${what}`);
    await sleep(20);
  }
}

await until(() => clients.every((c) => c.getState()), 'синхронизация');
// Ходы лобби — по очереди: одновременные ходы с устаревшим stateID сервер отбрасывает.
for (let i = 0; i < N; i++) {
  clients[i].moves.setColor(COLORS[i]);
  await until(() => clients.every((c) => c.getState()!.G.players[String(i)].color === COLORS[i]), `цвет ${i}`);
  clients[i].moves.setName(`Бот ${i + 1}`);
  await until(() => clients.every((c) => c.getState()!.G.players[String(i)].name === `Бот ${i + 1}`), `имя ${i}`);
}
clients[0].moves.startGame();
await until(() => clients.every((c) => c.getState()!.ctx.phase === 'play'), 'старт');

let leaks = 0;
function checkSecrecy() {
  clients.forEach((c, i) => {
    const G = c.getState()!.G as BBState;
    for (const [pid, p] of Object.entries(G.players)) {
      if (pid !== String(i) && p.hand.length) leaks++;
    }
    if (G.deck.length || G.discard.length) leaks++;
  });
}

let turns = 0;
let reconnected = false;
const r = () => Math.random();
while (!clients[0].getState()!.ctx.gameover) {
  const s0 = clients[0].getState()!;
  const pid = currentPid(s0.G);
  const idx = Number(pid);
  const c = clients[idx];
  await until(() => c.getState()!.ctx.currentPlayer === pid && c.getState()!.G.orderPos === s0.G.orderPos, 'ход у клиента');
  let G = c.getState()!.G as BBState;
  while (G.actionsLeft > 0 && G.players[pid].hand.length) {
    const all = enumerateActions(G, pid);
    const sells = all.filter((a) => a.type === 'sell');
    const good = all.filter((a) => a.type === 'build' || a.type === 'network' || (a.type === 'loan' && G.players[pid].money < 8));
    const pool = sells.length && r() < 0.7 ? sells : good.length && r() < 0.9 ? good : all;
    const a = pool[Math.floor(r() * pool.length)];
    const before = G.actionsDone;
    c.moves.act(a);
    await until(() => (c.getState()!.G as BBState).actionsDone === before + 1, `действие ${a.type}`);
    G = c.getState()!.G as BBState;
  }
  const turnBefore = c.getState()!.ctx.turn;
  c.moves.finishTurn();
  await until(() => clients[0].getState()!.ctx.turn > turnBefore || !!clients[0].getState()!.ctx.gameover, 'конец хода');
  turns++;
  checkSecrecy();
  // Переподключение посреди партии.
  if (turns === 15 && !reconnected) {
    const k = (idx + 1) % N;
    clients[k].stop();
    await sleep(300);
    clients[k] = connect(k);
    await until(() => !!clients[k].getState() && clients[k].getState()!.ctx.turn === clients[0].getState()!.ctx.turn, 'переподключение');
    reconnected = true;
    console.log(`Бот ${k + 1} переподключился`);
  }
  if (turns > 300) throw new Error('Слишком много ходов');
}
await sleep(300);
const end = clients[0].getState()!;
const G = end.G as BBState;
// Журналы у всех одинаковые.
const logs = clients.map((c) => JSON.stringify((c.getState()!.G as BBState).log.slice(-30)));
const sameLog = logs.every((l) => l === logs[0]);
console.log('Ходов:', turns);
console.log('Итог:', G.gameover!.ranking.map((pid) => `${G.players[pid].name}: ${G.players[pid].vp} ПО`).join(', '));
console.log('Утечек скрытого:', leaks, '| журналы совпадают:', sameLog);
clients.forEach((c) => c.stop());
process.exit(leaks === 0 && sameLog ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
