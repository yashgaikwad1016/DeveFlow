/**
 * DevFlow AI Service (JavaScript port of ai.py)
 * 1. Smart Task Priority   2. Completion Prediction   3. Team Performance Analytics
 */
import { query, one } from '../config/db.js';

async function hoursPerDay() {
  const s = await one("SELECT value FROM settings WHERE `key` = 'hours_per_day'");
  return s ? parseFloat(s.value) : 6.0;
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function actualHours(task, hpd) {
  if (!task.created_at || !task.completed_at) return null;
  const a = new Date(task.created_at);
  const b = new Date(task.completed_at);
  const days = Math.max((b - a) / 86400000, 0.25);
  return days * hpd;
}

// Learn from completed tasks: time ratio and delay rate per user
async function history() {
  const hpd = await hoursPerDay();
  const done = await query(
    "SELECT * FROM tasks WHERE status = 'Completed' AND completed_at IS NOT NULL AND created_at IS NOT NULL"
  );
  const per = {};
  for (const t of done) {
    const uid = t.assigned_to;
    if (!per[uid]) per[uid] = { ratios: [], late: 0, n: 0, hours: [] };
    const act = actualHours(t, hpd);
    if (act === null) continue;
    const est = Math.max(t.estimated_hours || 1, 0.5);
    per[uid].ratios.push(act / est);
    per[uid].hours.push(act);
    per[uid].n += 1;
    const dl = parseDate(t.deadline);
    const comp = parseDate(t.completed_at);
    if (dl && comp && comp > dl) per[uid].late += 1;
  }
  const allRatios = Object.values(per).flatMap(u => u.ratios);
  const teamRatio = allRatios.length ? median(allRatios) : 1.0;
  for (const u of Object.values(per)) {
    u.ratio = u.ratios.length ? median(u.ratios) : 1.0;
    u.delay_rate = u.n ? u.late / u.n : 0;
  }
  return { per, teamRatio };
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function scoreTask(task, per, teamRatio, today = new Date()) {
  const todayDate = new Date(today.toDateString());
  const hpd = 6; // approximate, will be overridden in async context
  const h = per[task.assigned_to] || {};
  const ratio = h.ratio ?? teamRatio;
  const delay = h.delay_rate ?? 0.2;
  const est = task.estimated_hours || 4;
  const cx = task.complexity || 3;
  let score = 0;
  const why = [];
  const dl = parseDate(task.deadline);

  if (dl) {
    const left = Math.floor((dl - todayDate) / 86400000);
    let pts;
    if (left <= 0) { pts = 40; why.push('deadline passed / due today'); }
    else if (left <= 2) { pts = 35; why.push(`due in ${left} day(s)`); }
    else if (left <= 5) { pts = 25; why.push('due within 5 days'); }
    else if (left <= 10) { pts = 15; }
    else { pts = 5; }
    score += pts;
    const need = Math.ceil(est * ratio / 6);
    if (left > 0 && need >= left) {
      score += 10; why.push(`needs ~${need} day(s), only ${left} left`);
    }
  }

  score += Math.min(est / 40, 1) * 15;
  if (est >= 12) why.push(`large estimate (${est}h)`);
  score += (cx / 5) * 20;
  if (cx >= 4) why.push(`high complexity (${cx}/5)`);
  score += delay * 15;
  if (delay >= 0.4) why.push(`assignee often delayed (${Math.round(delay * 100)}%)`);
  if (task.status === 'Blocked') { score += 5; why.push('currently blocked'); }

  score = Math.min(Math.round(score * 10) / 10, 100);
  const level = score >= 60 ? 'High' : score >= 35 ? 'Medium' : 'Low';
  return { score, recommended: level, reasons: why.length ? why : ['normal workload'] };
}

async function recommendPriority(task) {
  const { per, teamRatio } = await history();
  return scoreTask(task, per, teamRatio).recommended;
}

async function priorityReport(tasks) {
  const { per, teamRatio } = await history();
  const out = tasks.map(t => ({ ...t, ...scoreTask(t, per, teamRatio) }));
  return out.sort((a, b) => b.score - a.score);
}

async function predict(tasks) {
  const { per, teamRatio } = await history();
  const hpd = await hoursPerDay();
  const today = new Date();
  const todayDate = new Date(today.toDateString());

  const scored = [...tasks].sort((a, b) =>
    scoreTask(b, per, teamRatio).score - scoreTask(a, per, teamRatio).score
  );

  const queue = {};
  const out = [];
  for (const t of scored) {
    const h = per[t.assigned_to] || {};
    const ratio = h.ratio ?? teamRatio;
    const progress = t.status === 'In Progress' ? 0.5 : 1;
    const rem = (t.estimated_hours || 4) * ratio * progress;
    queue[t.assigned_to] = (queue[t.assigned_to] || 0) + rem;
    const days = Math.ceil(queue[t.assigned_to] / hpd);
    const pdate = new Date(todayDate.getTime() + days * 86400000);
    const dl = parseDate(t.deadline);
    const n = h.n || 0;
    out.push({
      ...t,
      predicted_date: pdate.toISOString().slice(0, 10),
      expected_hours: Math.round(rem * 10) / 10,
      speed_ratio: Math.round(ratio * 100) / 100,
      confidence: n >= 8 ? 'High' : n >= 3 ? 'Medium' : 'Low',
      at_risk: !!(dl && pdate > dl),
    });
  }

  const finishDates = out.map(o => o.predicted_date).filter(Boolean);
  const finish = finishDates.length ? finishDates.sort().slice(-1)[0] : todayDate.toISOString().slice(0, 10);
  return { tasks: out, project_finish: finish, at_risk_count: out.filter(o => o.at_risk).length };
}

async function performance(projectId = null) {
  const hpd = await hoursPerDay();
  const filter = projectId ? 'AND t.project_id = ?' : '';
  const params = projectId ? [projectId] : [];
  const members = await query("SELECT user_id, name FROM users WHERE role != 'Admin'");
  const tasks = await query(`SELECT t.* FROM tasks t WHERE 1=1 ${filter}`, params);
  const sprints = await query(
    `SELECT s.*, p.project_name FROM sprints s JOIN projects p USING(project_id) ${projectId ? 'WHERE s.project_id = ?' : ''} ORDER BY s.start_date`,
    params
  );

  const res = [];
  for (const m of members) {
    const mine = tasks.filter(t => t.assigned_to === m.user_id);
    if (!mine.length) continue;
    const done = mine.filter(t => t.status === 'Completed' && t.completed_at && t.created_at);
    const hrs = done.map(t => actualHours(t, hpd)).filter(h => h !== null);
    const ontime = done.filter(t => {
      const dl = parseDate(t.deadline);
      const comp = parseDate(t.completed_at);
      return !dl || (comp && comp <= dl);
    });
    const open_t = mine.filter(t => t.status !== 'Completed');
    const otr = done.length ? ontime.length / done.length : 0;
    const pts = done.reduce((sum, t) => sum + (t.complexity || 1), 0);
    res.push({
      user_id: m.user_id,
      name: m.name,
      total: mine.length,
      completed: done.length,
      open: open_t.length,
      open_hours: open_t.reduce((s, t) => s + (t.estimated_hours || 0), 0),
      avg_completion_hours: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length * 10) / 10 : 0,
      on_time_pct: Math.round(otr * 100),
      points: pts,
      productivity: Math.round(pts * (0.5 + otr) * 10) / 10,
    });
  }
  res.sort((a, b) => b.productivity - a.productivity);

  const velocity = sprints.map(s => {
    const st = tasks.filter(t => t.sprint_id === s.sprint_id);
    const label = s.sprint_name + (projectId ? '' : ` (${s.project_name})`);
    return {
      sprint: label,
      points: st.filter(t => t.status === 'Completed').reduce((s, t) => s + (t.complexity || 1), 0),
      planned: st.reduce((s, t) => s + (t.complexity || 1), 0),
    };
  });

  const allH = res.map(r => r.avg_completion_hours).filter(h => h > 0);
  return {
    members: res,
    most_productive: res[0]?.name || '-',
    avg_completion_hours: allH.length ? Math.round(allH.reduce((a, b) => a + b, 0) / allH.length * 10) / 10 : 0,
    velocity,
    avg_velocity: velocity.length
      ? Math.round(velocity.reduce((s, v) => s + v.points, 0) / velocity.length * 10) / 10
      : 0,
  };
}

export { scoreTask, recommendPriority, priorityReport, predict, performance, history };
export default { scoreTask, recommendPriority, priorityReport, predict, performance, history };
