import { query, one, run, now } from '../config/db.js';
import { projectIds, inClause, pct } from '../utils/helpers.js';
import ai from '../services/ai.js';

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Blocked'];

// GET /api/dashboard
export async function dashboard(req, res) {
  const u = req.user;
  const currentUid = u.user_id || u.id;
  const ids = await projectIds(u);
  const pin = inClause(ids);
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const member = u.role === 'Member';
  const taskParams = [];
  let taskWhere = `t.project_id IN ${pin}`;
  if (member) {
    taskWhere += ' AND t.assigned_to = ?';
    taskParams.push(currentUid);
  }

  const TASK_SQL = `SELECT t.*, u.name AS assignee, s.sprint_name, p.project_name
    FROM tasks t
    LEFT JOIN users u ON u.user_id = t.assigned_to
    LEFT JOIN sprints s ON s.sprint_id = t.sprint_id
    LEFT JOIN projects p ON p.project_id = t.project_id`;

  const tasks = ids.length
    ? await query(`${TASK_SQL} WHERE ${taskWhere}`, taskParams)
    : [];

  const openT = tasks.filter(t => t.status !== 'Completed');
  const statusCounts = {};
  for (const s of STATUSES) statusCounts[s] = tasks.filter(t => t.status === s).length;
  const overdue = openT.filter(t => {
    if (!t.deadline) return false;
    const dStr = typeof t.deadline === 'string' ? t.deadline.slice(0, 10) : new Date(t.deadline).toISOString().slice(0, 10);
    return dStr < today;
  }).length;
  const dueWeek = openT.filter(t => {
    if (!t.deadline) return false;
    const dStr = typeof t.deadline === 'string' ? t.deadline.slice(0, 10) : new Date(t.deadline).toISOString().slice(0, 10);
    return dStr >= today && dStr <= week;
  }).length;

  let issueSql = `SELECT COUNT(*) AS c FROM issues WHERE status NOT IN ('Resolved','Closed') AND project_id IN ${pin}`;
  const issueParams = [];
  if (member) {
    issueSql += ' AND assigned_to = ?';
    issueParams.push(currentUid);
  }
  const openIssues = ids.length ? (await one(issueSql, issueParams))?.c || 0 : 0;

  const projects = ids.length ? await query(
    `SELECT p.project_id, p.project_name, p.status, p.end_date,
      COUNT(t.task_id) AS total, SUM(t.status='Completed') AS done
     FROM projects p LEFT JOIN tasks t ON t.project_id = p.project_id
     WHERE p.project_id IN ${pin}
     GROUP BY p.project_id ORDER BY (p.status='Active') DESC, p.end_date LIMIT 6`
  ) : [];
  for (const p of projects) p.pct = pct(p.done, p.total);

  const sprints = ids.length ? await query(
    `SELECT s.sprint_id, s.sprint_name, s.start_date, s.end_date, p.project_name,
      COUNT(t.task_id) AS total, SUM(t.status='Completed') AS done
     FROM sprints s JOIN projects p USING(project_id)
     LEFT JOIN tasks t ON t.sprint_id = s.sprint_id
     WHERE s.project_id IN ${pin} AND s.start_date <= ? AND s.end_date >= ?
     GROUP BY s.sprint_id ORDER BY s.end_date`,
    [today, today]
  ) : [];

  for (const s of sprints) {
    s.pct = pct(s.done, s.total);
    const end = new Date(s.end_date);
    const diff = Math.floor((end - new Date(today)) / 86400000);
    s.days_left = diff;
  }

  const upcoming = openT
    .filter(t => t.deadline)
    .sort((a, b) => {
      const da = typeof a.deadline === 'string' ? a.deadline.slice(0, 10) : new Date(a.deadline).toISOString().slice(0, 10);
      const db = typeof b.deadline === 'string' ? b.deadline.slice(0, 10) : new Date(b.deadline).toISOString().slice(0, 10);
      return da < db ? -1 : 1;
    })
    .slice(0, 6);

  const activity = ids.length ? await query(
    `SELECT a.action, a.created_at, us.name, p.project_name
     FROM activity a LEFT JOIN users us USING(user_id)
     LEFT JOIN projects p USING(project_id)
     WHERE a.project_id IN ${pin} ORDER BY a.activity_id DESC LIMIT 6`
  ) : [];

  const activeProjects = ids.length ? (await query(
    `SELECT COUNT(*) AS c FROM projects WHERE project_id IN ${pin} AND status = 'Active'`
  ))[0]?.c || 0 : 0;

  const d = {
    role: u.role,
    status_counts: statusCounts,
    total_tasks: tasks.length,
    open_tasks: openT.length,
    completed: statusCounts['Completed'] || 0,
    overdue,
    due_week: dueWeek,
    open_issues: openIssues,
    active_projects: activeProjects,
    projects,
    sprints,
    upcoming,
    activity,
  };

  res.json(d);
}

// GET /api/search?q=
export async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ projects: [], tasks: [] });
  const s = `%${q}%`;
  const ids = await projectIds(req.user);
  const pin = inClause(ids);
  const projects = ids.length
    ? await query(`SELECT project_id, project_name FROM projects WHERE project_id IN ${pin} AND project_name LIKE ? LIMIT 5`, [s])
    : [];
  const tasks = ids.length
    ? await query(`SELECT task_id, title, status FROM tasks WHERE project_id IN ${pin} AND title LIKE ? LIMIT 8`, [s])
    : [];
  res.json({ projects, tasks });
}

export default { dashboard, search };
