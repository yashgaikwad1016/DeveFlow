import { query, run } from '../config/db.js';
import { projectIds, inClause, checkProject } from '../utils/helpers.js';
import ai from '../services/ai.js';

const TASK_SQL = `SELECT t.*, u.name AS assignee, s.sprint_name, p.project_name
  FROM tasks t
  LEFT JOIN users u ON u.user_id = t.assigned_to
  LEFT JOIN sprints s ON s.sprint_id = t.sprint_id
  LEFT JOIN projects p ON p.project_id = t.project_id`;

async function openTasks(user, queryParams) {
  const ids = await projectIds(user);
  let filtered = ids;
  if (queryParams.project_id) filtered = ids.filter(i => i === parseInt(queryParams.project_id));
  const pin = inClause(filtered);
  if (!filtered.length) return [];
  const params = [];
  let where = `t.status != 'Completed' AND t.project_id IN ${pin}`;
  if (user.role === 'Member') {
    where += ' AND t.assigned_to = ?';
    params.push(user.user_id || user.id);
  }
  return query(`${TASK_SQL} WHERE ${where}`, params);
}

// GET /api/ai/priority
async function aiPriority(req, res) {
  const tasks = await openTasks(req.user, req.query);
  const result = await ai.priorityReport(tasks);
  const formatted = result.map(t => ({
    ...t,
    ai_score: t.score,
    ai_priority: t.recommended,
    rationale: t.reasons,
  }));
  res.json({ tasks: formatted, total: formatted.length });
}

// GET /api/ai/predict
async function aiPredict(req, res) {
  const tasks = await openTasks(req.user, req.query);
  const result = await ai.predict(tasks);
  
  // Also load sprints for forecasting if project_id is given
  let sprints = [];
  if (req.query.project_id) {
    const sps = await query(
      'SELECT s.*, p.project_name FROM sprints s JOIN projects p ON p.project_id = s.project_id WHERE s.project_id = ?',
      [parseInt(req.query.project_id)]
    );
    sprints = sps.map(s => {
      const sTasks = tasks.filter(t => t.sprint_id === s.sprint_id);
      const atRiskCount = sTasks.filter(t => {
        const found = result.tasks?.find(rt => rt.task_id === t.task_id);
        return found?.at_risk;
      }).length;
      const risk = atRiskCount > 1 ? 'High' : atRiskCount === 1 ? 'Medium' : 'On Track';
      return {
        ...s,
        total_tasks: sTasks.length,
        risk_level: risk,
        confidence: risk === 'High' ? 62 : risk === 'Medium' ? 78 : 92,
        predicted_end_date: result.project_finish || s.end_date,
        velocity: 6.5,
      };
    });
  }

  res.json({ ...result, sprints });
}

// GET /api/ai/performance
async function aiPerformance(req, res) {
  let projectId = null;
  if (req.query.project_id) {
    await checkProject(req.user, req.query.project_id);
    projectId = parseInt(req.query.project_id);
  } else if (req.user.role !== 'Admin') {
    const ids = await projectIds(req.user);
    if (ids.length === 1) projectId = ids[0];
  }
  const result = await ai.performance(projectId);
  const memberList = Array.isArray(result) ? result : (result.members || []);
  
  // Format members for UI
  const members = memberList.map(m => ({
    user_id: m.user_id,
    name: m.name,
    email: m.email || '',
    designation: m.designation || '',
    active_tasks: m.active_tasks || (m.n - (m.done || 0)) || 0,
    total_hours: m.total_hours || Math.round((m.hours || []).reduce((a, b) => a + b, 0)) || 0,
    completed_tasks: m.completed_tasks || m.done || 0,
    overloaded: (m.active_tasks > 4) || (m.speed_ratio > 1.4),
  }));

  res.json({ members, raw: result });
}

// POST /api/ai/apply/:id
async function aiApply(req, res) {
  const tid = parseInt(req.params.id);
  const task = await query(
    `SELECT t.*, u.name AS assignee FROM tasks t LEFT JOIN users u ON u.user_id = t.assigned_to WHERE t.task_id = ?`,
    [tid]
  );
  if (!task.length) return res.status(404).json({ error: 'Task not found' });
  await checkProject(req.user, task[0].project_id);
  const { per, teamRatio } = await ai.history();
  const scored = ai.scoreTask(task[0], per, teamRatio);
  await run('UPDATE tasks SET priority = ? WHERE task_id = ?', [scored.recommended, tid]);
  res.json({ message: `Priority set to ${scored.recommended}` });
}

export { aiPriority, aiPredict, aiPerformance, aiApply };
export default { aiPriority, aiPredict, aiPerformance, aiApply };
