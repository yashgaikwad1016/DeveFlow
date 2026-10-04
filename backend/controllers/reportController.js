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
  if (req.user?.role !== 'Admin') {
    // Non-admins only receive safe public workspace identity, never internal policies or admin configs
    const rows = await query("SELECT `key`, value FROM settings WHERE `key` IN ('app_name', 'org_name')");
    const s = {};
    for (const r of rows) s[r.key] = r.value;
    return res.json(s);
  }
  const rows = await query("SELECT * FROM settings WHERE `key` != 'secret_key'");
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  res.json(s);
}

// PUT /api/settings
async function updateSettings(req, res) {
  const b = req.body;
  const allowedKeys = [
    'app_name',
    'org_name',
    'support_email',
    'hours_per_day',
    'working_days_per_week',
    'default_sprint_weeks',
    'story_point_scale',
    'default_task_priority',
    'allow_member_project_creation',
    'require_2fa',
    'session_timeout_hours',
    'auto_archive_completed_sprints',
  ];

  for (const k of allowedKeys) {
    if (k in b && b[k] !== undefined && b[k] !== null) {
      await run(
        "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
        [k, String(b[k]).trim(), String(b[k]).trim()]
      );
    }
  }

  const rows = await query("SELECT * FROM settings WHERE `key` != 'secret_key'");
  const updated = {};
  for (const r of rows) updated[r.key] = r.value;

  res.json({ message: 'Workspace settings saved successfully', settings: updated });
}

// Helper to convert array of objects to CSV string
function toCsv(rows, columns) {
  const header = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  if (!rows || rows.length === 0) {
    return header + '\r\n';
  }

  const lines = rows.map(row => {
    return columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) return '""';
      if (val instanceof Date) val = val.toISOString().slice(0, 19).replace('T', ' ');
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });

  return [header, ...lines].join('\r\n');
}

// GET /api/reports/project/:id/export
async function exportProjectCsv(req, res) {
  const pid = parseInt(req.params.id);
  await checkProject(req.user, pid);

  const project = await one('SELECT project_name FROM projects WHERE project_id = ?', [pid]);
  const tasks = await query(
    `${TASK_SQL} WHERE t.project_id = ? ORDER BY t.task_id ASC`,
    [pid]
  );

  const columns = [
    { label: 'Task ID', key: 'task_id' },
    { label: 'Project', key: 'project_name' },
    { label: 'Sprint', key: 'sprint_name' },
    { label: 'Task Title', key: 'title' },
    { label: 'Status', key: 'status' },
    { label: 'Priority', key: 'priority' },
    { label: 'Assignee', key: 'assignee' },
    { label: 'Est Hours', key: 'estimated_hours' },
    { label: 'Logged Hours', key: 'logged_hours' },
    { label: 'Deadline', key: 'deadline' },
    { label: 'Created At', key: 'created_at' },
  ];

  const csvContent = toCsv(tasks, columns);
  const safeProjectName = (project?.project_name || 'Project').replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `DevFlow-${safeProjectName}-Tasks-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}

// GET /api/reports/sprint/:id/export
async function exportSprintCsv(req, res) {
  const sid = parseInt(req.params.id);
  const sprint = await one('SELECT s.*, p.project_name FROM sprints s JOIN projects p USING(project_id) WHERE s.sprint_id = ?', [sid]);
  if (!sprint) {
    return res.status(404).json({ error: 'Sprint not found' });
  }
  await checkProject(req.user, sprint.project_id);

  const tasks = await query(
    `${TASK_SQL} WHERE t.sprint_id = ? ORDER BY t.task_id ASC`,
    [sid]
  );

  const columns = [
    { label: 'Task ID', key: 'task_id' },
    { label: 'Sprint', key: 'sprint_name' },
    { label: 'Project', key: 'project_name' },
    { label: 'Task Title', key: 'title' },
    { label: 'Status', key: 'status' },
    { label: 'Priority', key: 'priority' },
    { label: 'Assignee', key: 'assignee' },
    { label: 'Est Hours', key: 'estimated_hours' },
    { label: 'Logged Hours', key: 'logged_hours' },
    { label: 'Deadline', key: 'deadline' },
    { label: 'Created At', key: 'created_at' },
  ];

  const csvContent = toCsv(tasks, columns);
  const safeSprintName = (sprint.sprint_name || 'Sprint').replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `DevFlow-${safeSprintName}-Tasks-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}

// GET /api/reports/payments/export (Admin Only)
async function exportPaymentsCsv(req, res) {
  const payments = await query(
    `SELECT 
      p.payment_id,
      p.receipt_number,
      u.name AS user_name,
      u.email AS user_email,
      pl.name AS plan_name,
      s.member_count,
      p.amount,
      p.currency,
      p.status,
      p.payment_method,
      p.razorpay_payment_id,
      p.razorpay_order_id,
      p.payment_time,
      p.created_at
     FROM payments p
     JOIN users u ON p.user_id = u.user_id
     LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
     LEFT JOIN plans pl ON s.plan_id = pl.plan_id
     ORDER BY p.payment_id DESC`
  );

  const columns = [
    { label: 'Payment ID', key: 'payment_id' },
    { label: 'Receipt Number', key: 'receipt_number' },
    { label: 'Customer Name', key: 'user_name' },
    { label: 'Customer Email', key: 'user_email' },
    { label: 'Plan', key: 'plan_name' },
    { label: 'Seats', key: 'member_count' },
    { label: 'Amount', key: 'amount' },
    { label: 'Currency', key: 'currency' },
    { label: 'Status', key: 'status' },
    { label: 'Method', key: 'payment_method' },
    { label: 'Razorpay Payment ID', key: 'razorpay_payment_id' },
    { label: 'Razorpay Order ID', key: 'razorpay_order_id' },
    { label: 'Payment Date', key: 'payment_time' },
    { label: 'Created At', key: 'created_at' },
  ];

  const csvContent = toCsv(payments, columns);
  const filename = `DevFlow-Payments-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}

export { projectReport, getSettings, updateSettings, exportProjectCsv, exportSprintCsv, exportPaymentsCsv };
export default { projectReport, getSettings, updateSettings, exportProjectCsv, exportSprintCsv, exportPaymentsCsv };
