import { query, one, run, now } from '../config/db.js';
import { projectIds, inClause } from '../utils/helpers.js';

// GET /api/notifications
export async function listNotifications(req, res) {
  const currentUid = req.user.user_id || req.user.id;
  const notes = await query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_id DESC LIMIT 40',
    [currentUid]
  );
  res.json(notes);
}

// PUT /api/notifications/read
export async function markAllRead(req, res) {
  const currentUid = req.user.user_id || req.user.id;
  await run("UPDATE notifications SET status = 'Read' WHERE user_id = ?", [currentUid]);
  res.json({ message: 'ok' });
}

// GET /api/activity[?project_id=]
export async function listActivity(req, res) {
  const ids = await projectIds(req.user);
  let filtered = ids;
  if (req.query.project_id) filtered = ids.filter(i => i === parseInt(req.query.project_id));
  const pin = inClause(filtered);
  if (!filtered.length) return res.json([]);
  const activity = await query(
    `SELECT a.*, us.name, p.project_name
     FROM activity a
     LEFT JOIN users us USING(user_id)
     LEFT JOIN projects p USING(project_id)
     WHERE a.project_id IN ${pin}
     ORDER BY a.activity_id DESC LIMIT 100`
  );
  res.json(activity);
}

export default { listNotifications, markAllRead, listActivity };
