import { query, one, run, now } from '../config/db.js';
import { projectIds, inClause, checkProject, pct, need, toInt, notify, logActivity } from '../utils/helpers.js';

// GET /api/projects
export async function listProjects(req, res) {
  const ids = await projectIds(req.user);
  const pin = inClause(ids);
  if (!ids.length) return res.json([]);
  const ps = await query(
    `SELECT p.*, u.name AS manager,
      COUNT(t.task_id) AS total,
      SUM(t.status = 'Completed') AS done,
      (SELECT COUNT(*) FROM team_members tm WHERE tm.project_id = p.project_id) AS members
     FROM projects p
     LEFT JOIN users u ON u.user_id = p.manager_id
     LEFT JOIN tasks t ON t.project_id = p.project_id
     WHERE p.project_id IN ${pin}
     GROUP BY p.project_id
     ORDER BY p.project_id DESC`
  );
  for (const p of ps) p.pct = pct(p.done, p.total);
  res.json(ps);
}

// POST /api/projects
export async function createProject(req, res) {
  const b = req.body;
  need(b, 'project_name');
  if (b.start_date && b.end_date && b.end_date < b.start_date) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }
  const mgr = req.user.role === 'Admin' && b.manager_id ? parseInt(b.manager_id) : (req.user.user_id || req.user.id);

  // Prevent duplicate project creation on rapid double-clicks (within 5 seconds)
  const recentDuplicate = await one(
    'SELECT project_id FROM projects WHERE manager_id = ? AND project_name = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND)',
    [mgr, b.project_name.trim()]
  );
  if (recentDuplicate) {
    return res.json({ message: 'Project created', project_id: recentDuplicate.project_id });
  }

  const result = await run(
    'INSERT INTO projects (project_name, description, start_date, end_date, status, manager_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [b.project_name.trim(), b.description || '', b.start_date || null, b.end_date || null, 'Active', mgr, now()]
  );
  const pid = result.insertId;
  await run('INSERT IGNORE INTO team_members (user_id, project_id) VALUES (?, ?)', [mgr, pid]);
  if (mgr !== (req.user.user_id || req.user.id)) {
    await notify(mgr, `You are the manager of new project '${b.project_name}'`, 'projects');
  }
  await logActivity(req.user, pid, `created project '${b.project_name}'`);
  res.json({ message: 'Project created', project_id: pid });
}


// PUT /api/projects/:id
export async function updateProject(req, res) {
  const pid = parseInt(req.params.id);
  await checkProject(req.user, pid);
  const b = req.body;
  const fields = ['project_name', 'description', 'start_date', 'end_date', 'status'];
  for (const f of fields) {
    if (f in b) await run(`UPDATE projects SET ${f} = ? WHERE project_id = ?`, [b[f] || null, pid]);
  }
  if (req.user.role === 'Admin' && b.manager_id) {
    await run('UPDATE projects SET manager_id = ? WHERE project_id = ?', [parseInt(b.manager_id), pid]);
    await run('INSERT IGNORE INTO team_members (user_id, project_id) VALUES (?, ?)', [parseInt(b.manager_id), pid]);
  }
  await logActivity(req.user, pid, 'updated project details');
  res.json({ message: 'Project updated' });
}

// DELETE /api/projects/:id
export async function deleteProject(req, res) {
  const pid = parseInt(req.params.id);
  await checkProject(req.user, pid);
  await run('DELETE FROM projects WHERE project_id = ?', [pid]);
  res.json({ message: 'Project deleted' });
}

// GET /api/projects/:id/members
export async function listMembers(req, res) {
  const pid = parseInt(req.params.id);
  await checkProject(req.user, pid);
  const members = await query(
    `SELECT tm.member_id, u.user_id, u.name, u.email, u.role, u.designation
     FROM team_members tm JOIN users u USING(user_id)
     WHERE tm.project_id = ? AND u.active = 1
     ORDER BY u.name`,
    [pid]
  );
  res.json(members);
}

// POST /api/projects/:id/members
export async function addMember(req, res) {
  const pid = parseInt(req.params.id);
  await checkProject(req.user, pid);
  need(req.body, 'user_id');
  const uid = parseInt(req.body.user_id);
  await run('INSERT IGNORE INTO team_members (user_id, project_id) VALUES (?, ?)', [uid, pid]);
  const p = await one('SELECT project_name FROM projects WHERE project_id = ?', [pid]);
  await notify(uid, `You were added to project '${p.project_name}'`, 'projects');
  await logActivity(req.user, pid, 'added a member to the team');
  res.json({ message: 'Member added' });
}

// DELETE /api/projects/:id/members/:uid
export async function removeMember(req, res) {
  const pid = parseInt(req.params.id);
  const uid = parseInt(req.params.uid);
  await checkProject(req.user, pid);
  await run('DELETE FROM team_members WHERE project_id = ? AND user_id = ?', [pid, uid]);
  res.json({ message: 'Member removed' });
}

export default { listProjects, createProject, updateProject, deleteProject, listMembers, addMember, removeMember };
