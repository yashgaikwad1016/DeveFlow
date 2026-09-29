import { query, one, run } from '../config/db.js';
import { checkProject, pct, isMgr } from '../utils/helpers.js';
import { listSprints } from './sprintController.js';
import ai from '../services/ai.js';

const TASK_SQL = `SELECT t.*, u.name AS assignee, s.sprint_name, p.project_name
  FROM tasks t
  LEFT JOIN users u ON u.user_id = t.assigned_to
  LEFT JOIN sprints s ON s.sprint_id = t.sprint_id
  LEFT JOIN projects p ON p.project_id = t.project_id`;

function summarize(tasks) {
  const statuses = ['Pending', 'In Progress', 'Completed', 'Blocked'];
  const s = { total: tasks.length };
  for (const st of statuses) s[st] = tasks.filter(t => t.status === st).length;
  s.pct = s.total ? Math.round(100 * s['Completed'] / s.total) : 0;
  return s;
}

// GET /api/reports/project/:id
async function projectReport(req, res) {
  const pid = parseInt(req.params.id);
  await checkProject(req.user, pid);
  const project = await one(
    'SELECT p.*, u.name AS manager FROM projects p LEFT JOIN users u ON u.user_id = p.manager_id WHERE project_id = ?',
    [pid]
  );
  const tasks = await query(
    `${TASK_SQL} WHERE t.project_id = ? ORDER BY t.status, t.deadline`,
    [pid]
  );
  const sprints = await query(
    `SELECT s.*, p.project_name, COUNT(t.task_id) AS total, SUM(t.status = 'Completed') AS done
     FROM sprints s JOIN projects p USING(project_id)
     LEFT JOIN tasks t ON t.sprint_id = s.sprint_id
     WHERE s.project_id = ? GROUP BY s.sprint_id ORDER BY s.start_date DESC`,
    [pid]
  );
  for (const s of sprints) s.pct = pct(s.done, s.total);

  const issues = await query(
    `SELECT i.*, a.name AS assignee FROM issues i
     LEFT JOIN users a ON a.user_id = i.assigned_to
     WHERE i.project_id = ? ORDER BY i.issue_id DESC`,
    [pid]
  );
  let team = [];
  try { const perf = await ai.performance(pid); team = perf.members || []; } catch (e) {}

  const summ = summarize(tasks);
  const status_counts = {
    'Pending': summ['Pending'] || 0,
    'In Progress': summ['In Progress'] || 0,
    'Completed': summ['Completed'] || 0,
    'Blocked': summ['Blocked'] || 0,
  };

  const overdue = tasks.filter(t => {
    if (!t.deadline || t.status === 'Completed') return false;
    return new Date(t.deadline).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
  }).length;

  // Workload by member
  const member_workload = (team || []).map(m => ({
    user_id: m.user_id,
    name: m.name,
    tasks_count: tasks.filter(t => t.assigned_to === m.user_id).length,
    completed_count: tasks.filter(t => t.assigned_to === m.user_id && t.status === 'Completed').length,
  }));

  // Sprint history
  const sprint_history = sprints.map(s => ({
    sprint_id: s.sprint_id,
    sprint_name: s.sprint_name,
    done_count: parseInt(s.done) || 0,
    total_count: parseInt(s.total) || 0,
    pct: s.pct,
  }));

  res.json({
    project,
    summary: summ,
    total_tasks: summ.total,
    done_tasks: summ['Completed'] || 0,
    in_progress_tasks: summ['In Progress'] || 0,
    blocked_tasks: summ['Blocked'] || 0,
    completion_rate: summ.pct,
    overdue_tasks: overdue,
    status_counts,
    member_workload,
    sprint_history,
    tasks,
    sprints,
    issues,
    team
  });
}

// GET /api/settings
async function getSettings(req, res) {
  const rows = await query("SELECT * FROM settings WHERE `key` != 'secret_key'");
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  res.json(s);
}

// PUT /api/settings
async function updateSettings(req, res) {
  const b = req.body;
  for (const k of ['app_name', 'org_name', 'hours_per_day']) {
    if (k in b) {
      await run(
        "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
        [k, String(b[k]).trim(), String(b[k]).trim()]
      );
    }
  }
  res.json({ message: 'Settings saved' });
}

export { projectReport, getSettings, updateSettings };
export default { projectReport, getSettings, updateSettings };
