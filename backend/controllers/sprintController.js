import { query, one, run, now } from '../config/db.js';
import { projectIds, inClause, checkProject, pct, need, logActivity } from '../utils/helpers.js';

function calcDuration(start, end) {
  const s = new Date(start), e = new Date(end);
  return Math.floor((e - s) / 86400000) + 1;
}

async function sprintAccess(user, sprintId) {
  const s = await one('SELECT * FROM sprints WHERE sprint_id = ?', [sprintId]);
  if (!s) { const err = new Error('Sprint not found'); err.statusCode = 404; throw err; }
  await checkProject(user, s.project_id);
  return s;
}

// GET /api/sprints[?project_id=]
export async function listSprints(req, res) {
  const ids = await projectIds(req.user);
  let filtered = ids;
  if (req.query.project_id) filtered = ids.filter(i => i === parseInt(req.query.project_id));
  const pin = inClause(filtered);
  if (!filtered.length) return res.json([]);
  const ss = await query(
    `SELECT s.*, p.project_name,
      COUNT(t.task_id) AS total,
      SUM(t.status = 'Completed') AS done
     FROM sprints s JOIN projects p USING(project_id)
     LEFT JOIN tasks t ON t.sprint_id = s.sprint_id
     WHERE s.project_id IN ${pin}
     GROUP BY s.sprint_id
     ORDER BY s.start_date DESC`
  );
  for (const s of ss) {
    s.pct = pct(s.done, s.total);
    if (s.start_date && s.end_date) s.duration_days = calcDuration(s.start_date, s.end_date);
  }
  res.json(ss);
}

// POST /api/sprints
export async function createSprint(req, res) {
  const b = req.body;
  need(b, 'project_id', 'sprint_name', 'start_date', 'end_date');
  await checkProject(req.user, b.project_id);
  if (b.end_date < b.start_date) return res.status(400).json({ error: 'End date must be after start date' });
  const result = await run(
    'INSERT INTO sprints (project_id, sprint_name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
    [parseInt(b.project_id), b.sprint_name.trim(), b.goal || '', b.start_date, b.end_date]
  );
  await logActivity(req.user, parseInt(b.project_id), `created sprint '${b.sprint_name}'`);
  res.json({ message: 'Sprint created', sprint_id: result.insertId });
}

// PUT /api/sprints/:id
export async function updateSprint(req, res) {
  const sid = parseInt(req.params.id);
  const sprint = await sprintAccess(req.user, sid);
  const b = req.body;
  if (b.start_date && b.end_date && b.end_date < b.start_date) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }
  for (const f of ['sprint_name', 'goal', 'start_date', 'end_date']) {
    if (f in b) await run(`UPDATE sprints SET ${f} = ? WHERE sprint_id = ?`, [b[f], sid]);
  }
  res.json({ message: 'Sprint updated' });
}

// DELETE /api/sprints/:id
export async function deleteSprint(req, res) {
  const sid = parseInt(req.params.id);
  await sprintAccess(req.user, sid);
  await run('DELETE FROM sprints WHERE sprint_id = ?', [sid]);
  res.json({ message: 'Sprint deleted' });
}

// GET /api/reports/sprint/:id
export async function sprintReport(req, res) {
  const sid = parseInt(req.params.id);
  const sprint = await sprintAccess(req.user, sid);
  const project = await one('SELECT project_name FROM projects WHERE project_id = ?', [sprint.project_id]);
  sprint.project_name = project?.project_name || 'Project';

  const tasks = await query(
    `SELECT t.*, u.name AS assignee, s.sprint_name, p.project_name
     FROM tasks t
     LEFT JOIN users u ON u.user_id = t.assigned_to
     LEFT JOIN sprints s ON s.sprint_id = t.sprint_id
     LEFT JOIN projects p ON p.project_id = t.project_id
     WHERE t.sprint_id = ?`,
    [sid]
  );

  const statuses = ['Pending', 'In Progress', 'Completed', 'Blocked'];
  const summary = { total: tasks.length };
  for (const s of statuses) summary[s] = tasks.filter(t => t.status === s).length;
  summary.pct = summary.total ? Math.round(100 * summary['Completed'] / summary.total) : 0;

  res.json({
    sprint,
    summary,
    total_tasks: tasks.length,
    done_tasks: tasks.filter(t => t.status === 'Completed').length,
    pct: summary.pct,
    tasks,
    points_done: tasks.filter(t => t.status === 'Completed').reduce((s, t) => s + (t.complexity || 1), 0),
    points_total: tasks.reduce((s, t) => s + (t.complexity || 1), 0),
  });
}

export default { listSprints, createSprint, updateSprint, deleteSprint, sprintReport };
