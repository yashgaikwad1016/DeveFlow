import { initials, avatarColor } from '../utils/helpers';

export function Avatar({ name, size = '' }) {
  const bg = avatarColor(name);
  const abbr = initials(name);
  const cls = `avatar${size ? ' ' + size : ''}`;
  return <span className={cls} title={name || ''} style={{ background: bg }}>{abbr}</span>;
}

export function Person({ name, sub }) {
  return (
    <div className="person">
      <Avatar name={name} size="sm" />
      <div>
        <b>{name || 'Unassigned'}</b>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

export function Badge({ value, extra = '' }) {
  if (!value) return null;
  const cls = `badge b-${String(value).replace(/\s+/g, '-')}`;
  return <span className={cls}>{value}{extra}</span>;
}

export function Progress({ value }) {
  const p = value || 0;
  return (
    <div className="prog-row">
      <div className="progress"><div style={{ width: `${p}%` }}></div></div>
      <span>{p}%</span>
    </div>
  );
}

export function Ring({ pct, color = '#4f46e5' }) {
  const r = 24, C = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg width="58" height="58" viewBox="0 0 58 58">
        <circle cx="29" cy="29" r={r} fill="none" stroke="var(--slate-soft)" strokeWidth="6" />
        {pct > 0 && (
          <circle cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(C * pct) / 100} ${C}`} />
        )}
      </svg>
      <b>{pct}%</b>
    </div>
  );
}

export function Empty({ icon, title, text, action, sm }) {
  const IC_MAP = {
    folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    kanban: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/></>,
    bug: <><path d="m8 2 1.88 1.88M14.12 3.88 16 2"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    check: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    sparkles: <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  };
  return (
    <div className={`empty${sm ? ' sm' : ''}`}>
      <div className="ill">
        <svg className="i" viewBox="0 0 24 24">{IC_MAP[icon]}</svg>
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Kpi({ icon, tone, val, lbl, sub }) {
  const IC_MAP = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></>,
    check: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    bug: <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    trend: <><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></>,
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  };
  return (
    <div className="card kpi">
      <div className={`ico t-${tone}`}>
        <svg className="i" viewBox="0 0 24 24">{IC_MAP[icon]}</svg>
      </div>
      <div>
        <div className="val">{val}</div>
        <div className="lbl">{lbl}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="empty">
      <div className="ill">
        <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <p>Loading…</p>
    </div>
  );
}
