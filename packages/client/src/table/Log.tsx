import { useState } from 'react';
import type { BBState } from '@bb/engine';
import { COLOR_HEX } from './assets';

const KEY = 'bb:log-open';
const load = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };

/** Журнал партии: свежие строки сверху; сворачивается (запоминается в браузере). */
export function Log({ G }: { G: BBState }) {
  const [open, setOpen] = useState(load);
  const toggle = () => {
    setOpen(!open);
    try { localStorage.setItem(KEY, open ? '0' : '1'); } catch { /* приватный режим */ }
  };
  const lines = G.log.slice(-120).reverse();
  return (
    <section className={`log ${open ? '' : 'closed'}`}>
      <button className="log-head" onClick={toggle}>Журнал {open ? '▾' : '▸'}</button>
      {(open ? lines : lines.slice(0, 1)).map((l) => {
        const color = l.pid ? G.players[l.pid]?.color : null;
        return (
          <div key={l.n} className={`log-line ${l.text.startsWith('Ход:') ? 'turn' : ''}`}
            style={color ? { borderLeftColor: COLOR_HEX[color] } : undefined}>{l.text}</div>
        );
      })}
    </section>
  );
}
