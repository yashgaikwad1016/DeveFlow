// Pure SVG charts matching the originals exactly

export function Donut({ segments, centerVal, centerLbl }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 70, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg width="170" height="170" viewBox="0 0 170 170">
          {total
            ? segments.filter(s => s.value).map((s, i) => {
                const len = (s.value / total) * C;
                const arc = (
                  <circle key={i} cx="85" cy="85" r={r} fill="none" stroke={s.color}
                    strokeWidth="22" strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-off} />
                );
                off += len;
                return arc;
              })
            : <circle cx="85" cy="85" r={r} fill="none" stroke="var(--slate-soft)" strokeWidth="22" />
          }
        </svg>
        <div className="center">
          <div><b>{centerVal}</b><small>{centerLbl}</small></div>
        </div>
      </div>
      <div className="legend">
        {segments.map((s, i) => (
          <div key={i}><i style={{ background: s.color }}></i>{s.label}<b>{s.value}</b></div>
        ))}
      </div>
    </div>
  );
}

export function HBars({ items, fmt = v => v }) {
  const max = Math.max(1, ...items.map(i => Math.max(i.v, i.g || 0)));
  return (
    <div>
      {items.map((i, idx) => (
        <div key={idx} className="hbar">
          <span className="name" title={i.label}>{i.label}</span>
          <div className="track">
            {i.g != null && <div className="fill ghost" style={{ width: `${(100 * i.g) / max}%` }}></div>}
            <div className="fill" style={{ width: `${(100 * i.v) / max}%` }}></div>
          </div>
          <span className="v">{fmt(i.v, i)}</span>
        </div>
      ))}
    </div>
  );
}

export function ColChart({ items }) {
  const max = Math.max(1, ...items.map(i => Math.max(i.v, i.g || 0)));
  return (
    <div className="cols-chart">
      {items.map((i, idx) => (
        <div key={idx} className="c" title={`${i.label}: ${i.v}/${i.g}`}>
          <div className="bars">
            <div className="bar ghost" style={{ height: `${(100 * (i.g || 0)) / max}%` }}></div>
            <div className="bar" style={{ height: `${(100 * i.v) / max}%` }}></div>
          </div>
          <small>{i.label}</small>
        </div>
      ))}
    </div>
  );
}
