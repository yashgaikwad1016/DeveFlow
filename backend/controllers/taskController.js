import path from 'path';
import fs from 'fs';
import { query, one, run, now } from '../config/db.js';
import { projectIds, inClause, checkProject, need, toInt, notify, logActivity } from '../utils/helpers.js';
import ai from '../services/ai.js';

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Blocked'];

const TASK_SQL = `SELECT t.*, u.name AS assignee, s.sprint_name, p.project_name
  FROM tasks t
  LEFT JOIN users u ON u.user_id = t.assigned_to
  LEFT JOIN sprints s ON s.sprint_id = t.sprint_id
  LEFT JOIN projects p ON p.project_id = t.project_id`;

async function getTask(user, taskId) {
  const t = await one(`${TASK_SQL} WHERE t.task_id = ?`, [taskId]);
  if (!t) { const err = new Error('Task not found'); err.statusCode = 404; throw err; }
  await checkProject(user, t.project_id);
  return t;
}

// GET /api/tasks
export async function listTasks(req, res) {
  const ids = await projectIds(req.user);
  const pin = inClause(ids);
  if (!ids.length) return res.json([]);
  const where = [`t.project_id IN ${pin}`];
  const params = [];
  if (req.query.project_id) { where.push('t.project_id = ?'); params.push(parseInt(req.query.project_id)); }
  if (req.query.sprint_id) { where.push('t.sprint_id = ?'); params.push(parseInt(req.query.sprint_id)); }
  if (req.query.mine === '1') {
    where.push('t.assigned_to = ?'); params.push(req.user.user_id || req.user.id);
  }
  const tasks = await query(
    `${TASK_SQL} WHERE ${where.join(' AND ')} ORDER BY t.deadline IS NULL, t.deadline`,
    params
  );
  res.json(tasks);
}

// GET /api/tasks/:id
export async function getTaskDetail(req, res) {
  const t = await getTask(req.user, parseInt(req.params.id));
  t.comments = await query(
    'SELECT c.*, u.name FROM comments c LEFT JOIN users u USING(user_id) WHERE task_id = ? ORDER BY c.comment_id',
    [t.task_id]
  );
  t.attachments = await query('SELECT * FROM attachments WHERE task_id = ? ORDER BY attachment_id DESC', [t.task_id]);
  t.issues = await query('SELECT * FROM issues WHERE task_id = ?', [t.task_id]);
  try {
    const { per, teamRatio } = await ai.history();
    t.ai = ai.scoreTask(t, per, teamRatio);
  } catch (e) {
    t.ai = { score: 0, recommended: t.priority, reasons: ['AI unavailable'] };
  }
  res.json(t);
}

// POST /api/tasks
export async function createTask(req, res) {
  const b = req.body;
  need(b, 'project_id', 'title');
  await checkProject(req.user, b.project_id);
  const taskData = {
    deadline: b.deadline || null,
    estimated_hours: parseFloat(b.estimated_hours || 4),
    complexity: Math.max(1, Math.min(5, parseInt(b.complexity || 3))),
    assigned_to: toInt(b.assigned_to),
    status: b.status || 'Pending',
  };
  let priority = b.priority || 'Medium';
  if (priority === 'AI') {
    try { priority = await ai.recommendPriority(taskData); }
    catch (e) { priority = 'Medium'; }
  }
  const result = await run(
    `INSERT INTO tasks (sprint_id, project_id, title, description, priority, status, assigned_to, deadline, estimated_hours, complexity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [toInt(b.sprint_id), parseInt(b.project_id), b.title.trim(), b.description || '', priority,
     taskData.status, taskData.assigned_to, taskData.deadline, taskData.estimated_hours, taskData.complexity, now()]
  );
  const tid = result.insertId;
  const currentUid = req.user.user_id || req.user.id;
  if (taskData.assigned_to && taskData.assigned_to !== currentUid) {
    await notify(taskData.assigned_to, `📋 New task assigned: '${b.title}'`, `task/${tid}`);
  }
  await logActivity(req.user, parseInt(b.project_id), `created task '${b.title}' (${priority} priority)`);
  res.json({ message: `Task created with ${priority} priority`, task_id: tid });
}

// PUT /api/tasks/:id
export async function updateTask(req, res) {
  const tid = parseInt(req.params.id);
  const t = await getTask(req.user, tid);
  let b = req.body;
  if ('status' in b) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
    if (b.status !== t.status) {
      await run(
        'UPDATE tasks SET completed_at = ? WHERE task_id = ?',
        [b.status === 'Completed' ? now() : null, tid]
      );
      await logActivity(req.user, t.project_id, `moved '${t.title}' to ${b.status}`);
      const mgr = await one('SELECT manager_id FROM projects WHERE project_id = ?', [t.project_id]);
      const currentUid = req.user.user_id || req.user.id;
      if (mgr && mgr.manager_id !== currentUid) {
        await notify(mgr.manager_id, `${req.user.name || req.user.username} moved '${t.title}' to ${b.status}`, `task/${tid}`);
      }
    }
  }
  const updatable = ['title', 'description', 'priority', 'status', 'assigned_to', 'deadline', 'estimated_hours', 'complexity', 'sprint_id'];
  for (const f of updatable) {
    if (f in b) {
      const val = String(b[f] ?? '').trim() === '' ? null : b[f];
      await run(`UPDATE tasks SET ${f} = ? WHERE task_id = ?`, [val, tid]);
    }
  }
  res.json({ message: 'Task updated' });
}

// DELETE /api/tasks/:id
export async function deleteTask(req, res) {
  const tid = parseInt(req.params.id);
  const t = await getTask(req.user, tid);
  await run('DELETE FROM tasks WHERE task_id = ?', [tid]);
  await logActivity(req.user, t.project_id, `deleted task '${t.title}'`);
  res.json({ message: 'Task deleted' });
}

// POST /api/tasks/:id/comments
export async function addComment(req, res) {
  const tid = parseInt(req.params.id);
  const t = await getTask(req.user, tid);
  need(req.body, 'message');
  const currentUid = req.user.user_id || req.user.id;
  await run(
    'INSERT INTO comments (task_id, user_id, message, created_at) VALUES (?, ?, ?, ?)',
    [tid, currentUid, req.body.message.trim(), now()]
  );
  const link = `task/${tid}`;
  if (t.assigned_to && t.assigned_to !== currentUid) {
    await notify(t.assigned_to, `💬 ${req.user.name || req.user.username} commented on '${t.title}'`, link);
  }
  await logActivity(req.user, t.project_id, `commented on '${t.title}'`);
  res.json({ message: 'Comment added' });
}

// POST /api/tasks/:id/attachments
export async function addAttachment(req, res) {
  const tid = parseInt(req.params.id);
  const t = await getTask(req.user, tid);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = `/uploads/${req.file.filename}`;
  const currentUid = req.user.user_id || req.user.id;
  await run(
    'INSERT INTO attachments (task_id, file_path, file_name, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?)',
    [tid, filePath, req.file.originalname, currentUid, now()]
  );
  await logActivity(req.user, t.project_id, `attached '${req.file.originalname}' to '${t.title}'`);
  res.json({ message: 'File uploaded', file_path: filePath });
}

export default { listTasks, getTaskDetail, createTask, updateTask, deleteTask, addComment, addAttachment };
