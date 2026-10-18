import {
  beerOptions, coalSources, defaultBeerPicks, defaultCoalPicks, defaultIronPicks, ironSources, locName, MERCHANTS, nameOf, nextBuyPrice,
  pickKey, type BBState, type BeerPick, type Industry, type MerchantId, type NodeId, type ResPick, type ResSource,
} from '@bb/engine';

interface Row { key: string; label: string; max: number }

/** Счётчики «сколько взять из каждого источника». */
function CountPicker({ title, need, rows, value, onChange, footer }: {
  title: string; need: number; rows: Row[]; value: Record<string, number>; onChange: (v: Record<string, number> | null) => void;
  footer?: string;
}) {
  const total = Object.values(value).reduce((a, b) => a + b, 0);
  const set = (k: string, n: number) => onChange({ ...value, [k]: n });
  return (
    <div className="picker">
      <div className="picker-head">
        <b>{title}</b> <span className="hint">нужно {need}, выбрано {total}</span>
        <button className="link-btn" onClick={() => onChange(null)}>авто</button>
      </div>
      {rows.map((r) => {
        const v = value[r.key] ?? 0;
        return (
          <div key={r.key} className="picker-row">
            <span className="grow">{r.label}</span>
            <button className="btn tiny" disabled={v <= 0} onClick={() => set(r.key, v - 1)}>−</button>
            <span className="picker-n">{v}</span>
            <button className="btn tiny" disabled={v >= r.max} onClick={() => set(r.key, v + 1)}>+</button>
          </div>
        );
      })}
      {footer && <div className="hint">{footer}</div>}
    </div>
  );
}

const srcKey = (s: { loc: string; slot: number }) => `${s.loc}:${s.slot}`;
const toRecord = (picks: ResPick[]) => Object.fromEntries(picks.map((p) => [srcKey(p), p.n]));
const toPicks = (rec: Record<string, number>): ResPick[] =>
  Object.entries(rec).filter(([, n]) => n > 0).map(([k, n]) => {
    const i = k.lastIndexOf(':');
    return { loc: k.slice(0, i), slot: Number(k.slice(i + 1)), n };
  });

/** Есть ли реальный выбор угля: в первом не исчерпываемом целиком «кольце» ≥ 2 шахты. */
function coalAmbiguous(sources: ResSource[], need: number): boolean {
  let left = need;
  const dists = [...new Set(sources.map((s) => s.dist))];
  for (const d of dists) {
    const tier = sources.filter((s) => s.dist === d);
    const total = tier.reduce((a, s) => a + s.avail, 0);
    if (total <= left) { left -= total; if (left === 0) return false; continue; }
    return tier.length > 1;
  }
  return false;
}

function ironAmbiguous(sources: ResSource[], need: number): boolean {
  const total = sources.reduce((a, s) => a + s.avail, 0);
  return sources.length > 1 && need < total;
}

const srcLabel = (G: BBState, s: ResSource, withDist: boolean) =>
  `${locName(s.loc)} (${nameOf(G, s.owner)}), есть ${s.avail}${withDist ? `, связей: ${s.dist}` : ''}`;

export function CoalPicker({ G, at, need, value, onChange }: {
  G: BBState; at: NodeId[]; need: number; value: ResPick[] | null; onChange: (v: ResPick[] | null) => void;
}) {
  const sources = coalSources(G, at);
  if (need <= 0 || !coalAmbiguous(sources, need)) return null;
  const def = defaultCoalPicks(G, at, need);
  const rec = toRecord(value ?? def.picks);
  return (
    <CountPicker title="Уголь (из ближайших шахт)" need={Math.min(need, sources.reduce((a, s) => a + s.avail, 0))}
      rows={sources.map((s) => ({ key: srcKey(s), label: srcLabel(G, s, true), max: s.avail }))}
      value={rec} onChange={(v) => onChange(v ? toPicks(v) : null)}
      footer={def.market ? `С рынка: ${def.market} (следующий куб £${nextBuyPrice('coal', G.coal)})` : undefined} />
  );
}

export function IronPicker({ G, need, value, onChange }: {
  G: BBState; need: number; value: ResPick[] | null; onChange: (v: ResPick[] | null) => void;
}) {
  const sources = ironSources(G);
  if (need <= 0 || !ironAmbiguous(sources, need)) return null;
  const def = defaultIronPicks(G, need);
  const rec = toRecord(value ?? def.picks);
  return (
    <CountPicker title="Железо (с любых заводов)" need={Math.min(need, sources.reduce((a, s) => a + s.avail, 0))}
      rows={sources.map((s) => ({ key: srcKey(s), label: srcLabel(G, s, false), max: s.avail }))}
      value={rec} onChange={(v) => onChange(v ? toPicks(v) : null)} />
  );
}

function beerLabel(G: BBState, p: BeerPick): string {
  if (p.kind === 'merchant') return `Торговец ${MERCHANTS[p.merchant].ru} (+бонус)`;
  const t = G.slots[p.loc][p.slot]!;
  return `Пивоварня: ${locName(p.loc)} (${nameOf(G, t.owner)})`;
}

/** Выбор пива. sell — продажа торговцу (его бочка даёт бонус). */
export function BeerPicker({ G, me, at, need, sell, value, onChange, title = 'Пиво' }: {
  G: BBState; me: string; at: NodeId[]; need: number; sell?: { merchant: MerchantId; industry: Industry };
  value: BeerPick[] | null; onChange: (v: BeerPick[] | null) => void; title?: string;
}) {
  if (need <= 0) return null;
  const options = beerOptions(G, me, at, sell);
  const total = options.reduce((a, o) => a + o.avail, 0);
  if (options.length < 2 || total <= need && !options.some((o) => o.pick.kind === 'merchant')) {
    if (!options.length || total < need) return <div className="hint warn">{title}: не хватает пива</div>;
    return null;
  }
  const picks = value ?? defaultBeerPicks(options, need) ?? [];
  const rec: Record<string, number> = {};
  for (const p of picks) rec[pickKey(p)] = (rec[pickKey(p)] ?? 0) + 1;
  const byKey = new Map(options.map((o) => [pickKey(o.pick), o]));
  return (
    <CountPicker title={title} need={need}
      rows={options.map((o) => ({ key: pickKey(o.pick), label: `${beerLabel(G, o.pick)}, бочек ${o.avail}`, max: o.avail }))}
      value={rec}
      onChange={(v) => {
        if (!v) return onChange(null);
        const out: BeerPick[] = [];
        for (const [k, n] of Object.entries(v)) for (let i = 0; i < n; i++) out.push(byKey.get(k)!.pick);
        onChange(out);
      }} />
  );
}
