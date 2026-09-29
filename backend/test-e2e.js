const API = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function test() {
  console.log('--- DevFlow Full-Stack E2E Verification ---');

  // 1. Setup
  console.log('1. Setting up admin workspace...');
  try {
    const setup = await req('/setup', {
      method: 'POST',
      body: {
        org_name: 'DevFlow Technologies',
        name: 'Yash Admin',
        email: 'admin@devflow.local',
        password: 'Password123!',
      },
    });
    console.log('✅ Setup response:', setup);
  } catch (err) {
    console.log('Setup info (may already be set up):', err.data?.error || err.message);
  }

  // 2. Login
  console.log('2. Authenticating as admin...');
  const login = await req('/login', {
    method: 'POST',
    body: {
      email: 'admin@devflow.local',
      password: 'Password123!',
    },
  });
  const token = login.token;
  const user = login.user;
  console.log(`✅ Logged in as: ${user.name} (${user.role}), Token received.`);

  const authHeader = { Authorization: `Bearer ${token}` };

  // 3. Create Project
  console.log('3. Creating a new project...');
  const proj = await req('/projects', {
    method: 'POST',
    headers: authHeader,
    body: {
      project_name: 'DevFlow React 19 Modernization',
      description: 'Converting legacy Python/HTML stack to React, Node.js, Express, and MySQL',
      start_date: '2026-10-01',
      end_date: '2026-12-31',
    },
  });
  const projectId = proj.project_id;
  console.log(`✅ Project created with ID: ${projectId}`);

  // 4. Create Sprint
  console.log('4. Planning sprint...');
  const sprint = await req('/sprints', {
    method: 'POST',
    headers: authHeader,
    body: {
      project_id: projectId,
      sprint_name: 'Sprint 1 - Core Framework',
      goal: 'Architect MySQL pool, Express REST endpoints, and React component tree',
      start_date: '2026-10-01',
      end_date: '2026-10-15',
    },
  });
  const sprintId = sprint.sprint_id;
  console.log(`✅ Sprint planned with ID: ${sprintId}`);

  // 5. Create Tasks
  console.log('5. Creating tasks...');
  const t1 = await req('/tasks', {
    method: 'POST',
    headers: authHeader,
    body: {
      project_id: projectId,
      sprint_id: sprintId,
      title: 'Migrate MySQL schema & verify tables',
      description: 'Ensure users, projects, sprints, tasks, issues, and audit tables exist',
      priority: 'High',
      status: 'Completed',
      assigned_to: user.user_id,
      deadline: '2026-10-05',
      estimated_hours: 4,
      complexity: 3,
    },
  });
  console.log(`✅ Task 1 created (Completed, ID: ${t1.task_id})`);

  const t2 = await req('/tasks', {
    method: 'POST',
    headers: authHeader,
    body: {
      project_id: projectId,
      sprint_id: sprintId,
      title: 'Implement Interactive Kanban Board',
      description: 'Enable drag-and-drop status flow across Pending, In Progress, Completed, Blocked',
      priority: 'High',
      status: 'In Progress',
      assigned_to: user.user_id,
      deadline: '2026-10-12',
      estimated_hours: 8,
      complexity: 4,
    },
  });
  console.log(`✅ Task 2 created (In Progress, ID: ${t2.task_id})`);

  const t3 = await req('/tasks', {
    method: 'POST',
    headers: authHeader,
    body: {
      project_id: projectId,
      sprint_id: sprintId,
      title: 'AI Sprint Forecasting and Smart Priority',
      description: 'Calculates complexity, hours, and burn rate to forecast delivery date',
      priority: 'Medium',
      status: 'Pending',
      assigned_to: user.user_id,
      deadline: '2026-10-14',
      estimated_hours: 6,
      complexity: 4,
    },
  });
  console.log(`✅ Task 3 created (Pending, ID: ${t3.task_id})`);

  // 6. Test Task Comment
  console.log('6. Adding comment to Task 2...');
  await req(`/tasks/${t2.task_id}/comments`, {
    method: 'POST',
    headers: authHeader,
    body: {
      message: 'Kanban board drag-and-drop implemented with HTML5 drag events and optimistic UI updates.',
    },
  });
  console.log('✅ Comment posted successfully.');

  // 7. Verify Dashboard
  console.log('7. Verifying Dashboard metrics...');
  const dash = await req('/dashboard', { headers: authHeader });
  console.log(`✅ Dashboard KPI check: Total tasks: ${dash.total_tasks}, Active sprints: ${dash.sprints?.length}`);

  // 8. Test AI Insights
  console.log('8. Testing AI smart priority scoring...');
  const ai = await req(`/ai/priority?project_id=${projectId}`, { headers: authHeader });
  console.log(`✅ AI priority response:`, JSON.stringify(ai).slice(0, 100));

  // 9. Test Reports
  console.log('9. Testing Project & Sprint Analytics...');
  const projRep = await req(`/reports/project/${projectId}`, { headers: authHeader });
  console.log(`✅ Project Analytics response:`, JSON.stringify(projRep).slice(0, 100));

  console.log('\n🎉 ALL FULL-STACK API TESTS PASSED SUCCESSFULLY! 🎉\n');
}

test().catch(err => {
  console.error('❌ Test failed:', err.data || err.message);
  process.exit(1);
});
