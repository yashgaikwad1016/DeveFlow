import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { settingsService, authService, healthService, reportService } from '../services';
import { useToast } from '../components/Overlays';
import { LoadingSpinner, Badge } from '../components/UI';
import Icon from '../components/Icon';

export default function SettingsPage() {
  const { user, isAdmin, isMgr, setOrg, updateUser } = useAuth();
  const toast = useToast();

  // Active tab: Admins start on workspace, non-admins are restricted to member panel
  const [activeTab, setActiveTab] = useState(isAdmin() ? 'workspace' : 'member');

  useEffect(() => {
    if (!isAdmin() && activeTab !== 'member') {
      setActiveTab('member');
    }
  }, [user, activeTab]);

  // ── Workspace Settings State (Admin) ─────────────────────────────────────────
  const [workspaceSettings, setWorkspaceSettings] = useState({
    app_name: 'DevFlow',
    org_name: '',
    support_email: '',
    hours_per_day: '6',
    working_days_per_week: '5',
    default_sprint_weeks: '2',
    story_point_scale: 'fibonacci',
    default_task_priority: 'Medium',
    allow_member_project_creation: 'false',
    require_2fa: 'false',
    session_timeout_hours: '24',
    auto_archive_completed_sprints: 'true',
  });

  // ── Member Preferences State ────────────────────────────────────────────────
  const [memberPrefs, setMemberPrefs] = useState({
    theme: localStorage.getItem('df_theme') || 'light',
    compactView: false,
    defaultLanding: 'dashboard',
    emailNotifications: true,
    taskAssignmentAlerts: true,
    dailyDigest: false,
    focusHoursGoal: '6',
  });

  // ── Member Profile & Project Memberships ────────────────────────────────────
  const [profileData, setProfileData] = useState(null);

  // ── Password Change State ───────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // ── Telemetry Health State ──────────────────────────────────────────────────
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // ── General Loading / Saving States ─────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [exportingAudit, setExportingAudit] = useState(false);

  // Fetch initial data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, profileRes] = await Promise.all([
        settingsService.get().catch(() => ({})),
        authService.getMe().catch(() => null),
      ]);

      if (settingsRes) {
        setWorkspaceSettings(prev => ({
          ...prev,
          app_name: settingsRes.app_name || 'DevFlow',
          org_name: settingsRes.org_name || '',
          support_email: settingsRes.support_email || '',
          hours_per_day: String(settingsRes.hours_per_day || '6'),
          working_days_per_week: String(settingsRes.working_days_per_week || '5'),
          default_sprint_weeks: String(settingsRes.default_sprint_weeks || '2'),
          story_point_scale: settingsRes.story_point_scale || 'fibonacci',
          default_task_priority: settingsRes.default_task_priority || 'Medium',
          allow_member_project_creation: String(settingsRes.allow_member_project_creation || 'false'),
          require_2fa: String(settingsRes.require_2fa || 'false'),
          session_timeout_hours: String(settingsRes.session_timeout_hours || '24'),
          auto_archive_completed_sprints: String(settingsRes.auto_archive_completed_sprints || 'true'),
        }));
      }

      if (profileRes) {
        setProfileData(profileRes);
        if (profileRes.preferences) {
          setMemberPrefs(prev => ({
            ...prev,
            ...profileRes.preferences,
            theme: localStorage.getItem('df_theme') || profileRes.preferences.theme || 'light',
          }));
        }
      }
    } catch (err) {
      toast(err.message || 'Error loading settings', 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Load telemetry when switching to workspace tab
  const fetchHealthTelemetry = async () => {
    setHealthLoading(true);
    try {
      const res = await healthService.check();
      setHealthData(res);
    } catch (err) {
      // Degraded/unhealthy state still returns body
      if (err.response?.data) {
        setHealthData(err.response.data);
      } else {
        toast('Failed to query system health', 'err');
      }
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'workspace' && isAdmin()) {
      fetchHealthTelemetry();
    }
  }, [activeTab]);

  // Handle Workspace Settings Submit (Admin)
  const handleWorkspaceSubmit = async e => {
    e.preventDefault();
    if (!isAdmin()) {
      toast('Administrator privileges required to change workspace configuration', 'err');
      return;
    }
    setSavingWorkspace(true);
    try {
      await settingsService.update(workspaceSettings);
      setOrg(workspaceSettings.org_name);
      toast('Workspace configuration updated successfully');
    } catch (err) {
      toast(err.message || 'Failed to update workspace settings', 'err');
    } finally {
      setSavingWorkspace(false);
    }
  };

  // Handle Member Preferences Submit
  const handlePrefsSubmit = async e => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      await authService.updateMe({ preferences: memberPrefs });
      updateUser({ preferences: memberPrefs });

      // Apply theme changes globally
      if (memberPrefs.theme) {
        document.documentElement.dataset.theme = memberPrefs.theme;
        localStorage.setItem('df_theme', memberPrefs.theme);
      }

      toast('Personal preferences updated successfully');
    } catch (err) {
      toast(err.message || 'Failed to update preferences', 'err');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Handle Quick Theme Switch
  const handleThemeChange = (newTheme) => {
    setMemberPrefs(prev => ({ ...prev, theme: newTheme }));
    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem('df_theme', newTheme);
  };

  // Handle In-Panel Password Change
  const handlePasswordSubmit = async e => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast('New passwords do not match', 'err');
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast('Password must be at least 8 characters long', 'err');
      return;
    }

    setPwSubmitting(true);
    try {
      await authService.updateMe({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      toast('Password updated successfully');
    } catch (err) {
      toast(err.response?.data?.error || err.message || 'Failed to update password', 'err');
    } finally {
      setPwSubmitting(false);
    }
  };

  // Export Financial CSV (Admin only)
  const handleExportFinancialLogs = async () => {
    try {
      setExportingAudit(true);
      await reportService.exportPaymentsCsv();
      toast('Financial payment logs downloaded successfully');
    } catch (err) {
      toast(err.message || 'Failed to export logs', 'err');
    } finally {
      setExportingAudit(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1>{isAdmin() ? 'Settings & Preferences' : 'Workspace Preferences'}</h1>
            <Badge value={isAdmin() ? 'Admin Workspace' : isMgr() ? 'Manager Access' : 'Team Member'} />
          </div>
          <p>
            {isAdmin()
              ? 'Manage global agile workspace rules, system administration, and personal preferences.'
              : 'Manage your personal interface, theme, notifications, and workspace profile.'}
          </p>
        </div>

        {/* Tab Switcher - Only visible to Workspace Administrators */}
        {isAdmin() && (
          <div className="seg">
            <button
              type="button"
              className={activeTab === 'workspace' ? 'on' : ''}
              onClick={() => setActiveTab('workspace')}
            >
              <Icon name="settings" /> Workspace Admin
            </button>
            <button
              type="button"
              className={activeTab === 'member' ? 'on' : ''}
              onClick={() => setActiveTab('member')}
            >
              <Icon name="user" /> My Preferences
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ── TAB 1: WORKSPACE ADMIN PANEL (ADMINS ONLY) ─────────────────────────── */}
      {/* ========================================================================= */}
      {isAdmin() && activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Form */}
          <form onSubmit={handleWorkspaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Section 1: Organization Identity & Branding */}
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ color: 'var(--primary)', fontSize: 18 }}><Icon name="folder" /></span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Workspace Identity & Branding</h3>
              </div>

              <div className="form-grid">
                <div>
                  <label>Application / Workspace Name *</label>
                  <input
                    value={workspaceSettings.app_name}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, app_name: e.target.value }))}
                    disabled={!isAdmin()}
                    required
                    placeholder="DevFlow"
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Displayed on the top header, notification emails, and browser tab.</small>
                </div>

                <div>
                  <label>Organization / Team Name</label>
                  <input
                    value={workspaceSettings.org_name}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, org_name: e.target.value }))}
                    disabled={!isAdmin()}
                    placeholder="e.g. Acme Innovations Corp"
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Appears on official receipts, project invitations, and export files.</small>
                </div>

                <div className="full">
                  <label>Support & Escalation Email</label>
                  <input
                    type="email"
                    value={workspaceSettings.support_email}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, support_email: e.target.value }))}
                    disabled={!isAdmin()}
                    placeholder="support@company.com"
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Contact address provided on payment receipts and error pages.</small>
                </div>
              </div>
            </div>

            {/* Section 2: Agile Velocity & Working Hours */}
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ color: '#10b981', fontSize: 18 }}><Icon name="zap" /></span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Agile Methodology & Working Hours</h3>
              </div>

              <div className="form-grid">
                <div>
                  <label>Working Hours Per Day (Velocity Metric)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={workspaceSettings.hours_per_day}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, hours_per_day: e.target.value }))}
                    disabled={!isAdmin()}
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Used to calculate sprint burndown, member capacity, and velocity reports.</small>
                </div>

                <div>
                  <label>Working Days Per Week</label>
                  <select
                    value={workspaceSettings.working_days_per_week}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, working_days_per_week: e.target.value }))}
                    disabled={!isAdmin()}
                  >
                    <option value="5">5 Days (Monday – Friday)</option>
                    <option value="6">6 Days (Monday – Saturday)</option>
                    <option value="7">7 Days (Full Week)</option>
                  </select>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Determines working day capacity across active sprints.</small>
                </div>

                <div>
                  <label>Default Sprint Duration</label>
                  <select
                    value={workspaceSettings.default_sprint_weeks}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, default_sprint_weeks: e.target.value }))}
                    disabled={!isAdmin()}
                  >
                    <option value="1">1 Week Sprint</option>
                    <option value="2">2 Weeks Sprint (Industry Standard)</option>
                    <option value="3">3 Weeks Sprint</option>
                    <option value="4">4 Weeks Sprint</option>
                  </select>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Pre-populates dates when creating new agile sprint cycles.</small>
                </div>

                <div>
                  <label>Story Point Scale</label>
                  <select
                    value={workspaceSettings.story_point_scale}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, story_point_scale: e.target.value }))}
                    disabled={!isAdmin()}
                  >
                    <option value="fibonacci">Fibonacci Scale (1, 2, 3, 5, 8, 13, 21)</option>
                    <option value="linear">Linear Scale (1, 2, 3, 4, 5)</option>
                    <option value="tshirt">T-Shirt Sizing (XS, S, M, L, XL)</option>
                  </select>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Estimation method for task complexity and sprint planning.</small>
                </div>

                <div className="full">
                  <label>Default Task Priority</label>
                  <select
                    value={workspaceSettings.default_task_priority}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, default_task_priority: e.target.value }))}
                    disabled={!isAdmin()}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium (Recommended)</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Initial priority assigned when tasks are logged without explicit priority.</small>
                </div>
              </div>
            </div>

            {/* Section 3: Workspace Policies & Security */}
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ color: '#f59e0b', fontSize: 18 }}><Icon name="shield" /></span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Security, Permissions & Automation Policies</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Policy Toggle 1 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>Member Project Creation</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                      Allow regular team members to initiate new projects. If disabled, only Admins and Managers can create projects.
                    </p>
                  </div>
                  <select
                    value={workspaceSettings.allow_member_project_creation}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, allow_member_project_creation: e.target.value }))}
                    disabled={!isAdmin()}
                    style={{ width: 140 }}
                  >
                    <option value="true">Allowed</option>
                    <option value="false">Admins & PMs</option>
                  </select>
                </div>

                {/* Policy Toggle 2 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>Two-Factor Authentication (2FA)</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                      Mandate multi-factor email verification OTP on every member login.
                    </p>
                  </div>
                  <select
                    value={workspaceSettings.require_2fa}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, require_2fa: e.target.value }))}
                    disabled={!isAdmin()}
                    style={{ width: 140 }}
                  >
                    <option value="true">Enforced</option>
                    <option value="false">Optional</option>
                  </select>
                </div>

                {/* Policy Option 3 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>Session Inactivity Timeout</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                      Maximum active duration before users are required to re-authenticate.
                    </p>
                  </div>
                  <select
                    value={workspaceSettings.session_timeout_hours}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, session_timeout_hours: e.target.value }))}
                    disabled={!isAdmin()}
                    style={{ width: 140 }}
                  >
                    <option value="8">8 Hours</option>
                    <option value="24">24 Hours (Standard)</option>
                    <option value="168">7 Days</option>
                    <option value="720">30 Days</option>
                  </select>
                </div>

                {/* Policy Option 4 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>Sprint Lifecycle Automation</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                      Automatically transition expired active subscriptions and archive finished sprint boards.
                    </p>
                  </div>
                  <select
                    value={workspaceSettings.auto_archive_completed_sprints}
                    onChange={e => setWorkspaceSettings(prev => ({ ...prev, auto_archive_completed_sprints: e.target.value }))}
                    disabled={!isAdmin()}
                    style={{ width: 140 }}
                  >
                    <option value="true">Automated</option>
                    <option value="false">Manual</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button (Admin) */}
            {isAdmin() && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="submit" className="btn primary" disabled={savingWorkspace} style={{ padding: '12px 28px', fontSize: 15 }}>
                  <Icon name="check" /> {savingWorkspace ? 'Saving Workspace Changes...' : 'Save Workspace Settings'}
                </button>
              </div>
            )}
          </form>

          {/* Section 4: Live Telemetry & System Diagnostics (Admin Only) */}
          {isAdmin() && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#3b82f6', fontSize: 18 }}><Icon name="activity" /></span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Production Health & Telemetry</h3>
                </div>
                <button
                  type="button"
                  className="btn sm"
                  onClick={fetchHealthTelemetry}
                  disabled={healthLoading}
                >
                  <Icon name="zap" /> {healthLoading ? 'Testing...' : 'Run Diagnostics'}
                </button>
              </div>

              {healthData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>MySQL Database</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: healthData.dependencies?.mysql?.status === 'up' ? '#10b981' : '#ef4444' }}>
                      {healthData.dependencies?.mysql?.status === 'up' ? 'Online' : 'Degraded'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Latency: {healthData.dependencies?.mysql?.latencyMs ?? 0}ms</div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>MongoDB Atlas (Auth)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: healthData.dependencies?.mongodb?.status === 'up' ? '#10b981' : '#ef4444' }}>
                      {healthData.dependencies?.mongodb?.status === 'up' ? 'Connected' : 'Disconnected'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>State: {healthData.dependencies?.mongodb?.state || 'ready'}</div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Razorpay Gateway</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                      {healthData.dependencies?.razorpay?.status === 'ready' ? 'Configured' : 'Inactive'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Currency: {healthData.dependencies?.razorpay?.currency || 'INR'}</div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Uptime & Runtime</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                      {healthData.uptime || 'Active'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Node {healthData.system?.nodeVersion} · RAM {healthData.system?.memory?.rssMB}MB</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Click "Run Diagnostics" to inspect real-time system and database health.
                </div>
              )}
            </div>
          )}

          {/* Section 5: Administrative Shortcuts */}
          {isAdmin() && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Administrative Shortcuts</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleExportFinancialLogs}
                  disabled={exportingAudit}
                >
                  <Icon name="download" /> {exportingAudit ? 'Exporting...' : 'Export Financial Audit Logs (CSV)'}
                </button>
                <Link to="/users" className="btn">
                  <Icon name="users" /> Manage Workspace Users
                </Link>
                <Link to="/billing" className="btn">
                  <Icon name="creditCard" /> Manage Plans & Subscriptions
                </Link>
                <Link to="/admin/payments" className="btn">
                  <Icon name="dollar" /> View Payment Transactions
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ── TAB 2: MEMBER PREFERENCES & WORKSPACE PANEL ────────────────────────── */}
      {(!isAdmin() || activeTab === 'member') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section 1: My Workspace Membership Overview */}
          <div className="card" style={{ padding: 24, borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Active Workspace Membership
                </span>
                <h2 style={{ margin: '4px 0 8px', fontSize: 22, fontWeight: 700 }}>
                  {workspaceSettings.org_name || workspaceSettings.app_name || 'DevFlow Workspace'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge value={profileData?.role || user?.role || 'Member'} />
                  {profileData?.verified && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ Verified Account</span>}
                  {profileData?.created_at && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Joined {new Date(profileData.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {profileData?.projects && profileData.projects.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned Projects</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, justifyContent: 'flex-end' }}>
                    {profileData.projects.map(p => (
                      <Link
                        key={p.project_id}
                        to="/projects"
                        style={{
                          textDecoration: 'none',
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                        }}
                      >
                        {p.project_name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Appearance & Theme Mode */}
          <div className="card" style={{ padding: 24, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ color: 'var(--primary)', fontSize: 18 }}><Icon name="sun" /></span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Appearance & Display Experience</h3>
            </div>

            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
              Customize your DevFlow theme and interface density according to your lighting environment.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
              {/* Light Mode */}
              <div
                onClick={() => handleThemeChange('light')}
                style={{
                  padding: 18,
                  borderRadius: 12,
                  border: memberPrefs.theme === 'light' ? '2px solid #4f46e5' : '1px solid var(--border)',
                  background: memberPrefs.theme === 'light' ? 'rgba(79, 70, 229, 0.08)' : 'var(--surface-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>☀️</div>
                <strong style={{ fontSize: 14, display: 'block', color: 'var(--text)' }}>Light Mode</strong>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>Clean crisp daytime contrast</small>
              </div>

              {/* Dark Mode */}
              <div
                onClick={() => handleThemeChange('dark')}
                style={{
                  padding: 18,
                  borderRadius: 12,
                  border: memberPrefs.theme === 'dark' ? '2px solid #818cf8' : '1px solid var(--border)',
                  background: memberPrefs.theme === 'dark' ? 'rgba(129, 140, 248, 0.12)' : 'var(--surface-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>🌙</div>
                <strong style={{ fontSize: 14, display: 'block', color: 'var(--text)' }}>Dark Mode</strong>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>Deep obsidian night theme</small>
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label>Default Workspace Landing View</label>
                <select
                  value={memberPrefs.defaultLanding}
                  onChange={e => setMemberPrefs(prev => ({ ...prev, defaultLanding: e.target.value }))}
                >
                  <option value="dashboard">Overview Dashboard (/dashboard)</option>
                  <option value="projects">Projects Overview (/projects)</option>
                  <option value="sprints">Active Sprint Board (/sprints)</option>
                  <option value="issues">Issue Tracker (/issues)</option>
                </select>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>Page displayed immediately after login.</small>
              </div>

              <div>
                <label>Table & Card Density</label>
                <select
                  value={String(memberPrefs.compactView)}
                  onChange={e => setMemberPrefs(prev => ({ ...prev, compactView: e.target.value === 'true' }))}
                >
                  <option value="false">Standard Density (Spacious)</option>
                  <option value="true">Compact Density (Dense Rows)</option>
                </select>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>Controls padding and row height across backlog and task tables.</small>
              </div>
            </div>
          </div>

          {/* Section 3: Notification & Communication Preferences */}
          <div className="card" style={{ padding: 24, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ color: '#8b5cf6', fontSize: 18 }}><Icon name="bell" /></span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Notifications & Team Alerts</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Task Assignment Emails</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    Receive immediate email alerts when teammates assign you tasks or issues.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={memberPrefs.taskAssignmentAlerts}
                  onChange={e => setMemberPrefs(prev => ({ ...prev, taskAssignmentAlerts: e.target.checked }))}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Sprint Milestones & Updates</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    Receive notification pings when sprint cycles start, end, or reach burndown goals.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={memberPrefs.emailNotifications}
                  onChange={e => setMemberPrefs(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Daily Activity Digest</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    Summary email of all workspace progress, closed bugs, and upcoming deadlines.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={memberPrefs.dailyDigest}
                  onChange={e => setMemberPrefs(prev => ({ ...prev, dailyDigest: e.target.checked }))}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Save Button for Preferences */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn primary"
                disabled={savingPrefs}
                onClick={handlePrefsSubmit}
                style={{ padding: '10px 24px' }}
              >
                <Icon name="check" /> {savingPrefs ? 'Saving Preferences...' : 'Save Preferences'}
              </button>
            </div>
          </div>

          {/* Section 4: In-Panel Password & Security Management */}
          <div className="card" style={{ padding: 24, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ color: '#ef4444', fontSize: 18 }}><Icon name="key" /></span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Security & Password Management</h3>
            </div>

            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
              Change your password securely. New passwords must be at least 8 characters long and cannot reuse any of your last 5 passwords.
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-grid">
                <div>
                  <label>Current Password *</label>
                  <input
                    type="password"
                    value={pwForm.current_password}
                    onChange={e => setPwForm(prev => ({ ...prev, current_password: e.target.value }))}
                    required
                    placeholder="••••••••••••"
                  />
                </div>

                <div>
                  <label>New Password * (Min 8 chars)</label>
                  <input
                    type="password"
                    value={pwForm.new_password}
                    onChange={e => setPwForm(prev => ({ ...prev, new_password: e.target.value }))}
                    required
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="full">
                  <label>Confirm New Password *</label>
                  <input
                    type="password"
                    value={pwForm.confirm_password}
                    onChange={e => setPwForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                    required
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn"
                  disabled={pwSubmitting || !pwForm.current_password || !pwForm.new_password}
                  style={{ padding: '10px 24px' }}
                >
                  <Icon name="lock" /> {pwSubmitting ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
