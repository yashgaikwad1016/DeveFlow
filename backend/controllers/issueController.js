import { query, one, run, now } from '../config/db.js';
import { projectIds, inClause, checkProject, need, toInt, notify, logActivity } from '../utils/helpers.js';

// GET /api/issues[?project_id=]
export async function listIssues(req, res) {
  const ids = await projectIds(req.user);
  let filtered = ids;
  if (req.query.project_id) filtered = ids.filter(i => i === parseInt(req.query.project_id));
  const pin = inClause(filtered);
  if (!filtered.length) return res.json([]);
  const issues = await query(
    `SELECT i.*, a.name AS assignee, r.name AS reporter, p.project_name, t.title AS task_title
     FROM issues i
     LEFT JOIN users a ON a.user_id = i.assigned_to
     LEFT JOIN users r ON r.user_id = i.reported_by
     LEFT JOIN projects p ON p.project_id = i.project_id
     LEFT JOIN tasks t ON t.task_id = i.task_id
     WHERE i.project_id IN ${pin}
     ORDER BY (i.status IN ('Resolved','Closed')), i.issue_id DESC`
  );
  res.json(issues);
}

// POST /api/issues
export async function createIssue(req, res) {
  const b = req.body;
  need(b, 'project_id', 'title');
  await checkProject(req.user, b.project_id);
  const currentUid = req.user.user_id || req.user.id;

  // Prevent duplicate issue creation on rapid double-clicks (within 5 seconds)
  const recentDuplicate = await one(
    'SELECT issue_id FROM issues WHERE project_id = ? AND title = ? AND reported_by = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND)',
    [parseInt(b.project_id), b.title.trim(), currentUid]
  );
  if (recentDuplicate) {
    return res.json({ message: 'Bug reported', issue_id: recentDuplicate.issue_id });
  }

  let screenshot = null;
  if (req.file) {
    screenshot = `/uploads/${req.file.filename}`;
  } else if (b.screenshot && b.screenshot.startsWith('data:')) {
    screenshot = b.screenshot;
  }
  const result = await run(
    `INSERT INTO issues (task_id, project_id, title, description, severity, status, assigned_to, reported_by, screenshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [toInt(b.task_id), parseInt(b.project_id), b.title.trim(), b.description || '',
     b.severity || 'Medium', 'Open', toInt(b.assigned_to), currentUid, screenshot, now()]
  );
  if (b.assigned_to) await notify(parseInt(b.assigned_to), `🐞 Bug assigned to you: '${b.title}'`, 'issues');
  const mgr = await one('SELECT manager_id FROM projects WHERE project_id = ?', [parseInt(b.project_id)]);
  if (mgr && mgr.manager_id !== currentUid) {
    await notify(mgr.manager_id, `🐞 ${req.user.name || req.user.username} reported a bug: '${b.title}'`, 'issues');
  }
  await logActivity(req.user, parseInt(b.project_id), `reported bug '${b.title}'`);
  res.json({ message: 'Bug reported', issue_id: result.insertId });
}


// PUT /api/issues/:id
export async function updateIssue(req, res) {
  const iid = parseInt(req.params.id);
  const issue = await one('SELECT * FROM issues WHERE issue_id = ?', [iid]);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  await checkProject(req.user, issue.project_id);
  let b = req.body;
  for (const f of ['status', 'severity', 'assigned_to', 'description']) {
    if (f in b) await run(`UPDATE issues SET ${f} = ? WHERE issue_id = ?`, [b[f] || null, iid]);
  }
  if (b.assigned_to && String(b.assigned_to) !== String(issue.assigned_to)) {
    await notify(parseInt(b.assigned_to), `🐞 Bug assigned to you: '${issue.title}'`, 'issues');
  }
  const currentUid = req.user.user_id || req.user.id;
  if (b.status && b.status !== issue.status) {
    if (issue.reported_by !== currentUid) {
      await notify(issue.reported_by, `Bug '${issue.title}' is now ${b.status}`, 'issues');
    }
    await logActivity(req.user, issue.project_id, `set bug '${issue.title}' to ${b.status}`);
  }
  res.json({ message: 'Issue updated' });
}

// DELETE /api/issues/:id
export async function deleteIssue(req, res) {
  const iid = parseInt(req.params.id);
  const issue = await one('SELECT * FROM issues WHERE issue_id = ?', [iid]);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  await checkProject(req.user, issue.project_id);
  await run('DELETE FROM issues WHERE issue_id = ?', [iid]);
  res.json({ message: 'Issue deleted' });
}

export default { listIssues, createIssue, updateIssue, deleteIssue };
