// ── Formatting ──────────────────────────────────────────────────────────────
export const fmtDate = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
  return new Date(s + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const ago = (s) => {
  if (!s) return '';
  const d = (Date.now() - new Date(s.replace(' ', 'T'))) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 604800) return Math.floor(d / 86400) + 'd ago';
  return fmtDate(s);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const isLate = (t) =>
  t.deadline && t.status !== 'Completed' &&
  (typeof t.deadline === 'string' ? t.deadline.slice(0, 10) : new Date(t.deadline).toISOString().slice(0, 10)) < todayISO();

export const pct = (done, total) => total ? Math.round(100 * (done || 0) / total) : 0;

// ── Avatar ──────────────────────────────────────────────────────────────────
export const COLORS = ['#4f46e5','#7c3aed','#db2777','#0891b2','#059669','#d97706','#dc2626','#2563eb'];
export const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
export const avatarColor = (name) => COLORS[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

// ── Status/Priority helpers ──────────────────────────────────────────────────
export const STATUSES = ['Pending', 'In Progress', 'Completed', 'Blocked'];
export const STATUS_COLOR = { Pending: '#3b82f6', 'In Progress': '#f59e0b', Completed: '#10b981', Blocked: '#ef4444' };
export const PRIO_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };

// ── CSV export ───────────────────────────────────────────────────────────────
export function downloadCSV(name, data) {
  if (!data || !data.length) return;
  const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
  const csv = [keys.join(',')]
    .concat(data.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
}

// ── Sprint state ─────────────────────────────────────────────────────────────
export const sprintState = (s) => {
  const t = todayISO();
  const end = typeof s.end_date === 'string' ? s.end_date.slice(0, 10) : new Date(s.end_date).toISOString().slice(0, 10);
  const start = typeof s.start_date === 'string' ? s.start_date.slice(0, 10) : new Date(s.start_date).toISOString().slice(0, 10);
  return end < t ? 'Ended' : start > t ? 'Upcoming' : 'Active';
};

// ── Date format for input[type=date] ─────────────────────────────────────────
export const toDateInput = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
};
