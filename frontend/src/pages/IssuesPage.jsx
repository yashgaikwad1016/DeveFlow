import { useState, useEffect, useCallback } from 'react';
import { issueService, projectService, taskService, userService } from '../services';
import { useModal, useConfirm, useToast } from '../components/Overlays';
import { Badge, Person, Empty, LoadingSpinner } from '../components/UI';
import Icon from '../components/Icon';
import { ago } from '../utils/helpers';

export default function IssuesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { openModal, closeModal } = useModal();

  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);

  // Filters
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (projectFilter) params.project_id = projectFilter;
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;

      const [iss, pr, us] = await Promise.all([
        issueService.list(params),
        projectService.list(),
        userService.list().catch(() => [])
      ]);
      setIssues(iss);
      setProjects(pr);
      setTeamUsers(us);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, statusFilter, severityFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Issue Form Modal (Create or Edit)
  const openIssueModal = (issue = null) => {
    const isEdit = Boolean(issue?.issue_id);
    const initial = {
      project_id: issue?.project_id || (projectFilter ? Number(projectFilter) : (projects[0]?.project_id || '')),
      task_id: issue?.task_id || '',
      title: issue?.title || '',
      description: issue?.description || '',
      severity: issue?.severity || 'Medium',
      status: issue?.status || 'Open',
      assigned_to: issue?.assigned_to || '',
    };

    function IssueForm() {
      const [form, setForm] = useState(initial);
      const [projectTasks, setProjectTasks] = useState([]);
      const [file, setFile] = useState(null);
      const [submitting, setSubmitting] = useState(false);

      useEffect(() => {
        if (form.project_id) {
          taskService.list({ project_id: form.project_id }).then(setProjectTasks).catch(() => {});
        }
      }, [form.project_id]);

      const handleChange = e => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
      };

      const handleSubmit = async e => {
        e.preventDefault();
        setSubmitting(true);
        try {
          const formData = new FormData();
          Object.keys(form).forEach(key => {
            if (form[key] !== null && form[key] !== undefined) {
              formData.append(key, form[key]);
            }
          });
          if (file) {
            formData.append('screenshot', file);
          }

          if (isEdit) {
            await issueService.update(issue.issue_id, form);
            toast('Issue updated successfully');
          } else {
            await issueService.create(formData);
            toast('Issue reported successfully');
          }
          closeModal();
          loadData();
        } catch (err) {
          toast(err.message, 'err');
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <form onSubmit={handleSubmit}>
          <h2>{isEdit ? 'Edit issue' : 'Report an issue / bug'}</h2>
          <p className="lead">{isEdit ? 'Update issue details and assignment' : 'Log a defect, blocker, or task impediment.'}</p>
          <div className="form-grid">
            <div className="full">
              <label>Issue title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="e.g. Broken navigation in mobile view"
              />
            </div>
            <div className="full">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Steps to reproduce, expected vs actual behavior..."
              />
            </div>
            <div>
              <label>Project *</label>
              <select name="project_id" value={form.project_id} onChange={handleChange} required>
                {projects.map(p => (
                  <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Associated Task</label>
              <select name="task_id" value={form.task_id || ''} onChange={handleChange}>
                <option value="">(None / General Project Issue)</option>
                {projectTasks.map(t => (
                  <option key={t.task_id} value={t.task_id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Severity</label>
              <select name="severity" value={form.severity} onChange={handleChange}>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label>Assign To</label>
              <select name="assigned_to" value={form.assigned_to || ''} onChange={handleChange}>
                <option value="">Unassigned</option>
                {teamUsers.filter(u => u.active).map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.name} ({u.designation || u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label>Screenshot / Attachment</label>
              <input type="file" onChange={e => setFile(e.target.files[0])} accept="image/*" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Submit Issue'}
            </button>
          </div>
        </form>
      );
    }

    openModal(<IssueForm />);
  };

  // Quick Status Update
  const handleQuickStatus = async (issueId, newStatus) => {
    try {
      await issueService.update(issueId, { status: newStatus });
      toast(`Issue marked as ${newStatus}`);
      loadData();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  // Delete Issue
  const handleDelete = async (issue) => {
    const ok = await confirm('Delete issue?', `"${issue.title}" will be permanently deleted.`);
    if (!ok) return;

    try {
      await issueService.delete(issue.issue_id);
      toast('Issue deleted');
      loadData();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Issues & Defects</h1>
          <p>{issues.length} issue{issues.length === 1 ? '' : 's'} tracked across your projects</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => openIssueModal()}>
            <Icon name="plus" /> Report issue
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
          ))}
        </select>

        <div className="seg">
          {['', 'Open', 'In Progress', 'Resolved', 'Closed'].map(st => (
            <button
              key={st}
              className={statusFilter === st ? 'on' : ''}
              onClick={() => setStatusFilter(st)}
            >
              {st || 'All'}
            </button>
          ))}
        </div>

        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
          <option value="">All severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Issues Table */}
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Project / Task</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Reported by</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length > 0 ? (
                issues.map(iss => (
                  <tr key={iss.issue_id}>
                    <td>
                      <b>{iss.title}</b>
                      {iss.description && <div className="sub">{iss.description.slice(0, 70)}...</div>}
                    </td>
                    <td>
                      <div>{iss.project_name}</div>
                      {iss.task_title && <div className="sub">Task: {iss.task_title}</div>}
                    </td>
                    <td><Badge value={iss.severity} /></td>
                    <td>
                      <select
                        value={iss.status}
                        onChange={e => handleQuickStatus(iss.issue_id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td><Person name={iss.assignee_name} /></td>
                    <td><small className="muted">{iss.reporter_name || 'System'}</small></td>
                    <td><small className="muted">{ago(iss.created_at)}</small></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {iss.screenshot && (
                          <a
                            href={`http://localhost:5000${iss.screenshot}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn sm"
                            title="View screenshot"
                          >
                            <Icon name="file" />
                          </a>
                        )}
                        <button
                          className="btn sm"
                          title="Edit"
                          onClick={() => openIssueModal(iss)}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="btn sm danger"
                          title="Delete"
                          onClick={() => handleDelete(iss)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 40 }}>
                    <Empty
                      icon="bug"
                      title="No issues found"
                      text="Great job! No unresolved defects match your current criteria."
                      action={
                        <button className="btn primary" onClick={() => openIssueModal()}>
                          <Icon name="plus" /> Report an issue
                        </button>
                      }
                      sm
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
