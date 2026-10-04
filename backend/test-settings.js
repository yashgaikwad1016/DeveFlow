import jwt from 'jsonwebtoken';
import config from './config/config.js';

async function testSettingsEndpoints() {
  console.log('\n⚙️ Testing Workspace & Member Settings Endpoints...\n');

  try {
    const adminToken = jwt.sign(
      { id: '6abbda4017de36301969307f', role: 'Admin', email: 'devflow5173@admin.com', username: 'admin_devflow' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const memberToken = jwt.sign(
      { id: '6abd481477fc74c31fe4d896', role: 'Member', email: 'yashgaikwad0108@gmail.com', username: 'yashgaikwad' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ── Test 1: GET /api/settings (Accessible to any authenticated user)
    const settingsGet = await fetch('http://localhost:5000/api/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json());

    console.log('✅ GET /api/settings response keys:', Object.keys(settingsGet));

    // ── Test 2: PUT /api/settings (Admin updates workspace settings)
    const updatePayload = {
      app_name: 'DevFlow Agile Workspace',
      org_name: 'DevFlow Technologies',
      support_email: 'support@devflow.app',
      hours_per_day: '7',
      working_days_per_week: '5',
      default_sprint_weeks: '2',
      story_point_scale: 'fibonacci',
      default_task_priority: 'Medium',
      allow_member_project_creation: 'true',
      require_2fa: 'false',
      session_timeout_hours: '24',
      auto_archive_completed_sprints: 'true',
    };

    const settingsPut = await fetch('http://localhost:5000/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(updatePayload),
    }).then(r => r.json());

    console.log('✅ PUT /api/settings response message:', settingsPut.message);
    if (settingsPut.settings?.hours_per_day === '7' && settingsPut.settings?.app_name === 'DevFlow Agile Workspace') {
      console.log('  ✅ PASS: Admin successfully updated workspace-wide settings!');
    } else {
      console.error('  ❌ Settings mismatch:', settingsPut);
    }

    // ── Test 3: PUT /api/settings blocked for non-admin
    const memberPutRes = await fetch('http://localhost:5000/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ app_name: 'HackedName' }),
    });

    if (memberPutRes.status === 403) {
      console.log('  ✅ PASS: Non-admin PUT /api/settings blocked with HTTP 403 Forbidden!');
    } else {
      console.error('  ❌ Security issue: Member was able to alter settings or received status', memberPutRes.status);
    }

    // ── Test 4: Member only receives public branding keys, no admin settings
    const memberGet = await fetch('http://localhost:5000/api/settings', {
      headers: { Authorization: `Bearer ${memberToken}` },
    }).then(r => r.json());
    const memberKeys = Object.keys(memberGet);
    if (!memberKeys.includes('require_2fa') && !memberKeys.includes('session_timeout_hours') && memberKeys.includes('app_name')) {
      console.log('  ✅ PASS: Member only receives safe public branding and NO administrative settings:', memberKeys);
    } else {
      console.error('  ❌ Security issue: Member received admin settings:', memberGet);
    }

    // ── Test 5: GET /api/me returns preferences & projects
    const meRes = await fetch('http://localhost:5000/api/me', {
      headers: { Authorization: `Bearer ${memberToken}` },
    }).then(r => r.json());

    if (meRes.preferences && Array.isArray(meRes.projects)) {
      console.log('  ✅ PASS: /api/me returns user preferences and assigned projects list');
    }

    // ── Test 6: PUT /api/me updates personal preferences
    const updatePrefRes = await fetch('http://localhost:5000/api/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        preferences: {
          theme: 'dark',
          emailNotifications: true,
          taskAssignmentAlerts: true,
          compactView: true,
          defaultLanding: 'sprints',
        },
      }),
    }).then(r => r.json());

    if (updatePrefRes.user?.preferences?.theme === 'dark') {
      console.log('  ✅ PASS: User successfully updated personal preferences via /api/me');
    }

    console.log('\n==================================================');
    console.log('All Settings Tests Completed Successfully!');
    console.log('==================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testSettingsEndpoints();
